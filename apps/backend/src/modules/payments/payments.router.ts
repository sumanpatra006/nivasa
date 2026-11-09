import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { USER_ROLES } from '@nivasa/shared';
import { societyStore, PaymentRecord, ReceiptRecord, LedgerEntryRecord } from '../billing/societyStore.js';

export const paymentsRouter = Router();

paymentsRouter.use(authMiddleware);

// POST /api/v1/payments/initiate - Initiate mock gateway payment session
paymentsRouter.post('/initiate', (req: Request, res: Response) => {
  const { invoiceId, amountPaise, idempotencyKey } = req.body;
  const user = req.user!;

  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    res.status(400).json({ error: 'Validation Error', message: 'A unique idempotencyKey is required.' });
    return;
  }

  // Idempotency check: if already initiated or processed with this key, return existing record
  const existingPayment = societyStore.getPaymentByIdempotencyKey(idempotencyKey);
  if (existingPayment) {
    res.status(200).json({
      message: 'Idempotent replay: existing payment returned',
      payment: existingPayment,
    });
    return;
  }

  if (!invoiceId || typeof invoiceId !== 'string') {
    res.status(400).json({ error: 'Validation Error', message: 'invoiceId is required.' });
    return;
  }

  const invoice = societyStore.getInvoiceById(invoiceId);
  if (!invoice) {
    res.status(404).json({ error: 'Not Found', message: `Invoice ${invoiceId} not found.` });
    return;
  }

  // Horizontal flat authorization check: resident can only pay for their own registered flat
  if (user.role === USER_ROLES.RESIDENT && !user.flatIds.includes(invoice.flatId)) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Unauthorized: You cannot initiate payment for another flat.',
    });
    return;
  }

  // Amount validations
  if (typeof amountPaise !== 'number' || !Number.isInteger(amountPaise) || amountPaise <= 0) {
    res.status(400).json({
      error: 'Invalid Amount',
      message: 'Payment amount must be a positive integer in paise.',
    });
    return;
  }

  if (amountPaise > invoice.remainingBalancePaise) {
    res.status(400).json({
      error: 'Excessive Amount',
      message: `Payment amount (${amountPaise} paise) exceeds remaining invoice balance (${invoice.remainingBalancePaise} paise).`,
    });
    return;
  }

  const payment: PaymentRecord = {
    id: `pay-${Date.now()}`,
    invoiceId: invoice.id,
    flatId: invoice.flatId,
    amountPaise,
    idempotencyKey,
    provider: 'MOCK_GATEWAY',
    providerReference: `MOCK-UPI-${Math.floor(100000 + Math.random() * 900000)}`,
    status: 'INITIATED',
    createdAt: new Date().toISOString(),
    receiptId: null,
  };

  societyStore.savePayment(payment);

  res.status(201).json({ payment });
});

// POST /api/v1/payments/verify - Process mock provider outcome
paymentsRouter.post('/verify', (req: Request, res: Response) => {
  const { idempotencyKey, outcome = 'SUCCESS', simulateFailure = false } = req.body;

  if (!idempotencyKey) {
    res.status(400).json({ error: 'Validation Error', message: 'idempotencyKey is required for verification.' });
    return;
  }

  const payment = societyStore.getPaymentByIdempotencyKey(idempotencyKey);
  if (!payment) {
    res.status(404).json({ error: 'Not Found', message: 'Payment record not found for this idempotency key.' });
    return;
  }

  // If already verified as SUCCESS, return existing record and receipt idempotently
  if (payment.status === 'SUCCESS' && payment.receiptId) {
    const existingReceipt = societyStore.getReceiptById(payment.receiptId);
    const invoice = societyStore.getInvoiceById(payment.invoiceId);
    res.status(200).json({
      message: 'Payment already verified (idempotent replay)',
      payment,
      receipt: existingReceipt,
      invoice,
    });
    return;
  }

  // Handle deterministic failure
  if (simulateFailure === true || outcome === 'FAILED') {
    payment.status = 'FAILED';
    payment.failureReason = 'Card/UPI gateway declined by issuing bank (Simulated failure)';
    societyStore.savePayment(payment);

    res.status(200).json({
      message: 'Payment verification failed at gateway',
      payment,
      receipt: null,
    });
    return;
  }

  // Process SUCCESS outcome
  const invoice = societyStore.getInvoiceById(payment.invoiceId);
  if (!invoice) {
    res.status(404).json({ error: 'Not Found', message: 'Target invoice not found for payment posting.' });
    return;
  }

  payment.status = 'SUCCESS';
  payment.paidAt = new Date().toISOString();

  // 1. Generate sequential official receipt
  const receiptNumber = `REC-202611-${String(societyStore.getReceipts().length + 1).padStart(4, '0')}`;
  const receipt: ReceiptRecord = {
    id: `rec-${Date.now()}`,
    receiptNumber,
    paymentId: payment.id,
    invoiceId: invoice.id,
    flatId: invoice.flatId,
    flatIdentifier: `${invoice.tower}-${invoice.flatNumber}`,
    residentName: invoice.residentName,
    billingPeriod: invoice.billingPeriod === '2026-11' ? 'November 2026' : invoice.billingPeriod,
    amountPaise: payment.amountPaise,
    paymentReference: payment.providerReference,
    date: payment.paidAt,
  };

  societyStore.saveReceipt(receipt);
  payment.receiptId = receipt.id;
  societyStore.savePayment(payment);

  // 2. Update target invoice status and balance in integer paise
  invoice.paidAmountPaise += payment.amountPaise;
  invoice.remainingBalancePaise = Math.max(0, invoice.totalAmountPaise - invoice.paidAmountPaise);
  invoice.status = invoice.remainingBalancePaise === 0 ? 'PAID' : 'PARTIALLY_PAID';
  societyStore.updateInvoice(invoice);

  // 3. Atomically append to immutable flat ledger
  const ledgerEntry: LedgerEntryRecord = {
    id: `led-${Date.now()}`,
    flatId: invoice.flatId,
    entryType: 'PAYMENT',
    amountPaise: payment.amountPaise,
    description: `Online Payment (Ref: ${payment.providerReference})`,
    reference: payment.providerReference,
    createdAt: payment.paidAt,
  };
  societyStore.addLedgerEntry(ledgerEntry);

  res.status(200).json({
    message: 'Payment verified and posted successfully',
    payment,
    receipt,
    invoice,
    ledgerEntry,
  });
});

// GET /api/v1/payments/receipts - Fetch receipts for authorized flats
paymentsRouter.get('/receipts', (req: Request, res: Response) => {
  const user = req.user!;
  const allReceipts = societyStore.getReceipts();

  if (user.role === USER_ROLES.RESIDENT) {
    const userReceipts = allReceipts.filter((r) => user.flatIds.includes(r.flatId));
    res.status(200).json({ receipts: userReceipts });
    return;
  }

  res.status(200).json({ receipts: allReceipts });
});

// GET /api/v1/payments/receipts/:id - Fetch single receipt by ID or number
paymentsRouter.get('/receipts/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = req.user!;
  const receipt =
    societyStore.getReceiptById(id) ||
    societyStore.getReceipts().find((r) => r.receiptNumber === id);

  if (!receipt) {
    res.status(404).json({ error: 'Not Found', message: `Receipt ${id} not found.` });
    return;
  }

  if (user.role === USER_ROLES.RESIDENT && !user.flatIds.includes(receipt.flatId)) {
    res.status(403).json({ error: 'Forbidden', message: 'Unauthorized: You cannot view receipts for another flat.' });
    return;
  }

  res.status(200).json({ receipt });
});
