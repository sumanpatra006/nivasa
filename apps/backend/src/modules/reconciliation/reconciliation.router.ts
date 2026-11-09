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
import { ReconciliationRepository, BankBatchData, BankTransactionData } from '../../repositories/reconciliation.repository.js';
import { InvoiceRepository } from '../../repositories/invoice.repository.js';
import { PaymentRepository } from '../../repositories/payment.repository.js';

export const reconciliationRouter = Router();

reconciliationRouter.use(authMiddleware);
reconciliationRouter.use(rbacMiddleware([USER_ROLES.ACCOUNTS, USER_ROLES.COMMITTEE]));

/**
 * Helper to extract candidate invoices from database.
 */
async function getActiveCandidateInvoices(): Promise<CandidateInvoice[]> {
  const invoices = await InvoiceRepository.findMany();
  return invoices.map((inv) => ({
    id: inv.id,
    flatId: inv.flatId,
    tower: inv.tower,
    flatNumber: inv.flatNumber,
    residentName: inv.residentName,
    residentUpi: null,
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
async function getKnownPaymentReferences(): Promise<Set<string>> {
  const refs = new Set<string>();
  const txns = await ReconciliationRepository.getTransactions();
  for (const t of txns) {
    if (t.status === 'POSTED' && t.reference) {
      refs.add(t.reference.toUpperCase());
    }
  }
  return refs;
}

// GET /api/v1/reconciliation/queue - List transactions with optional status filter
reconciliationRouter.get('/queue', async (req: Request, res: Response) => {
  const { status } = req.query;
  let txns = await ReconciliationRepository.getTransactions();

  if (status && typeof status === 'string') {
    if (status === 'UNMATCHED_QUEUE') {
      txns = txns.filter((t) => t.status === 'UNMATCHED' || t.status === 'NEEDS_REVIEW');
    } else {
      txns = txns.filter((t) => t.status === status);
    }
  }

  res.status(200).json({
    totalCount: txns.length,
    transactions: txns,
  });
});

// GET /api/v1/reconciliation/batches - List imported CSV batches
reconciliationRouter.get('/batches', async (_req: Request, res: Response) => {
  const batches = await ReconciliationRepository.getBatches();
  res.status(200).json({ batches });
});

// POST /api/v1/reconciliation/upload - Upload and parse bank statement CSV
reconciliationRouter.post('/upload', async (req: Request, res: Response) => {
  const { csvContent, filename = 'statement.csv' } = req.body;

  if (!csvContent || typeof csvContent !== 'string') {
    res.status(400).json({ error: 'Validation Error', message: 'csvContent string is required.' });
    return;
  }

  // 1. File size check (5 MB limit)
  if (Buffer.byteLength(csvContent, 'utf-8') > 5 * 1024 * 1024) {
    res.status(400).json({ error: 'File Too Large', message: 'File size exceeds maximum allowed limit of 5MB.' });
    return;
  }

  // 2. Duplicate import check using SHA-256 hash
  const fileHash = crypto.createHash('sha256').update(csvContent.trim()).digest('hex');
  const batches = await ReconciliationRepository.getBatches();
  const existingBatch = batches.find((b) => b.fileHash === fileHash);
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
  const candidateInvoices = await getActiveCandidateInvoices();
  const knownReferences = await getKnownPaymentReferences();

  const reconciledTransactions = reconcileBatch(parseResult.transactions, candidateInvoices, knownReferences);

  // 5. Save batch and transactions to database
  const batchId = `batch-${Date.now()}`;
  const batchRecord: BankBatchData = {
    id: batchId,
    filename,
    fileHash,
    uploadedAt: new Date().toISOString(),
    totalRows: parseResult.totalRows,
    processedRows: parseResult.transactions.length,
    duplicateRows: parseResult.duplicateRows,
    invalidRows: parseResult.errors.length,
    rowErrors: parseResult.errors.map((e) => ({ rowNumber: e.line, reason: e.message })),
  };

  await ReconciliationRepository.addBatch(batchRecord);
  await ReconciliationRepository.addTransactions(
    reconciledTransactions.map((rt) => ({
      id: rt.transaction.id,
      batchId,
      date: rt.transaction.transactionDate,
      amountPaise: rt.transaction.amountPaise,
      reference: rt.transaction.reference,
      upiId: rt.transaction.upiId,
      description: rt.transaction.description,
      normalizedReference: rt.transaction.reference.replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
      status: rt.status as any,
      candidateInvoiceId: rt.suggestedMatch?.invoiceId,
      candidateFlatId: rt.suggestedMatch?.candidateFlat?.flatId,
      confidenceScore: rt.suggestedMatch?.confidence,
      matchingReasons: rt.suggestedMatch?.matchingReasons,
      missingEvidence: rt.suggestedMatch?.missingEvidence,
      reviewStatus: 'PENDING',
    }))
  );

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
reconciliationRouter.post('/transactions/:id/confirm', async (req: Request, res: Response) => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const txnId = decodeURIComponent(rawId);
  const { invoiceId } = req.body;

  const txns = await ReconciliationRepository.getTransactions();
  const item = txns.find((t) => t.id === txnId);
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

  const targetInvoiceId = invoiceId || item.candidateInvoiceId;
  if (!targetInvoiceId) {
    res.status(400).json({
      error: 'Ambiguous Target',
      message: 'No candidate invoice specified. Ambiguous bank transactions must not be posted automatically.',
    });
    return;
  }

  const invoice = await InvoiceRepository.findById(targetInvoiceId);
  if (!invoice) {
    res.status(404).json({ error: 'Not Found', message: `Invoice "${targetInvoiceId}" not found.` });
    return;
  }

  // Update status in repository
  const updatedTxn = await ReconciliationRepository.updateStatus(txnId, 'POSTED', {
    candidateInvoiceId: invoice.id,
    candidateFlatId: invoice.flatId,
    reviewedBy: req.user!.name || 'Accounts Officer',
  });

  res.status(200).json({
    message: `Payment of ₹${(item.amountPaise / 100).toFixed(2)} posted to flat ${invoice.tower}-${invoice.flatNumber}`,
    transaction: updatedTxn,
  });
});

// POST /api/v1/reconciliation/transactions/:id/reject - Reject candidate match
reconciliationRouter.post('/transactions/:id/reject', async (req: Request, res: Response) => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const txnId = decodeURIComponent(rawId);

  const updatedTxn = await ReconciliationRepository.updateStatus(txnId, 'REJECTED', {
    reviewedBy: req.user!.name || 'Accounts Officer',
  });

  if (!updatedTxn) {
    res.status(404).json({ error: 'Not Found', message: `Transaction "${txnId}" not found.` });
    return;
  }

  res.status(200).json({
    message: 'Suggested match rejected. Transaction moved to unmatched queue.',
    transaction: updatedTxn,
  });
});
