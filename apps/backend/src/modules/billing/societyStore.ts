import fs from 'fs';
import path from 'path';
import { calculateMaintenancePaise, calculateLateFeePaise } from '@nivasa/shared';
import type { ReconciledTransaction } from '../reconciliation/reconciliationEngine.js';

export interface InvoiceRecord {
  id: string;
  flatId: string;
  tower: string;
  flatNumber: string;
  residentName: string;
  residentPhone: string;
  residentUpi?: string | null;
  billingPeriod: string; // "2026-11"
  areaSqFt: number;
  ratePerSqFtPaise: number; // 650 paise = ₹6.50
  baseAmountPaise: number;
  lateFeePaise: number;
  totalAmountPaise: number;
  paidAmountPaise: number;
  remainingBalancePaise: number;
  dueDate: string; // ISO 8601
  status: 'PAID' | 'PARTIALLY_PAID' | 'ISSUED' | 'OVERDUE';
  daysOverdue: number;
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  flatId: string;
  amountPaise: number;
  idempotencyKey: string;
  provider: string;
  providerReference: string;
  status: 'INITIATED' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  failureReason?: string;
  createdAt: string;
  paidAt?: string | null;
  receiptId?: string | null;
}

export interface ReceiptRecord {
  id: string;
  receiptNumber: string; // REC-202611-XXXXX
  paymentId: string;
  invoiceId: string;
  flatId: string;
  flatIdentifier: string; // "T07-1203"
  residentName: string;
  billingPeriod: string; // "November 2026"
  amountPaise: number;
  paymentReference: string;
  date: string; // ISO 8601
}

export interface LedgerEntryRecord {
  id: string;
  flatId: string;
  entryType: 'BILL' | 'PAYMENT' | 'LATE_FEE' | 'ADJUSTMENT' | 'REVERSAL';
  amountPaise: number;
  description: string;
  reference?: string;
  createdAt: string; // ISO 8601
}

export interface BankImportBatchRecord {
  id: string;
  filename: string;
  fileHash: string; // SHA-256 for duplicate import detection
  uploadedAt: string;
  totalRows: number;
  processedRows: number;
  duplicateRows: number;
  invalidRows: number;
  rowErrors: Array<{ line: number; message: string; rawRow: string }>;
}

