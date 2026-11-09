import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { InitiatePaymentSchema } from '@nivasa/shared';
import { addLedgerEntry, getLedgerEntries } from '../ledger/ledgerStore.js';

export const paymentsRouter = Router();

paymentsRouter.use(authMiddleware);

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  flatId: string;
  amountPaise: number;
  idempotencyKey: string;
  provider: string;
  providerReference: string;
  status: 'INITIATED' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  createdAt: string;
  paidAt?: string | null;
  receipt?: {
    id: string;
    receiptNumber: string;
    paymentId: string;
    amountPaise: number;
    issuedAt: string;
  } | null;
}

// In-memory payment idempotency & record store
const paymentRecords = new Map<string, PaymentRecord>();

paymentsRouter.post('/initiate', (req: Request, res: Response) => {
  const parsed = InitiatePaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation Error', details: parsed.error.format() });
    return;
  }

  const { invoiceId, amountPaise, idempotencyKey } = parsed.data;

  // Enforce idempotency: if key exists, return existing record without creating a new one
  if (paymentRecords.has(idempotencyKey)) {
    res.status(200).json({
      message: 'Idempotent replay: existing payment returned',
      payment: paymentRecords.get(idempotencyKey),
    });
    return;
  }

  // Derive flatId from user context or invoice
  const flatId = req.user?.flatIds?.[0] || 'flat-t07-1203';

  const payment: PaymentRecord = {
    id: `pay-${Date.now()}`,
    invoiceId,
    flatId,
    amountPaise,
    idempotencyKey,
    provider: 'MOCK_GATEWAY',
    providerReference: `MOCK-REF-${Math.floor(100000 + Math.random() * 900000)}`,
    status: 'INITIATED',
    createdAt: new Date().toISOString(),
    receipt: null,
  };

  paymentRecords.set(idempotencyKey, payment);

  res.status(201).json({ payment });
});

paymentsRouter.post('/verify', (req: Request, res: Response) => {
  const { idempotencyKey, outcome = 'SUCCESS' } = req.body;
  if (!idempotencyKey || !paymentRecords.has(idempotencyKey)) {
    res.status(404).json({ error: 'Not Found', message: 'Payment record not found' });
    return;
  }

  const payment = paymentRecords.get(idempotencyKey)!;

  // If already verified as SUCCESS, return existing receipt idempotently
  if (payment.status === 'SUCCESS' && payment.receipt) {
    res.status(200).json({
      message: 'Payment already verified (idempotent response)',
      payment,
      receipt: payment.receipt,
    });
    return;
  }

  payment.status = outcome === 'SUCCESS' ? 'SUCCESS' : 'FAILED';
  payment.paidAt = outcome === 'SUCCESS' ? new Date().toISOString() : null;

  if (outcome === 'SUCCESS') {
    const receipt = {
      id: `rec-${Date.now()}`,
      receiptNumber: `REC-202611-${Math.floor(10000 + Math.random() * 90000)}`,
      paymentId: payment.id,
      amountPaise: payment.amountPaise,
      issuedAt: new Date().toISOString(),
    };
    payment.receipt = receipt;

    // Atomically append to ledger
    addLedgerEntry({
      id: `led-${Date.now()}`,
      flatId: payment.flatId,
      entryType: 'PAYMENT',
      amountPaise: payment.amountPaise,
      description: `Online Payment via Mock Gateway (${payment.providerReference})`,
      createdAt: new Date().toISOString(),
    });

    res.status(200).json({ payment, receipt });
    return;
  }

  res.status(200).json({ payment, receipt: null });
});

paymentsRouter.get('/receipts', (req: Request, res: Response) => {
  const receipts = Array.from(paymentRecords.values())
    .filter((p) => p.status === 'SUCCESS' && p.receipt)
    .map((p) => p.receipt);

  if (receipts.length === 0) {
    receipts.push({
      id: 'rec-sample-01',
      receiptNumber: 'REC-202611-0001',
      paymentId: 'pay-sample-01',
      amountPaise: 747500,
      issuedAt: '2026-11-01T10:00:00Z',
    });
  }

  res.status(200).json({ receipts });
});
