import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { USER_ROLES } from '@nivasa/shared';
import { PaymentRepository } from '../../repositories/payment.repository.js';
import { InvoiceRepository } from '../../repositories/invoice.repository.js';

export const paymentsRouter = Router();

paymentsRouter.use(authMiddleware);

// POST /api/v1/payments/initiate - Initiate payment session
paymentsRouter.post('/initiate', async (req: Request, res: Response) => {
  const { invoiceId, amountPaise, idempotencyKey } = req.body;
  const user = req.user!;

  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    res.status(400).json({ error: 'Validation Error', message: 'A unique idempotencyKey is required.' });
    return;
  }

  // Idempotency check: if already initiated or processed with this key, return existing record
  const existingPayment = await PaymentRepository.findByIdempotencyKey(idempotencyKey);
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

  const invoice = await InvoiceRepository.findById(invoiceId);
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

  const payment = await PaymentRepository.initiate({
    invoiceId: invoice.id,
    flatId: invoice.flatId,
    residentId: user.id || 'user-staff-ramesh',
    amountPaise,
    idempotencyKey,
    provider: 'MOCK_GATEWAY',
    providerReference: `MOCK-UPI-${Math.floor(100000 + Math.random() * 900000)}`,
  });

  res.status(201).json({ payment });
});

// POST /api/v1/payments/verify - Process payment provider outcome
paymentsRouter.post('/verify', async (req: Request, res: Response) => {
  const { idempotencyKey, outcome = 'SUCCESS', simulateFailure = false } = req.body;

  if (!idempotencyKey) {
    res.status(400).json({ error: 'Validation Error', message: 'idempotencyKey is required for verification.' });
    return;
  }

  const payment = await PaymentRepository.findByIdempotencyKey(idempotencyKey);
  if (!payment) {
    res.status(404).json({ error: 'Not Found', message: 'Payment record not found for this idempotency key.' });
    return;
  }

  // If already verified as SUCCESS, return existing record and receipt idempotently
  if (payment.status === 'SUCCESS' && payment.receiptId) {
    const existingReceipt = await PaymentRepository.findReceiptById(payment.receiptId);
    const invoice = await InvoiceRepository.findById(payment.invoiceId);
    res.status(200).json({
      message: 'Payment already verified (idempotent replay)',
      payment,
      receipt: existingReceipt,
      invoice,
    });
    return;
  }

  // Handle failure
  if (simulateFailure === true || outcome === 'FAILED') {
    const failedPayment = await PaymentRepository.verifyFailure(
      payment,
      'Card/UPI gateway declined by issuing bank (Simulated failure)'
    );

    res.status(200).json({
      message: 'Payment verification failed at gateway',
      payment: failedPayment,
      receipt: null,
    });
    return;
  }

  // Handle SUCCESS
  const invoice = await InvoiceRepository.findById(payment.invoiceId);
  if (!invoice) {
    res.status(404).json({ error: 'Not Found', message: 'Associated invoice not found.' });
    return;
  }

  const result = await PaymentRepository.verifySuccess(payment, invoice);

  res.status(200).json({
    message: 'Payment verified successfully and ledger updated.',
    payment: result.payment,
    receipt: result.receipt,
    invoice: result.invoice,
  });
});

// GET /api/v1/payments/receipts - List receipts
paymentsRouter.get('/receipts', async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role === USER_ROLES.RESIDENT) {
    const allReceipts = await Promise.all(user.flatIds.map((fId) => PaymentRepository.findReceipts(fId)));
    res.status(200).json({ receipts: allReceipts.flat() });
    return;
  }

  const receipts = await PaymentRepository.findReceipts();
  res.status(200).json({ receipts });
});

// GET /api/v1/payments/receipts/:id - Get receipt by ID
paymentsRouter.get('/receipts/:id', async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = req.user!;
  const receipt = await PaymentRepository.findReceiptById(id);

  if (!receipt) {
    res.status(404).json({ error: 'Not Found', message: `Receipt ${id} not found.` });
    return;
  }

  if (user.role === USER_ROLES.RESIDENT && !user.flatIds.includes(receipt.flatId)) {
    res.status(403).json({ error: 'Forbidden', message: 'You are not authorized to view this receipt.' });
    return;
  }

  res.status(200).json({ receipt });
});
