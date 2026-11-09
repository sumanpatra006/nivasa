import { Router, Request, Response } from 'express';
import crypto from 'crypto';
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
import { societyStore, BankImportBatchRecord } from '../billing/societyStore.js';

export const reconciliationRouter = Router();

reconciliationRouter.use(authMiddleware);
reconciliationRouter.use(rbacMiddleware([USER_ROLES.ACCOUNTS, USER_ROLES.COMMITTEE]));

/**
 * Helper to extract candidate invoices from current society database state.
 */
function getActiveCandidateInvoices(): CandidateInvoice[] {
  return societyStore.getInvoices().map((inv) => ({
    id: inv.id,
    flatId: inv.flatId,
    tower: inv.tower,
    flatNumber: inv.flatNumber,
    residentName: inv.residentName,
    residentUpi: inv.residentUpi || null,
    totalAmountPaise: inv.totalAmountPaise,
    paidAmountPaise: inv.paidAmountPaise,
    balancePaise: inv.remainingBalancePaise,
    dueDate: inv.dueDate,
    status: inv.status,
  }));
}

/**
 * Helper to collect all known payment references across the platform to prevent double-crediting.
 */
function getKnownPaymentReferences(): Set<string> {
  const refs = new Set<string>();
  for (const p of societyStore.getPayments()) {
    if (p.providerReference) refs.add(p.providerReference.toUpperCase());
  }
  for (const t of societyStore.getBankTransactions()) {
    if (t.status === 'POSTED' && t.transaction.reference) {
      refs.add(t.transaction.reference.toUpperCase());
    }
  }
  return refs;
}

// GET /api/v1/reconciliation/queue - List transactions with optional status filter
reconciliationRouter.get('/queue', (req: Request, res: Response) => {
  const { status } = req.query;
  let txns = societyStore.getBankTransactions();

  if (status && typeof status === 'string') {
    txns = txns.filter((t) => t.status === status.toUpperCase());
  }

  res.status(200).json({ queue: txns });
});

// GET /api/v1/reconciliation/batches - List imported statement batches
reconciliationRouter.get('/batches', (_req: Request, res: Response) => {
  res.status(200).json({ batches: societyStore.getBankBatches() });
});

// GET /api/v1/reconciliation/candidates - Search candidate flats and invoices
reconciliationRouter.get('/candidates', (req: Request, res: Response) => {
  const query = (req.query.q as string || '').toLowerCase().trim();
  const candidates = getActiveCandidateInvoices();

  if (!query) {
    res.status(200).json({ candidates });
    return;
  }

  const filtered = candidates.filter(
    (c) =>
      c.flatNumber.toLowerCase().includes(query) ||
      c.tower.toLowerCase().includes(query) ||
      `${c.tower}-${c.flatNumber}`.toLowerCase().includes(query) ||
      c.residentName.toLowerCase().includes(query)
  );

  res.status(200).json({ candidates: filtered });
});

// POST /api/v1/reconciliation/upload - Import and parse bank CSV file
reconciliationRouter.post('/upload', (req: Request, res: Response) => {
  const { csvContent, filename = 'statement.csv' } = req.body;

  if (!csvContent || typeof csvContent !== 'string') {
    res.status(400).json({ error: 'Validation Error', message: 'csvContent is required as text.' });
    return;
  }

  // 1. File size check (5 MB limit)
  if (Buffer.byteLength(csvContent, 'utf-8') > 5 * 1024 * 1024) {
    res.status(400).json({ error: 'File Too Large', message: 'File size exceeds maximum allowed limit of 5MB.' });
    return;
  }

  // 2. Duplicate import check using SHA-256 hash
  const fileHash = crypto.createHash('sha256').update(csvContent.trim()).digest('hex');
  const existingBatch = societyStore.getBankBatchByHash(fileHash);
  if (existingBatch) {
    res.status(409).json({
      error: 'Duplicate Import',
      message: `Duplicate statement: This exact bank CSV file has already been imported on ${existingBatch.uploadedAt} (Batch ID: ${existingBatch.id}).`,
      batch: existingBatch,
    });
    return;
  }

  // 3. Parse CSV rows
  const parseResult = parseBankCsv(csvContent);
  if (!parseResult.success && parseResult.transactions.length === 0) {
    res.status(400).json({
      error: 'CSV Parse Failed',
      message: parseResult.errors[0]?.message || 'Failed to parse CSV.',
      errors: parseResult.errors,
      totalRows: parseResult.totalRows,
    });
    return;
  }

  // 4. Run deterministic matching engine against live society invoices
  const candidateInvoices = getActiveCandidateInvoices();
  const knownReferences = getKnownPaymentReferences();

  const reconciledTransactions = reconcileBatch(parseResult.transactions, candidateInvoices, knownReferences);

  // 5. Save batch and transactions to persistent society store
  const batchId = `batch-${Date.now()}`;
  const batchRecord: BankImportBatchRecord = {
    id: batchId,
    filename,
    fileHash,
    uploadedAt: new Date().toISOString(),
    totalRows: parseResult.totalRows,
    processedRows: parseResult.transactions.length,
    duplicateRows: parseResult.duplicateRows,
    invalidRows: parseResult.errors.length,
    rowErrors: parseResult.errors,
  };

  societyStore.saveBankBatch(batchRecord);
  societyStore.saveBankTransactions(reconciledTransactions);

  res.status(201).json({
    message: 'Bank statement batch imported and reconciled successfully',
    batch: batchRecord,
    reconciledQueue: reconciledTransactions,
    summary: {
      totalRows: parseResult.totalRows,
      validRows: parseResult.transactions.length,
      duplicateRows: parseResult.duplicateRows,
      invalidRows: parseResult.errors.length,
      suggestedCount: reconciledTransactions.filter((t) => t.status === 'SUGGESTED').length,
      needsReviewCount: reconciledTransactions.filter((t) => t.status === 'NEEDS_REVIEW').length,
      unmatchedCount: reconciledTransactions.filter((t) => t.status === 'UNMATCHED').length,
    },
  });
});