export interface SocietyState {
  invoices: InvoiceRecord[];
  payments: PaymentRecord[];
  receipts: ReceiptRecord[];
  ledger: LedgerEntryRecord[];
  bankBatches: BankImportBatchRecord[];
  bankTransactions: ReconciledTransaction[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'society_state.json');

/**
 * Authoritative Initial Seed Records strictly conforming to TDD.md Section 5
 */
export function getInitialSeedState(): SocietyState {
  // Flat 1: T07-1203 (Neeraj Kulkarni)
  const inv1Base = calculateMaintenancePaise(1150, 650);
  const inv1Late = calculateLateFeePaise(0);
  const inv1Total = inv1Base + inv1Late;

  // Flat 2: T12-0408 (Swati Joshi, Tenant)
  const inv2Base = calculateMaintenancePaise(980, 650);
  const inv2Late = calculateLateFeePaise(47);
  const inv2Total = inv2Base + inv2Late;

  // Flat 3: T21-1601 (Aamir Shaikh)
  const inv3Base = calculateMaintenancePaise(1640, 650);
  const inv3Late = calculateLateFeePaise(18);
  const inv3Total = inv3Base + inv3Late;

  const invoices: InvoiceRecord[] = [
    {
      id: 'inv-t07-1203-202611',
      flatId: 'flat-t07-1203',
      tower: 'T07',
      flatNumber: '1203',
      residentName: 'Neeraj Kulkarni',
      residentPhone: '9820000001',
      residentUpi: 'neeraj@oksbi',
      billingPeriod: '2026-11',
      areaSqFt: 1150,
      ratePerSqFtPaise: 650,
      baseAmountPaise: inv1Base,
      lateFeePaise: inv1Late,
      totalAmountPaise: inv1Total,
      paidAmountPaise: inv1Total,
      remainingBalancePaise: 0,
      dueDate: '2026-11-10T00:00:00Z',
      status: 'PAID',
      daysOverdue: 0,
    },
    {
      id: 'inv-t12-0408-202611',
      flatId: 'flat-t12-0408',
      tower: 'T12',
      flatNumber: '0408',
      residentName: 'Swati Joshi',
      residentPhone: '9820000002',
      residentUpi: null,
      billingPeriod: '2026-11',
      areaSqFt: 980,
      ratePerSqFtPaise: 650,
      baseAmountPaise: inv2Base,
      lateFeePaise: inv2Late,
      totalAmountPaise: inv2Total,
      paidAmountPaise: 0,
      remainingBalancePaise: inv2Total,
      dueDate: '2026-09-24T00:00:00Z',
      status: 'OVERDUE',
      daysOverdue: 47,
    },
    {
      id: 'inv-t21-1601-202611',
      flatId: 'flat-t21-1601',
      tower: 'T21',
      flatNumber: '1601',
      residentName: 'Aamir Shaikh',
      residentPhone: '9820000003',
      residentUpi: null,
      billingPeriod: '2026-11',
      areaSqFt: 1640,
      ratePerSqFtPaise: 650,
      baseAmountPaise: inv3Base,
      lateFeePaise: inv3Late,
      totalAmountPaise: inv3Total,
      paidAmountPaise: 500000,
      remainingBalancePaise: inv3Total - 500000,
      dueDate: '2026-10-23T00:00:00Z',
      status: 'PARTIALLY_PAID',
      daysOverdue: 18,
    },
  ];

  const payments: PaymentRecord[] = [
    {
      id: 'pay-seed-01',
      invoiceId: 'inv-t07-1203-202611',
      flatId: 'flat-t07-1203',
      amountPaise: 747500,
      idempotencyKey: 'idemp-seed-01',
      provider: 'MOCK_GATEWAY',
      providerReference: 'MOCK-UPI-98201',
      status: 'SUCCESS',
      createdAt: '2026-11-01T10:00:00Z',
      paidAt: '2026-11-01T10:01:00Z',
      receiptId: 'rec-seed-01',
    },
    {
      id: 'pay-seed-02',
      invoiceId: 'inv-t21-1601-202611',
      flatId: 'flat-t21-1601',
      amountPaise: 500000,
      idempotencyKey: 'idemp-seed-02',
      provider: 'MOCK_GATEWAY',
      providerReference: 'MOCK-UPI-98202',
      status: 'SUCCESS',
      createdAt: '2026-11-03T11:00:00Z',
      paidAt: '2026-11-03T11:02:00Z',
      receiptId: 'rec-seed-02',
    },
  ];

  const receipts: ReceiptRecord[] = [
    {
      id: 'rec-seed-01',
      receiptNumber: 'REC-202611-0001',
      paymentId: 'pay-seed-01',
      invoiceId: 'inv-t07-1203-202611',
      flatId: 'flat-t07-1203',
      flatIdentifier: 'T07-1203',
      residentName: 'Neeraj Kulkarni',
      billingPeriod: 'November 2026',
      amountPaise: 747500,
      paymentReference: 'MOCK-UPI-98201',
      date: '2026-11-01T10:01:00Z',
    },
    {
      id: 'rec-seed-02',
      receiptNumber: 'REC-202611-0002',
      paymentId: 'pay-seed-02',
      invoiceId: 'inv-t21-1601-202611',
      flatId: 'flat-t21-1601',
      flatIdentifier: 'T21-1601',
      residentName: 'Aamir Shaikh',
      billingPeriod: 'November 2026',
      amountPaise: 500000,
      paymentReference: 'MOCK-UPI-98202',
      date: '2026-11-03T11:02:00Z',
    },
  ];

  const ledger: LedgerEntryRecord[] = [
    {
      id: 'led-init-1',
      flatId: 'flat-t07-1203',
      entryType: 'BILL',
      amountPaise: 747500,
      description: 'Monthly Maintenance November 2026',
      createdAt: '2026-11-01T00:00:00Z',
    },
    {
      id: 'led-init-2',
      flatId: 'flat-t07-1203',
      entryType: 'PAYMENT',
      amountPaise: 747500,
      description: 'Online Payment (Ref: MOCK-UPI-98201)',
      reference: 'MOCK-UPI-98201',
      createdAt: '2026-11-01T10:01:00Z',
    },
    {
      id: 'led-init-3',
      flatId: 'flat-t12-0408',
      entryType: 'BILL',
      amountPaise: 637000,
      description: 'Monthly Maintenance November 2026',
      createdAt: '2026-11-01T00:00:00Z',
    },
    {
      id: 'led-init-4',
      flatId: 'flat-t12-0408',
      entryType: 'LATE_FEE',
      amountPaise: 62000,
      description: 'Overdue interest penalty (47 days overdue, demo policy)',
      createdAt: '2026-11-01T00:00:00Z',
    },
    {
      id: 'led-init-5',
      flatId: 'flat-t21-1601',
      entryType: 'BILL',
      amountPaise: 1066000,
      description: 'Monthly Maintenance November 2026',
      createdAt: '2026-11-01T00:00:00Z',
    },
    {
      id: 'led-init-6',
      flatId: 'flat-t21-1601',
      entryType: 'LATE_FEE',
      amountPaise: 33000,
      description: 'Overdue interest penalty (18 days overdue, demo policy)',
      createdAt: '2026-11-01T00:00:00Z',
    },
    {
      id: 'led-init-7',
      flatId: 'flat-t21-1601',
      entryType: 'PAYMENT',
      amountPaise: 500000,
      description: 'Partial payment received (Ref: MOCK-UPI-98202)',
      reference: 'MOCK-UPI-98202',
      createdAt: '2026-11-03T11:02:00Z',
    },
  ];

  // Initial demo seed transactions
  const initialBankTransactions: ReconciledTransaction[] = [
    {
      id: 'txn-seed-1',
      transaction: {
        id: 'txn-seed-1',
        rowNumber: 2,
        rawRow: '2026-11-02,7475.00,UPI20261102001,neeraj@oksbi,Maintenance payment for T07-1203 Neeraj Kulkarni',
        transactionDate: '2026-11-02T10:15:00.000Z',
        amountPaise: 747500,
        reference: 'UPI20261102001',
        upiId: 'neeraj@oksbi',
        description: 'Maintenance payment for T07-1203 Neeraj Kulkarni',
        isDuplicateInBatch: false,
      },
      status: 'SUGGESTED',
      suggestedMatch: {
        invoiceId: 'inv-t07-1203-202611',
        flatIdentifier: 'T07-1203',
        candidateInvoice: {
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
        candidateFlat: {
          flatId: 'flat-t07-1203',
          tower: 'T07',
          flatNumber: '1203',
          residentName: 'Neeraj Kulkarni',
        },
        confidence: 0.95,
        matchingReasons: [
          'Exact flat code "T07-1203" found in narration (+35 pts)',
          'Exact amount match: ₹7475.00 (+25 pts)',
          'Resident name "Neeraj Kulkarni" found in narration (+20 pts)',
          'Registered resident UPI ID match: "neeraj@oksbi" (+15 pts)',
        ],
        missingEvidence: ['Missing: Transaction date outside invoice month'],
      },
      alternativeMatches: [],
      isAmbiguous: false,
    },
    {
      id: 'txn-seed-2',
      transaction: {
        id: 'txn-seed-2',
        rowNumber: 3,
        rawRow: '2026-11-03,6370.00,NEFT20261103002,,Axis Bank transfer Swati rent',
        transactionDate: '2026-11-03T16:45:00.000Z',
        amountPaise: 637000,
        reference: 'NEFT20261103002',
        upiId: null,
        description: 'Axis Bank transfer Swati rent',
        isDuplicateInBatch: false,
      },
      status: 'NEEDS_REVIEW',
      suggestedMatch: {
        invoiceId: 'inv-t12-0408-202611',
        flatIdentifier: 'T12-0408',
        candidateInvoice: {
          id: 'inv-t12-0408-202611',
          flatId: 'flat-t12-0408',
          tower: 'T12',
          flatNumber: '0408',
          residentName: 'Swati Joshi',
          residentUpi: null,
          totalAmountPaise: 699000,
          paidAmountPaise: 0,
          balancePaise: 699000,
          dueDate: '2026-09-24T00:00:00Z',
          status: 'OVERDUE',
        },
        candidateFlat: {
          flatId: 'flat-t12-0408',
          tower: 'T12',
          flatNumber: '0408',
          residentName: 'Swati Joshi',
        },
        confidence: 0.45,
        matchingReasons: ['Resident name "Swati Joshi" found in narration (+20 pts)'],
        missingEvidence: [
          'Missing: Flat identifier (T12-0408) not found in narration',
          'Missing: Amount (₹6370.00) does not match invoice balance (₹6990.00)',
          'Missing: Registered resident UPI ID match',
        ],
      },
      alternativeMatches: [],
      isAmbiguous: true,
    },
  ];

  return {
    invoices,
    payments,
    receipts,
    ledger,
    bankBatches: [
      {
        id: 'batch-seed-01',
        filename: 'sample_bank_statement.csv',
        fileHash: 'seed-hash-01',
        uploadedAt: '2026-11-02T10:00:00Z',
        totalRows: 4,
        processedRows: 4,
        duplicateRows: 1,
        invalidRows: 0,
        rowErrors: [],
      },
    ],
    bankTransactions: initialBankTransactions,
  };
}

class SocietyStore {
  private state: SocietyState;

  constructor() {
    this.state = this.loadFromDisk();
  }

  private loadFromDisk(): SocietyState {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const raw = fs.readFileSync(STATE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.bankBatches && parsed.bankTransactions) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read state file, initializing from seed.', e);
    }
    const seed = getInitialSeedState();
    this.saveToDisk(seed);
    return seed;
  }

  private saveToDisk(data: SocietyState): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to write state to disk:', e);
    }
  }

  public reset(): void {
    this.state = getInitialSeedState();
    this.saveToDisk(this.state);
  }

  public getInvoices(): InvoiceRecord[] {
    return this.state.invoices;
  }

  public getInvoiceById(id: string): InvoiceRecord | undefined {
    return this.state.invoices.find((inv) => inv.id === id);
  }

  public getPayments(): PaymentRecord[] {
    return this.state.payments;
  }

  public getPaymentByIdempotencyKey(key: string): PaymentRecord | undefined {
    return this.state.payments.find((p) => p.idempotencyKey === key);
  }

  public savePayment(payment: PaymentRecord): void {
    const idx = this.state.payments.findIndex(
      (p) => p.id === payment.id || p.idempotencyKey === payment.idempotencyKey
    );
    if (idx >= 0) {
      this.state.payments[idx] = payment;
    } else {
      this.state.payments.push(payment);
    }
    this.saveToDisk(this.state);
  }

  public getReceipts(): ReceiptRecord[] {
    return this.state.receipts;
  }

  public getReceiptById(id: string): ReceiptRecord | undefined {
    return this.state.receipts.find((r) => r.id === id);
  }

  public getReceiptsByFlatId(flatId: string): ReceiptRecord[] {
    return this.state.receipts.filter((r) => r.flatId === flatId);
  }

  public saveReceipt(receipt: ReceiptRecord): void {
    this.state.receipts.unshift(receipt);
    this.saveToDisk(this.state);
  }

  public getLedger(flatId: string): LedgerEntryRecord[] {
    return this.state.ledger.filter((entry) => entry.flatId === flatId);
  }

  public addLedgerEntry(entry: LedgerEntryRecord): void {
    this.state.ledger.push(entry);
    this.saveToDisk(this.state);
  }

  public updateInvoice(invoice: InvoiceRecord): void {
    const idx = this.state.invoices.findIndex((inv) => inv.id === invoice.id);
    if (idx >= 0) {
      this.state.invoices[idx] = invoice;
      this.saveToDisk(this.state);
    }
  }

  // Bank Reconciliation Batch & Transactions methods
  public getBankBatches(): BankImportBatchRecord[] {
    return this.state.bankBatches;
  }

  public getBankBatchByHash(fileHash: string): BankImportBatchRecord | undefined {
    return this.state.bankBatches.find((b) => b.fileHash === fileHash);
  }

  public saveBankBatch(batch: BankImportBatchRecord): void {
    this.state.bankBatches.unshift(batch);
    this.saveToDisk(this.state);
  }

  public getBankTransactions(): ReconciledTransaction[] {
    return this.state.bankTransactions;
  }

  public getBankTransactionById(id: string): ReconciledTransaction | undefined {
    return this.state.bankTransactions.find((t) => t.id === id || t.transaction.reference === id);
  }

  public saveBankTransactions(txns: ReconciledTransaction[]): void {
    this.state.bankTransactions = [...txns, ...this.state.bankTransactions];
    this.saveToDisk(this.state);
  }

  public updateBankTransaction(txn: ReconciledTransaction): void {
    const idx = this.state.bankTransactions.findIndex((t) => t.id === txn.id);
    if (idx >= 0) {
      this.state.bankTransactions[idx] = txn;
      this.saveToDisk(this.state);
    }
  }

  /**
   * Atomically posts a confirmed reconciled bank transaction into the flat ledger.
   * Updates invoice, creates payment, creates receipt, appends ledger entry, and marks txn as POSTED.
   */
  public postBankTransaction(
    txnId: string,
    invoiceId: string,
    actor: string = 'Accounts Officer'
  ): {
    transaction: ReconciledTransaction;
    invoice: InvoiceRecord;
    payment: PaymentRecord;
    receipt: ReceiptRecord;
    ledgerEntry: LedgerEntryRecord;
  } {
    const txn = this.state.bankTransactions.find((t) => t.id === txnId || t.transaction.reference === txnId);
    if (!txn) {
      throw new Error(`Bank transaction with ID/Reference "${txnId}" not found.`);
    }

    if (txn.status === 'POSTED') {
      throw new Error(`Transaction with reference "${txn.transaction.reference}" is already posted.`);
    }

    if (txn.status === 'DUPLICATE') {
      throw new Error(`Cannot post duplicate transaction "${txn.transaction.reference}".`);
    }

    const invoice = this.state.invoices.find((i) => i.id === invoiceId);
    if (!invoice) {
      throw new Error(`Target invoice "${invoiceId}" not found for posting.`);
    }

    // Check duplicate reference in payments history
    const existingRefPayment = this.state.payments.find(
      (p) => p.providerReference === txn.transaction.reference && p.status === 'SUCCESS'
    );
    if (existingRefPayment) {
      throw new Error(`Payment with reference "${txn.transaction.reference}" has already been posted.`);
    }

    // Create payment record
    const payment: PaymentRecord = {
      id: `pay-recon-${Date.now()}`,
      invoiceId: invoice.id,
      flatId: invoice.flatId,
      amountPaise: txn.transaction.amountPaise,
      idempotencyKey: `idemp-recon-${txn.transaction.reference}`,
      provider: 'BANK_RECONCILIATION',
      providerReference: txn.transaction.reference,
      status: 'SUCCESS',
      createdAt: txn.transaction.transactionDate,
      paidAt: new Date().toISOString(),
    };

    // Create receipt
    const receiptNumber = `REC-202611-${String(this.state.receipts.length + 1).padStart(4, '0')}`;
    const receipt: ReceiptRecord = {
      id: `rec-${Date.now()}`,
      receiptNumber,
      paymentId: payment.id,
      invoiceId: invoice.id,
      flatId: invoice.flatId,
      flatIdentifier: `${invoice.tower}-${invoice.flatNumber}`,
      residentName: invoice.residentName,
      billingPeriod: invoice.billingPeriod === '2026-11' ? 'November 2026' : invoice.billingPeriod,
      amountPaise: txn.transaction.amountPaise,
      paymentReference: txn.transaction.reference,
      date: new Date().toISOString(),
    };
    payment.receiptId = receipt.id;

    // Update target invoice
    invoice.paidAmountPaise += txn.transaction.amountPaise;
    invoice.remainingBalancePaise = Math.max(0, invoice.totalAmountPaise - invoice.paidAmountPaise);
    invoice.status = invoice.remainingBalancePaise === 0 ? 'PAID' : 'PARTIALLY_PAID';

    // Append to flat ledger
    const ledgerEntry: LedgerEntryRecord = {
      id: `led-${Date.now()}`,
      flatId: invoice.flatId,
      entryType: 'PAYMENT',
      amountPaise: txn.transaction.amountPaise,
      description: `Bank Reconciliation Match (Ref: ${txn.transaction.reference} • ${actor})`,
      reference: txn.transaction.reference,
      createdAt: new Date().toISOString(),
    };

    // Transition transaction status
    txn.status = 'POSTED';
    txn.selectedInvoiceId = invoice.id;
    txn.postedPaymentId = payment.id;
    txn.postedAt = new Date().toISOString();

    // Persist all modifications to disk atomically
    this.state.payments.push(payment);
    this.state.receipts.unshift(receipt);
    this.state.ledger.push(ledgerEntry);
    this.saveToDisk(this.state);

    return { transaction: txn, invoice, payment, receipt, ledgerEntry };
  }
}

export const societyStore = new SocietyStore();
