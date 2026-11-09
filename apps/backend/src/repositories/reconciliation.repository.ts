import { prisma } from '../config/prisma.js';
import { BankTransactionStatus } from '@prisma/client';

export interface BankBatchData {
  id: string;
  filename: string;
  fileHash: string;
  uploadedAt: string;
  totalRows: number;
  processedRows: number;
  duplicateRows: number;
  invalidRows: number;
  rowErrors: Array<{ rowNumber: number; reason: string }>;
}

export interface BankTransactionData {
  id: string;
  batchId: string;
  date: string;
  amountPaise: number;
  reference: string;
  upiId?: string | null;
  description: string;
  normalizedReference: string;
  status: 'UNMATCHED' | 'SUGGESTED' | 'NEEDS_REVIEW' | 'MATCHED' | 'POSTED' | 'DUPLICATE' | 'REJECTED';
  candidateInvoiceId?: string | null;
  candidateFlatId?: string | null;
  confidenceScore?: number;
  matchingReasons?: string[];
  missingEvidence?: string[];
  reviewStatus?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}

const memoryBatches: Map<string, BankBatchData> = new Map();
const memoryTransactions: Map<string, BankTransactionData> = new Map();

export class ReconciliationRepository {
  public static async addBatch(batch: BankBatchData): Promise<void> {
    try {
      await prisma.bankImportBatch.create({
        data: {
          id: batch.id,
          fileName: batch.filename,
          fileHash: batch.fileHash,
          importedBy: 'user-staff-pooja',
          totalRows: batch.totalRows,
          processedRows: batch.processedRows,
        },
      });
    } catch {}

    memoryBatches.set(batch.id, batch);
  }

  public static async addTransactions(transactions: BankTransactionData[]): Promise<void> {
    for (const t of transactions) {
      try {
        await prisma.bankTransaction.create({
          data: {
            id: t.id,
            batchId: t.batchId,
            transactionDate: new Date(t.date),
            amountPaise: t.amountPaise,
            reference: t.reference,
            upiId: t.upiId,
            description: t.description,
            normalizedReference: t.normalizedReference,
            transactionHash: `tx-hash-${t.id}`,
            status: t.status as any,
          },
        });
      } catch {}
      memoryTransactions.set(t.id, t);
    }
  }

  public static async getTransactions(): Promise<BankTransactionData[]> {
    try {
      const records = await prisma.bankTransaction.findMany({
        orderBy: { transactionDate: 'desc' },
      });
      if (records.length > 0) {
        return records.map((t) => {
          const mem = memoryTransactions.get(t.id);
          return {
            id: t.id,
            batchId: t.batchId,
            date: t.transactionDate.toISOString().slice(0, 10),
            amountPaise: t.amountPaise,
            reference: t.reference,
            upiId: t.upiId,
            description: t.description || '',
            normalizedReference: t.normalizedReference,
            status: t.status as any,
            candidateInvoiceId: mem?.candidateInvoiceId,
            candidateFlatId: mem?.candidateFlatId,
            confidenceScore: mem?.confidenceScore,
            matchingReasons: mem?.matchingReasons,
            missingEvidence: mem?.missingEvidence,
            reviewStatus: mem?.reviewStatus,
          };
        });
      }
    } catch {}

    return Array.from(memoryTransactions.values());
  }

  public static async getBatches(): Promise<BankBatchData[]> {
    try {
      const records = await prisma.bankImportBatch.findMany({
        orderBy: { importedAt: 'desc' },
      });
      if (records.length > 0) {
        return records.map((b) => ({
          id: b.id,
          filename: b.fileName,
          fileHash: b.fileHash,
          uploadedAt: b.importedAt.toISOString(),
          totalRows: b.totalRows,
          processedRows: b.processedRows,
          duplicateRows: 0,
          invalidRows: 0,
          rowErrors: [],
        }));
      }
    } catch {}

    return Array.from(memoryBatches.values());
  }

  public static async updateStatus(
    id: string,
    status: BankTransactionData['status'],
    options: { candidateInvoiceId?: string; candidateFlatId?: string; reviewedBy?: string } = {}
  ): Promise<BankTransactionData | null> {
    try {
      await prisma.bankTransaction.update({
        where: { id },
        data: { status: status as any },
      });
    } catch {}

    const mem = memoryTransactions.get(id);
    if (mem) {
      mem.status = status;
      if (options.candidateInvoiceId) mem.candidateInvoiceId = options.candidateInvoiceId;
      if (options.candidateFlatId) mem.candidateFlatId = options.candidateFlatId;
      if (options.reviewedBy) mem.reviewedBy = options.reviewedBy;
      mem.reviewedAt = new Date().toISOString();
      return mem;
    }
    return null;
  }
}

