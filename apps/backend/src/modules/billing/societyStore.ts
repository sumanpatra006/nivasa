import fs from 'fs';
import path from 'path';
import { calculateMaintenancePaise, calculateLateFeePaise } from '@nivasa/shared';

export interface InvoiceRecord {
  id: string;
  flatId: string;
  tower: string;
  flatNumber: string;
  residentName: string;
  residentPhone: string;
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

export interface SocietyState {
  invoices: InvoiceRecord[];
  payments: PaymentRecord[];
  receipts: ReceiptRecord[];
  ledger: LedgerEntryRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'society_state.json');

/**
 * Authoritative Initial Seed Records strictly conforming to TDD.md Section 5
 */
export function getInitialSeedState(): SocietyState {
  // Flat 1: T07-1203 (Neeraj Kulkarni)
  // Area 1,150 sq ft * 650 = 747,500 paise (₹7,475), Paid 747,500 paise, 0 overdue
  const inv1Base = calculateMaintenancePaise(1150, 650);
  const inv1Late = calculateLateFeePaise(0);
  const inv1Total = inv1Base + inv1Late;

  // Flat 2: T12-0408 (Swati Joshi, Tenant)
  // Area 980 sq ft * 650 = 637,000 paise (₹6,370), Paid 0 paise, 47 days overdue
  // Demo late fee: 47 days -> 25,000 + 37 * 1,000 = 62,000 paise (₹620)
  const inv2Base = calculateMaintenancePaise(980, 650);
  const inv2Late = calculateLateFeePaise(47);
  const inv2Total = inv2Base + inv2Late;

  // Flat 3: T21-1601 (Aamir Shaikh)
  // Area 1,640 sq ft * 650 = 1,066,000 paise (₹10,660), Paid 500,000 paise, 18 days overdue
  // Demo late fee: 18 days -> 25,000 + 8 * 1,000 = 33,000 paise (₹330)
  const inv3Base = calculateMaintenancePaise(1640, 650);
  const inv3Late = calculateLateFeePaise(18);
  const inv3Total = inv3Base + inv3Late;

  return {
    invoices: [
      {
        id: 'inv-t07-1203-202611',
        flatId: 'flat-t07-1203',
        tower: 'T07',
        flatNumber: '1203',
        residentName: 'Neeraj Kulkarni',
        residentPhone: '9820000001',
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
    ],
    payments: [
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
    ],
    receipts: [
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
    ],
    ledger: [
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
    ],
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
        return JSON.parse(raw);
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
    const idx = this.state.payments.findIndex((p) => p.id === payment.id || p.idempotencyKey === payment.idempotencyKey);
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
}

export const societyStore = new SocietyStore();
