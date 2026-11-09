import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import { USER_ROLES } from '@nivasa/shared';

export const reconciliationRouter = Router();

reconciliationRouter.use(authMiddleware);
reconciliationRouter.use(rbacMiddleware([USER_ROLES.ACCOUNTS, USER_ROLES.COMMITTEE]));

// Sample transactions queue
const mockBankQueue = [
  {
    id: 'txn-bank-01',
    transactionDate: '2026-11-02T10:15:00Z',
    amountPaise: 747500,
    reference: 'UPI/1203/NeerajKulkarni',
    upiId: 'neeraj@oksbi',
    description: 'Maintenance T07-1203',
    status: 'SUGGESTED',
    suggestedFlat: 'T07-1203',
    suggestedInvoiceId: 'inv-t07-1203-202611',
    confidence: 0.95,
    matchingReasons: ['Exact Amount Match (40%)', 'Flat Identifier in Narration (35%)', 'Resident Name in Narration (20%)'],
  },
  {
    id: 'txn-bank-02',
    transactionDate: '2026-11-03T16:45:00Z',
    amountPaise: 637000,
    reference: 'NEFT-AXIS-992384',
    upiId: null,
    description: 'Swati Joshi rent/maint',
    status: 'NEEDS_REVIEW',
    suggestedFlat: 'T12-0408',
    suggestedInvoiceId: 'inv-t12-0408-202611',
    confidence: 0.75,
    matchingReasons: ['Exact Amount Match (40%)', 'Resident Name in Narration (20%)', 'Date Proximity (5%)'],
  },
  {
    id: 'txn-bank-03',
    transactionDate: '2026-11-04T12:00:00Z',
    amountPaise: 500000,
    reference: 'IMPS-TRANSFER-4982',
    upiId: null,
    description: 'Transfer from HDFC',
    status: 'UNMATCHED',
    suggestedFlat: null,
    confidence: 0.15,
    matchingReasons: ['Partial Amount Match only'],
  },
];

reconciliationRouter.get('/queue', (_req: Request, res: Response) => {
  res.status(200).json({ queue: mockBankQueue });
});

reconciliationRouter.post('/upload', (req: Request, res: Response) => {
  res.status(201).json({
    message: 'Bank statement batch imported successfully',
    batchId: `batch-${Date.now()}`,
    totalRows: 3,
    processedRows: 3,
  });
});

reconciliationRouter.post('/transactions/:id/confirm', (req: Request, res: Response) => {
  const { id } = req.params;
  const txn = mockBankQueue.find((t) => t.id === id);
  if (!txn) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }

  txn.status = 'POSTED';
  res.status(200).json({
    message: 'Transaction confirmed and posted to flat ledger',
    transaction: txn,
    postedAt: new Date().toISOString(),
  });
});

reconciliationRouter.post('/transactions/:id/reject', (req: Request, res: Response) => {
  const { id } = req.params;
  const txn = mockBankQueue.find((t) => t.id === id);
  if (!txn) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }

  txn.status = 'REJECTED';
  res.status(200).json({
    message: 'Transaction suggestion rejected',
    transaction: txn,
  });
});

