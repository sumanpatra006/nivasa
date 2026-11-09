import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { InitiatePaymentSchema } from '@nivasa/shared';

export const paymentsRouter = Router();

paymentsRouter.use(authMiddleware);

// In-memory payment idempotency & record store
const paymentRecords = new Map<string, any>();

paymentsRouter.post('/initiate', (req: Request, res: Response) => {
  const parsed = InitiatePaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation Error', details: parsed.error.format() });
    return;
  }

  const { invoiceId, amountPaise, idempotencyKey } = parsed.data;

  // Check idempotency
  if (paymentRecords.has(idempotencyKey)) {
    res.status(200).json({
      message: 'Idempotent replay: existing payment returned',
      payment: paymentRecords.get(idempotencyKey),
    });
    return;
  }

  const payment = {
    id: `pay-${Date.now()}`,
    invoiceId,
    amountPaise,
    idempotencyKey,
    provider: 'MOCK_GATEWAY',
    providerReference: `MOCK-REF-${Math.floor(100000 + Math.random() * 900000)}`,
    status: 'INITIATED',
    createdAt: new Date().toISOString(),
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

  const payment = paymentRecords.get(idempotencyKey);
  payment.status = outcome === 'SUCCESS' ? 'SUCCESS' : 'FAILED';
  payment.paidAt = outcome === 'SUCCESS' ? new Date().toISOString() : null;

  const receipt = outcome === 'SUCCESS' ? {
    id: `rec-${Date.now()}`,
    receiptNumber: `REC-202611-${Math.floor(10000 + Math.random() * 90000)}`,
    paymentId: payment.id,
    amountPaise: payment.amountPaise,
    issuedAt: new Date().toISOString(),
  } : null;

  res.status(200).json({ payment, receipt });
});

paymentsRouter.get('/receipts', (req: Request, res: Response) => {
  res.status(200).json({
    receipts: [
      {
        id: 'rec-sample-01',
        receiptNumber: 'REC-202611-0001',
        paymentId: 'pay-sample-01',
        amountPaise: 747500,
        issuedAt: '2026-11-01T10:00:00Z',
      },
    ],
  });
});

