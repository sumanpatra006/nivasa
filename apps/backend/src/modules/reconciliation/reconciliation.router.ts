import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import { USER_ROLES } from '@nivasa/shared';
import { parseBankCsv } from './csvParser.js';
import {
  matchTransaction,
  reconcileBatch,
  CandidateInvoice,
  ReconciledTransaction,
} from './reconciliationEngine.js';

export const reconciliationRouter = Router();

reconciliationRouter.use(authMiddleware);
reconciliationRouter.use(rbacMiddleware([USER_ROLES.ACCOUNTS, USER_ROLES.COMMITTEE]));

// In-memory candidate invoices based on authoritative TDD fixtures
const candidateInvoices: CandidateInvoice[] = [
  {
    id: 'inv-t07-1203-202611',
    flatId: 'flat-t07-1203',
    tower: 'T07',
    flatNumber: '1203',
    residentName: 'Neeraj Kulkarni',
    residentUpi: 'neeraj@oksbi',
    totalAmountPaise: 747500,
    paidAmountPaise: 0,
    balancePaise: 747500,
    dueDate: '2026-11-10T00:00:00Z',
    status: 'ISSUED',
  },
  {
    id: 'inv-t12-0408-202611',
    flatId: 'flat-t12-0408',
    tower: 'T12',
    flatNumber: '0408',
    residentName: 'Swati Joshi',
    residentUpi: null,
    totalAmountPaise: 637000,
    paidAmountPaise: 0,
    balancePaise: 637000,
    dueDate: '2026-09-24T00:00:00Z',
    status: 'OVERDUE',
  },
  {
    id: 'inv-t21-1601-202611',
    flatId: 'flat-t21-1601',
    tower: 'T21',
    flatNumber: '1601',
    residentName: 'Aamir Shaikh',
    residentUpi: null,
    totalAmountPaise: 1066000,
    paidAmountPaise: 500000,
    balancePaise: 566000,
    dueDate: '2026-10-23T00:00:00Z',
    status: 'PARTIALLY_PAID',
  },
];

// Preserved system state
const systemRecordedReferences = new Set<string>();
let activeReconciledQueue: ReconciledTransaction[] = reconcileBatch(
  [
    {
      rowNumber: 2,
      rawRow: '2026-11-02,7475.00,UPI/1203/NeerajKulkarni,neeraj@oksbi,Maintenance T07-1203',
      transactionDate: '2026-11-02T10:15:00Z',
      amountPaise: 747500,
      reference: 'UPI/1203/NEERAJKULKARNI',
      upiId: 'neeraj@oksbi',
      description: 'Maintenance T07-1203',
      isDuplicateInBatch: false,
    },
    {
      rowNumber: 3,
      rawRow: '2026-11-03,6370.00,NEFT-AXIS-992384,,Swati Joshi rent/maint',
      transactionDate: '2026-11-03T16:45:00Z',
      amountPaise: 637000,
      reference: 'NEFT-AXIS-992384',
      upiId: null,
      description: 'Swati Joshi rent/maint',
      isDuplicateInBatch: false,
    },
    {
      rowNumber: 4,
      rawRow: '2026-11-04,5000.00,IMPS-TRANSFER-4982,,Transfer from HDFC',
      transactionDate: '2026-11-04T12:00:00Z',
      amountPaise: 500000,
      reference: 'IMPS-TRANSFER-4982',
      upiId: null,
      description: 'Transfer from HDFC',
      isDuplicateInBatch: false,
    },
  ],
  candidateInvoices,
  systemRecordedReferences
);

// GET /api/v1/reconciliation/queue
reconciliationRouter.get('/queue', (_req: Request, res: Response) => {
  res.status(200).json({ queue: activeReconciledQueue });
});

// POST /api/v1/reconciliation/upload
reconciliationRouter.post('/upload', (req: Request, res: Response) => {
  const { csvContent } = req.body;
  if (!csvContent || typeof csvContent !== 'string') {
    res.status(400).json({ error: 'Validation Error', message: 'csvContent must be provided as text' });
    return;
  }

  const parseResult = parseBankCsv(csvContent);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'CSV Parse Failed',
      errors: parseResult.errors,
      totalRows: parseResult.totalRows,
    });
    return;
  }

  const reconciled = reconcileBatch(parseResult.transactions, candidateInvoices, systemRecordedReferences);
  activeReconciledQueue = reconciled;

  res.status(201).json({
    message: 'Bank statement batch imported and reconciled',
    batchId: `batch-${Date.now()}`,
    totalRows: parseResult.totalRows,
    processedRows: parseResult.transactions.length,
    reconciledQueue: activeReconciledQueue,
  });
});

// POST /api/v1/reconciliation/transactions/:ref/confirm
reconciliationRouter.post('/transactions/:ref/confirm', (req: Request, res: Response) => {
  const rawRef = Array.isArray(req.params.ref) ? req.params.ref[0] : req.params.ref;
  const ref = decodeURIComponent(rawRef);
  const item = activeReconciledQueue.find((t) => t.transaction.reference === ref);

  if (!item) {
    res.status(404).json({ error: 'Transaction not found in active queue' });
    return;
  }

  if (item.status === 'DUPLICATE') {
    res.status(400).json({ error: 'Cannot confirm a duplicate transaction reference' });
    return;
  }

  item.status = 'POSTED';
  systemRecordedReferences.add(item.transaction.reference);

  // Update target invoice if matched
  if (item.suggestedMatch) {
    const inv = candidateInvoices.find((i) => i.id === item.suggestedMatch!.invoiceId);
    if (inv) {
      inv.paidAmountPaise += item.transaction.amountPaise;
      inv.balancePaise = Math.max(0, inv.totalAmountPaise - inv.paidAmountPaise);
      inv.status = inv.balancePaise === 0 ? 'PAID' : 'PARTIALLY_PAID';
    }
  }

  res.status(200).json({
    message: 'Transaction confirmed and posted to flat ledger',
    reconciledTransaction: item,
    postedAt: new Date().toISOString(),
  });
});

// POST /api/v1/reconciliation/transactions/:ref/reject
reconciliationRouter.post('/transactions/:ref/reject', (req: Request, res: Response) => {
  const rawRef = Array.isArray(req.params.ref) ? req.params.ref[0] : req.params.ref;
  const ref = decodeURIComponent(rawRef);
  const item = activeReconciledQueue.find((t) => t.transaction.reference === ref);

  if (!item) {
    res.status(404).json({ error: 'Transaction not found in active queue' });
    return;
  }

  item.status = 'REJECTED';
  res.status(200).json({
    message: 'Transaction suggestion rejected and returned to unmatched queue',
    reconciledTransaction: item,
  });
});