// POST /api/v1/reconciliation/transactions/:id/confirm - Confirm match and post to flat ledger
reconciliationRouter.post('/transactions/:id/confirm', (req: Request, res: Response) => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const txnId = decodeURIComponent(rawId);
  const { invoiceId } = req.body;

  const item = societyStore.getBankTransactionById(txnId);
  if (!item) {
    res.status(404).json({ error: 'Not Found', message: `Transaction "${txnId}" not found in active queue.` });
    return;
  }

  if (item.status === 'POSTED') {
    res.status(400).json({ error: 'Double Posting Error', message: 'Transaction is already posted to a flat ledger.' });
    return;
  }

  if (item.status === 'DUPLICATE') {
    res.status(400).json({
      error: 'Duplicate Transaction',
      message: 'Cannot post a transaction flagged as a duplicate reference.',
    });
    return;
  }

  // Determine target invoice
  const targetInvoiceId = invoiceId || item.suggestedMatch?.invoiceId;
  if (!targetInvoiceId) {
    res.status(400).json({
      error: 'Ambiguous Target',
      message: 'No invoice specified for this transaction. Please select an invoice manually.',
    });
    return;
  }

  try {
    const postResult = societyStore.postBankTransaction(item.id, targetInvoiceId, req.user?.name);

    res.status(200).json({
      message: 'Transaction confirmed and posted to flat ledger successfully',
      transaction: postResult.transaction,
      invoice: postResult.invoice,
      receipt: postResult.receipt,
      ledgerEntry: postResult.ledgerEntry,
    });
  } catch (err: any) {
    res.status(400).json({
      error: 'Posting Failed',
      message: err.message || 'Failed to post transaction.',
    });
  }
});

// POST /api/v1/reconciliation/transactions/:id/reject - Reject suggestion
reconciliationRouter.post('/transactions/:id/reject', (req: Request, res: Response) => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const txnId = decodeURIComponent(rawId);
  const { reason = 'Rejected by accounts reviewer' } = req.body;

  const item = societyStore.getBankTransactionById(txnId);
  if (!item) {
    res.status(404).json({ error: 'Not Found', message: `Transaction "${txnId}" not found in active queue.` });
    return;
  }

  if (item.status === 'POSTED') {
    res.status(400).json({ error: 'Cannot Reject', message: 'Cannot reject a transaction that is already posted.' });
    return;
  }

  item.status = 'REJECTED';
  item.rejectionReason = reason;
  societyStore.updateBankTransaction(item);

  res.status(200).json({
    message: 'Transaction suggestion rejected and moved to rejected queue',
    transaction: item,
  });
});

// POST /api/v1/reconciliation/transactions/:id/review - Mark for review
reconciliationRouter.post('/transactions/:id/review', (req: Request, res: Response) => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const txnId = decodeURIComponent(rawId);

  const item = societyStore.getBankTransactionById(txnId);
  if (!item) {
    res.status(404).json({ error: 'Not Found', message: `Transaction "${txnId}" not found in active queue.` });
    return;
  }

  if (item.status === 'POSTED') {
    res.status(400).json({ error: 'Invalid Action', message: 'Transaction is already posted.' });
    return;
  }

  item.status = 'NEEDS_REVIEW';
  societyStore.updateBankTransaction(item);

  res.status(200).json({
    message: 'Transaction flagged for manual review',
    transaction: item,
  });
});
