import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  calculateMaintenancePaise,
  calculateLateFeePaise,
  ComplaintCategory,
  ComplaintUrgency,
  ComplaintStatus,
  COMPLAINT_CATEGORY,
  COMPLAINT_URGENCY,
  COMPLAINT_STATUS,
} from '@nivasa/shared';
import type { ReconciledTransaction } from '../reconciliation/reconciliationEngine.js';

export interface ComplaintRating {
  stars: number;
  feedback?: string;
  ratedAt: string;
}

export interface ComplaintDuplicateSuggestion {
  candidateId: string;
  candidateTitle: string;
  candidateFlat: string;
  candidateStatus: string;
  confidence: number;
  matchingFactors: string[];
}

export interface ComplaintRecord {
  id: string;
  residentId: string;
  residentName: string;
  residentPhone?: string;
  flatId: string;
  tower: string;
  flatNumber: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  originalCategory?: ComplaintCategory;
  urgency: ComplaintUrgency;
  originalUrgency?: ComplaintUrgency;
  status: ComplaintStatus;
  assignedTo?: string | null;
  photoUrl?: string | null;
  rating?: ComplaintRating | null;
  isSafetyEscalation: boolean;
  safetyReason?: string | null;
  dutyManagerAlerted: boolean;
  isAiFallback: boolean;
  aiConfidence?: number;
  aiSuggestedTeam?: string;
  aiExplanation?: string;
  duplicateOfId?: string | null;
  duplicateLinks: string[];
  duplicateSuggestions: ComplaintDuplicateSuggestion[];
  reopenCount: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  resolutionComment?: string | null;
  timeline: Array<{
    id: string;
    message: string;
    actor?: string;
    createdAt: string;
  }>;
}

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

export interface VisitorRecord {
  id: string;
  clientUuid?: string;
  flatId: string;
  tower: string;
  flatNumber: string;
  residentId?: string;
  residentName?: string;
  visitorName: string;
  visitorPhone?: string;
  visitorPhotoKey?: string | null;
  purpose: string;
  vehicleNumber?: string;
  expectedAt?: string | null;
  arrivedAt?: string | null;
  departedAt?: string | null;
  approvalStatus: 'PENDING' | 'APPROVED' | 'DENIED' | 'NOT_REQUIRED';
  entryStatus: 'EXPECTED' | 'CHECKED_IN' | 'CHECKED_OUT';
  photoRetainUntil?: string | null;
  recordedAt: string;
  createdAt: string;
}

export interface GuestCodeRecord {
  id: string;
  flatId: string;
  tower: string;
  flatNumber: string;
  guestName: string;
  purpose?: string;
  codeHash: string;
  codeMasked: string;
  codePlain?: string;
  validFrom: string;
  validUntil: string;
  usageLimit: number;
  usageCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface AmenityRecord {
  id: string;
  name: string;
  description: string;
  rules: string;
  feePaise: number;
  capacity: number;
  openTime: string;
  closeTime: string;
  slotDurationMinutes: number;
  isActive: boolean;
  isDemoFee: boolean;
}

export interface AmenityBookingRecord {
  id: string;
  amenityId: string;
  amenityName: string;
  flatId: string;
  flatIdentifier: string;
  residentId: string;
  residentName: string;
  startAt: string;
  endAt: string;
  feePaise: number;
  status: 'CONFIRMED' | 'CANCELLED';
  cancelledAt?: string | null;
  createdAt: string;
}

export interface SocietyState {
  invoices: InvoiceRecord[];
  payments: PaymentRecord[];
  receipts: ReceiptRecord[];
  ledger: LedgerEntryRecord[];
  bankBatches: BankImportBatchRecord[];
  bankTransactions: ReconciledTransaction[];
  complaints: ComplaintRecord[];
  visitors: VisitorRecord[];
  guestCodes: GuestCodeRecord[];
  amenities: AmenityRecord[];
  amenityBookings: AmenityBookingRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'society_state.json');
const PHOTOS_DIR = path.resolve(DATA_DIR, 'photos', 'visitors');

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

  const initialComplaints: ComplaintRecord[] = [
    {
      id: 'cmp-01',
      residentId: 'user-9820000002',
      residentName: 'Swati Joshi',
      residentPhone: '9820000002',
      flatId: 'flat-t12-0408',
      tower: 'T12',
      flatNumber: '0408',
      title: 'Water leakage in master bathroom',
      description: 'Continuous slow drip under the washbasin pipe damaging wooden cabinet.',
      category: COMPLAINT_CATEGORY.PLUMBING,
      urgency: COMPLAINT_URGENCY.NORMAL,
      status: COMPLAINT_STATUS.ASSIGNED,
      assignedTo: 'Plumbing Duty Team (Santosh Shinde)',
      photoUrl: null,
      rating: null,
      isSafetyEscalation: false,
      safetyReason: null,
      dutyManagerAlerted: false,
      isAiFallback: true,
      aiConfidence: 0.88,
      aiSuggestedTeam: 'Plumbing Duty Team (Santosh Shinde)',
      aiExplanation: 'Deterministic rule-based classification matched keywords: [water, leak, pipe, washbasin].',
      duplicateOfId: null,
      duplicateLinks: [],
      duplicateSuggestions: [],
      reopenCount: 0,
      createdAt: '2026-11-01T08:30:00Z',
      updatedAt: '2026-11-01T09:15:00Z',
      timeline: [
        {
          id: 'tl-cmp1-1',
          message: 'Complaint registered by resident Swati Joshi',
          actor: 'Swati Joshi',
          createdAt: '2026-11-01T08:30:00Z',
        },
        {
          id: 'tl-cmp1-2',
          message: 'Assigned to Plumbing Duty Team (Santosh Shinde) by Ramesh Sawant',
          actor: 'Ramesh Sawant',
          createdAt: '2026-11-01T09:15:00Z',
        },
      ],
    },
    {
      id: 'cmp-02',
      residentId: 'user-9820000001',
      residentName: 'Neeraj Kulkarni',
      residentPhone: '9820000001',
      flatId: 'flat-t07-1203',
      tower: 'T07',
      flatNumber: '1203',
      title: 'Emergency: Lift #2 stuck between 8th and 9th floor',
      description: 'Passenger elevator stopped abruptly with passengers inside. Emergency alarm sounding.',
      category: COMPLAINT_CATEGORY.LIFT,
      urgency: COMPLAINT_URGENCY.CRITICAL,
      status: COMPLAINT_STATUS.ASSIGNED,
      assignedTo: 'Lift Emergency Tech (OTIS)',
      photoUrl: null,
      rating: null,
      isSafetyEscalation: true,
      safetyReason: 'Automated safety override triggered due to matching safety indicators: [lift stuck]',
      dutyManagerAlerted: true,
      isAiFallback: true,
      aiConfidence: 0.95,
      aiSuggestedTeam: 'Lift Emergency Tech (OTIS)',
      aiExplanation: 'Emergency safety classifier triggered critical escalation.',
      duplicateOfId: null,
      duplicateLinks: [],
      duplicateSuggestions: [],
      reopenCount: 0,
      createdAt: '2026-11-03T10:00:00Z',
      updatedAt: '2026-11-03T10:05:00Z',
      timeline: [
        {
          id: 'tl-cmp2-1',
          message: 'Emergency ticket registered by resident Neeraj Kulkarni',
          actor: 'Neeraj Kulkarni',
          createdAt: '2026-11-03T10:00:00Z',
        },
        {
          id: 'tl-cmp2-2',
          message: 'AUTOMATED SAFETY ESCALATION TRIGGERED: lift stuck. Duty Manager alerted for immediate dispatch.',
          actor: 'System Safety Monitor',
          createdAt: '2026-11-03T10:00:01Z',
        },
        {
          id: 'tl-cmp2-3',
          message: 'Dispatched to OTIS Lift Emergency Tech by Ramesh Sawant',
          actor: 'Ramesh Sawant',
          createdAt: '2026-11-03T10:05:00Z',
        },
      ],
    },
  ];

  const initialAmenities: AmenityRecord[] = [
    {
      id: 'amen-1',
      name: 'Main Clubhouse Hall',
      description: 'Air-conditioned community hall suitable for society gatherings, private events, and celebrations.',
      rules: 'Quiet hours start at 10 PM. Music restricted to 65 dB. Host flat responsible for mandatory cleanup within 2 hours of event conclusion. (Demo fee & guidelines)',
      feePaise: 500000, // ₹5,000 demo fee
      capacity: 150,
      openTime: '09:00',
      closeTime: '23:00',
      slotDurationMinutes: 120,
      isActive: true,
      isDemoFee: true,
    },
    {
      id: 'amen-2',
      name: 'Tennis Court 1',
      description: 'Floodlit synthetic hard court with standard markings and net.',
      rules: 'Non-marking tennis shoes compulsory. Maximum 1-hour active slot per flat per day. Bring own racquets and balls. (Demo fee & guidelines)',
      feePaise: 20000, // ₹200 demo fee
      capacity: 4,
      openTime: '06:00',
      closeTime: '21:00',
      slotDurationMinutes: 60,
      isActive: true,
      isDemoFee: true,
    },
    {
      id: 'amen-3',
      name: 'Badminton Court A',
      description: 'Indoor wooden flooring court with tournament regulation lighting.',
      rules: 'Strictly gum-sole or indoor sports shoes. Turn off lights upon slot completion. No food or beverages on playing area. (Demo fee & guidelines)',
      feePaise: 15000, // ₹150 demo fee
      capacity: 4,
      openTime: '06:00',
      closeTime: '22:00',
      slotDurationMinutes: 60,
      isActive: true,
      isDemoFee: true,
    },
    {
      id: 'amen-4',
      name: 'Swimming Pool',
      description: 'Semi-Olympic 25-meter temperature-monitored pool with designated kiddie pool.',
      rules: 'Proper synthetic swimwear mandatory. Shower prior to entry. Children under 12 must be accompanied by an adult guardian at all times. (Demo fee & guidelines)',
      feePaise: 0, // Complimentary
      capacity: 25,
      openTime: '06:00',
      closeTime: '20:00',
      slotDurationMinutes: 60,
      isActive: true,
      isDemoFee: true,
    },
    {
      id: 'amen-5',
      name: 'Gymnasium & Fitness Center',
      description: 'Full-range cardio, free weights, and resistance equipment.',
      rules: 'Personal sweat towel mandatory. Sanitize equipment grips after use. Maximum 30 minutes on cardio machines during peak hours. (Demo fee & guidelines)',
      feePaise: 0, // Complimentary
      capacity: 20,
      openTime: '06:00',
      closeTime: '22:00',
      slotDurationMinutes: 60,
      isActive: true,
      isDemoFee: true,
    },
  ];

  const initialVisitors: VisitorRecord[] = [
    {
      id: 'vis-seed-01',
      flatId: 'flat-t07-1203',
      tower: 'T07',
      flatNumber: '1203',
      residentName: 'Neeraj Kulkarni',
      visitorName: 'Sunil Verma',
      visitorPhone: '9820009901',
      visitorPhotoKey: 'sample_visitor_sunil.jpg',
      purpose: 'Amazon Courier Delivery',
      vehicleNumber: 'MH02-EK-4581',
      arrivedAt: '2026-11-09T10:15:00.000Z',
      departedAt: '2026-11-09T10:22:00.000Z',
      approvalStatus: 'APPROVED',
      entryStatus: 'CHECKED_OUT',
      photoRetainUntil: new Date(Date.now() + 85 * 24 * 60 * 60 * 1000).toISOString(),
      recordedAt: '2026-11-09T10:15:00.000Z',
      createdAt: '2026-11-09T10:15:00.000Z',
    },
    {
      id: 'vis-seed-02',
      flatId: 'flat-t07-1203',
      tower: 'T07',
      flatNumber: '1203',
      residentName: 'Neeraj Kulkarni',
      visitorName: 'Priya Sharma',
      visitorPhone: '9820009902',
      visitorPhotoKey: 'sample_visitor_priya.jpg',
      purpose: 'Personal Guest',
      vehicleNumber: 'MH01-CV-7890',
      arrivedAt: '2026-11-09T11:30:00.000Z',
      departedAt: null,
      approvalStatus: 'APPROVED',
      entryStatus: 'CHECKED_IN',
      photoRetainUntil: new Date(Date.now() + 88 * 24 * 60 * 60 * 1000).toISOString(),
      recordedAt: '2026-11-09T11:30:00.000Z',
      createdAt: '2026-11-09T11:30:00.000Z',
    },
    {
      id: 'vis-seed-03',
      flatId: 'flat-t12-0408',
      tower: 'T12',
      flatNumber: '0408',
      residentName: 'Swati Joshi',
      visitorName: 'Rajesh Carpenter',
      visitorPhone: '9820009903',
      visitorPhotoKey: 'sample_visitor_rajesh.jpg',
      purpose: 'Carpentry Maintenance Work',
      vehicleNumber: '',
      arrivedAt: '2026-11-09T12:00:00.000Z',
      departedAt: null,
      approvalStatus: 'PENDING',
      entryStatus: 'EXPECTED',
      photoRetainUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      recordedAt: '2026-11-09T12:00:00.000Z',
      createdAt: '2026-11-09T12:00:00.000Z',
    },
  ];

  const initialGuestCodes: GuestCodeRecord[] = [
    {
      id: 'gc-seed-01',
      flatId: 'flat-t07-1203',
      tower: 'T07',
      flatNumber: '1203',
      guestName: 'Kavita Kulkarni',
      purpose: 'Weekend Family Visit',
      codeHash: crypto.createHash('sha256').update('842619').digest('hex'),
      codeMasked: '84****',
      codePlain: '842619',
      validFrom: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      validUntil: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      usageLimit: 2,
      usageCount: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ];

  const initialAmenityBookings: AmenityBookingRecord[] = [
    {
      id: 'amen-book-01',
      amenityId: 'amen-2',
      amenityName: 'Tennis Court 1',
      flatId: 'flat-t21-1601',
      flatIdentifier: 'T21-1601',
      residentId: 'user-resident-aamir',
      residentName: 'Aamir Shaikh',
      startAt: '2026-11-10T07:00:00.000Z',
      endAt: '2026-11-10T08:00:00.000Z',
      feePaise: 20000,
      status: 'CONFIRMED',
      createdAt: '2026-11-08T18:00:00.000Z',
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
    complaints: initialComplaints,
    visitors: initialVisitors,
    guestCodes: initialGuestCodes,
    amenities: initialAmenities,
    amenityBookings: initialAmenityBookings,
  };
}

class SocietyStore {
  private state: SocietyState;

  constructor() {
    this.ensurePhotosDirectory();
    this.state = this.loadFromDisk();
  }

  private ensurePhotosDirectory(): void {
    try {
      if (!fs.existsSync(PHOTOS_DIR)) {
        fs.mkdirSync(PHOTOS_DIR, { recursive: true });
      }
      // Create seed dummy photo files if not existing so retention tests have physical files
      const seedPhotos = ['sample_visitor_sunil.jpg', 'sample_visitor_priya.jpg', 'sample_visitor_rajesh.jpg'];
      for (const p of seedPhotos) {
        const fullPath = path.join(PHOTOS_DIR, p);
        if (!fs.existsSync(fullPath)) {
          fs.writeFileSync(fullPath, 'DUMMY_VISITOR_PHOTO_DATA_FOR_SIMULATION_PURPOSES');
        }
      }
    } catch (e) {
      console.warn('Could not ensure photos directory', e);
    }
  }

  private loadFromDisk(): SocietyState {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const raw = fs.readFileSync(STATE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.bankBatches && parsed.bankTransactions) {
          const seed = getInitialSeedState();
          if (!parsed.complaints || !Array.isArray(parsed.complaints)) {
            parsed.complaints = seed.complaints;
          }
          if (!parsed.visitors || !Array.isArray(parsed.visitors)) {
            parsed.visitors = seed.visitors;
          }
          if (!parsed.guestCodes || !Array.isArray(parsed.guestCodes)) {
            parsed.guestCodes = seed.guestCodes;
          }
          if (!parsed.amenities || !Array.isArray(parsed.amenities)) {
            parsed.amenities = seed.amenities;
          }
          if (!parsed.amenityBookings || !Array.isArray(parsed.amenityBookings)) {
            parsed.amenityBookings = seed.amenityBookings;
          }
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

  // Complaints Access and Mutation Methods
  public getComplaints(): ComplaintRecord[] {
    return this.state.complaints;
  }

  public getComplaintById(id: string): ComplaintRecord | undefined {
    return this.state.complaints.find((c) => c.id === id);
  }

  public addComplaint(complaint: ComplaintRecord): ComplaintRecord {
    this.state.complaints.unshift(complaint);
    this.saveToDisk(this.state);
    return complaint;
  }

  public updateComplaint(id: string, updates: Partial<ComplaintRecord>): ComplaintRecord {
    const complaint = this.state.complaints.find((c) => c.id === id);
    if (!complaint) {
      throw new Error(`Complaint ${id} not found.`);
    }
    Object.assign(complaint, updates, { updatedAt: new Date().toISOString() });
    this.saveToDisk(this.state);
    return complaint;
  }

  // ==========================================
  // Visitors Access and Mutation Methods
  // ==========================================
  public getVisitors(flatId?: string): VisitorRecord[] {
    if (flatId) {
      return this.state.visitors.filter((v) => v.flatId === flatId);
    }
    return this.state.visitors;
  }

  public getVisitorById(id: string): VisitorRecord | undefined {
    return this.state.visitors.find((v) => v.id === id);
  }

  public addVisitor(data: {
    clientUuid?: string;
    flatId: string;
    visitorName: string;
    visitorPhone?: string;
    purpose: string;
    vehicleNumber?: string;
    photoBase64?: string;
    visitorPhotoKey?: string;
    preApprovedCode?: string;
    recordedAt?: string;
    approvalStatus?: 'PENDING' | 'APPROVED' | 'DENIED' | 'NOT_REQUIRED';
    entryStatus?: 'EXPECTED' | 'CHECKED_IN' | 'CHECKED_OUT';
  }): VisitorRecord {
    // Deduplication via clientUuid for offline sync
    if (data.clientUuid) {
      const existing = this.state.visitors.find((v) => v.clientUuid === data.clientUuid);
      if (existing) {
        return existing;
      }
    }

    // Resolve flat details
    let tower = 'T07';
    let flatNumber = '1203';
    let residentName = 'Neeraj Kulkarni';
    if (data.flatId === 'flat-t12-0408') {
      tower = 'T12';
      flatNumber = '0408';
      residentName = 'Swati Joshi';
    } else if (data.flatId === 'flat-t21-1601') {
      tower = 'T21';
      flatNumber = '1601';
      residentName = 'Aamir Shaikh';
    }

    let photoKey = data.visitorPhotoKey || null;
    if (data.photoBase64) {
      try {
        const filename = `vis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
        const filePath = path.join(PHOTOS_DIR, filename);
        // Write simulated image buffer or data
        const base64Data = data.photoBase64.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        photoKey = filename;
      } catch (err) {
        console.warn('Could not save visitor photo file:', err);
        photoKey = 'photo-stub.jpg';
      }
    }

    const now = new Date().toISOString();
    const entryStatus = data.entryStatus || 'CHECKED_IN';
    const isCheckedIn = entryStatus === 'CHECKED_IN';

    const newVisitor: VisitorRecord = {
      id: `vis-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      clientUuid: data.clientUuid,
      flatId: data.flatId,
      tower,
      flatNumber,
      residentName,
      visitorName: data.visitorName,
      visitorPhone: data.visitorPhone,
      visitorPhotoKey: photoKey,
      purpose: data.purpose,
      vehicleNumber: data.vehicleNumber,
      arrivedAt: isCheckedIn ? (data.recordedAt || now) : null,
      departedAt: null,
      approvalStatus: data.approvalStatus || (data.preApprovedCode ? 'APPROVED' : 'PENDING'),
      entryStatus,
      photoRetainUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      recordedAt: data.recordedAt || now,
      createdAt: now,
    };

    this.state.visitors.unshift(newVisitor);
    this.saveToDisk(this.state);
    return newVisitor;
  }

  public updateVisitorApproval(id: string, status: 'APPROVED' | 'DENIED'): VisitorRecord {
    const visitor = this.state.visitors.find((v) => v.id === id);
    if (!visitor) {
      throw new Error(`Visitor ${id} not found.`);
    }
    visitor.approvalStatus = status;
    this.saveToDisk(this.state);
    return visitor;
  }

  public recordVisitorEntry(id: string): VisitorRecord {
    const visitor = this.state.visitors.find((v) => v.id === id);
    if (!visitor) {
      throw new Error(`Visitor ${id} not found.`);
    }
    visitor.arrivedAt = new Date().toISOString();
    visitor.entryStatus = 'CHECKED_IN';
    this.saveToDisk(this.state);
    return visitor;
  }

  public recordVisitorExit(id: string): VisitorRecord {
    const visitor = this.state.visitors.find((v) => v.id === id);
    if (!visitor) {
      throw new Error(`Visitor ${id} not found.`);
    }
    visitor.departedAt = new Date().toISOString();
    visitor.entryStatus = 'CHECKED_OUT';
    this.saveToDisk(this.state);
    return visitor;
  }

  public batchSyncVisitors(items: Array<any>): {
    syncedCount: number;
    totalReceived: number;
    visitors: VisitorRecord[];
  } {
    const synced: VisitorRecord[] = [];
    for (const item of items) {
      const v = this.addVisitor(item);
      synced.push(v);
    }
    return {
      syncedCount: synced.length,
      totalReceived: items.length,
      visitors: synced,
    };
  }

  public purgeExpiredVisitorPhotos(): {
    message: string;
    purgedPhotosCount: number;
    purgedFiles: string[];
    complianceStatus: string;
  } {
    const now = Date.now();
    let purgedCount = 0;
    const purgedFiles: string[] = [];

    for (const v of this.state.visitors) {
      if (v.photoRetainUntil && new Date(v.photoRetainUntil).getTime() < now && v.visitorPhotoKey) {
        const filePath = path.join(PHOTOS_DIR, v.visitorPhotoKey);
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            purgedFiles.push(v.visitorPhotoKey);
          }
        } catch (e) {
          console.warn(`Failed to unlink photo file ${filePath}:`, e);
        }
        v.visitorPhotoKey = null;
        purgedCount++;
      }
    }

    this.saveToDisk(this.state);
    return {
      message: 'DPDP 90-day retention purge completed',
      purgedPhotosCount: purgedCount,
      purgedFiles,
      complianceStatus: 'DPDP_ACT_2023_COMPLIANT',
    };
  }

  // ==========================================
  // Guest Pass Codes Access and Mutation
  // ==========================================
  public getGuestCodes(flatId?: string): GuestCodeRecord[] {
    if (flatId) {
      return this.state.guestCodes.filter((gc) => gc.flatId === flatId);
    }
    return this.state.guestCodes;
  }

  public createGuestCode(data: {
    flatId: string;
    guestName: string;
    purpose?: string;
    validFrom?: string;
    validUntil: string;
    usageLimit?: number;
  }): GuestCodeRecord {
    let tower = 'T07';
    let flatNumber = '1203';
    if (data.flatId === 'flat-t12-0408') {
      tower = 'T12';
      flatNumber = '0408';
    } else if (data.flatId === 'flat-t21-1601') {
      tower = 'T21';
      flatNumber = '1601';
    }

    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = crypto.createHash('sha256').update(pin).digest('hex');

    const newCode: GuestCodeRecord = {
      id: `gc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      flatId: data.flatId,
      tower,
      flatNumber,
      guestName: data.guestName,
      purpose: data.purpose || 'Guest Visit',
      codeHash,
      codeMasked: `${pin.slice(0, 2)}****`,
      codePlain: pin,
      validFrom: data.validFrom || new Date().toISOString(),
      validUntil: data.validUntil,
      usageLimit: data.usageLimit || 1,
      usageCount: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    this.state.guestCodes.unshift(newCode);
    this.saveToDisk(this.state);
    return newCode;
  }

  public validateGuestCode(pin: string): {
    isValid: boolean;
    reason?: string;
    guestCode?: GuestCodeRecord;
    visitor?: VisitorRecord;
  } {
    const codeHash = crypto.createHash('sha256').update(pin).digest('hex');
    const guestCode = this.state.guestCodes.find((gc) => gc.codeHash === codeHash);

    if (!guestCode) {
      return { isValid: false, reason: 'Invalid guest pass PIN. No matching active pass found.' };
    }

    if (!guestCode.isActive) {
      return { isValid: false, reason: 'This guest pass has already reached its usage limit or is deactivated.' };
    }

    const now = new Date().getTime();
    if (now < new Date(guestCode.validFrom).getTime()) {
      return { isValid: false, reason: `Guest pass is not active yet (valid from ${guestCode.validFrom}).` };
    }
    if (now > new Date(guestCode.validUntil).getTime()) {
      guestCode.isActive = false;
      this.saveToDisk(this.state);
      return { isValid: false, reason: `Guest pass expired on ${guestCode.validUntil}.` };
    }

    if (guestCode.usageCount >= guestCode.usageLimit) {
      guestCode.isActive = false;
      this.saveToDisk(this.state);
      return { isValid: false, reason: 'Guest pass has reached its allowed usage limit.' };
    }

    // Pass is valid: increment usage
    guestCode.usageCount += 1;
    if (guestCode.usageCount >= guestCode.usageLimit) {
      guestCode.isActive = false;
    }

    // Automatically check in visitor
    const visitor = this.addVisitor({
      flatId: guestCode.flatId,
      visitorName: guestCode.guestName,
      purpose: guestCode.purpose || 'Pre-approved Guest Visit',
      approvalStatus: 'APPROVED',
      entryStatus: 'CHECKED_IN',
      preApprovedCode: pin,
    });

    this.saveToDisk(this.state);
    return {
      isValid: true,
      guestCode,
      visitor,
    };
  }

  // ==========================================
  // Amenities Access and Mutation Methods
  // ==========================================
  public getAmenities(): AmenityRecord[] {
    return this.state.amenities.filter((a) => a.isActive);
  }

  public getAmenityById(id: string): AmenityRecord | undefined {
    return this.state.amenities.find((a) => a.id === id);
  }

  public getAmenitySlots(
    amenityId: string,
    dateStr: string
  ): Array<{
    id: string;
    amenityId: string;
    date: string;
    startAt: string;
    endAt: string;
    label: string;
    isAvailable: boolean;
    feePaise: number;
    bookedByFlat?: string;
  }> {
    const amenity = this.state.amenities.find((a) => a.id === amenityId);
    if (!amenity) {
      throw new Error(`Amenity ${amenityId} not found.`);
    }

    const [openHour] = amenity.openTime.split(':').map(Number);
    const [closeHour] = amenity.closeTime.split(':').map(Number);
    const durationHours = Math.max(1, Math.floor(amenity.slotDurationMinutes / 60));

    const slots = [];
    for (let h = openHour; h + durationHours <= closeHour; h += durationHours) {
      const startHourStr = String(h).padStart(2, '0') + ':00';
      const endHourStr = String(h + durationHours).padStart(2, '0') + ':00';
      const startAt = `${dateStr}T${startHourStr}:00.000Z`;
      const endAt = `${dateStr}T${endHourStr}:00.000Z`;

      const startMs = new Date(startAt).getTime();
      const endMs = new Date(endAt).getTime();

      // Check conflict with confirmed active bookings
      const activeBooking = this.state.amenityBookings.find((b) => {
        if (b.amenityId !== amenityId || b.status !== 'CONFIRMED') return false;
        const bStart = new Date(b.startAt).getTime();
        const bEnd = new Date(b.endAt).getTime();
        return startMs < bEnd && endMs > bStart;
      });

      const startLabel = `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
      const endH = h + durationHours;
      const endLabel = `${endH % 12 || 12}:00 ${endH >= 12 ? 'PM' : 'AM'}`;

      slots.push({
        id: `slot-${amenityId}-${dateStr}-${startHourStr.replace(':', '')}`,
        amenityId,
        date: dateStr,
        startAt,
        endAt,
        label: `${startLabel} – ${endLabel}`,
        isAvailable: !activeBooking,
        feePaise: amenity.feePaise,
        bookedByFlat: activeBooking ? activeBooking.flatIdentifier : undefined,
      });
    }

    return slots;
  }

  public getAmenityBookings(flatId?: string): AmenityBookingRecord[] {
    if (flatId) {
      return this.state.amenityBookings.filter((b) => b.flatId === flatId);
    }
    return this.state.amenityBookings;
  }

  public bookAmenity(data: {
    amenityId: string;
    flatId: string;
    residentId: string;
    residentName: string;
    startAt: string;
    endAt: string;
  }): AmenityBookingRecord {
    const amenity = this.state.amenities.find((a) => a.id === data.amenityId);
    if (!amenity) {
      throw new Error(`Amenity ${data.amenityId} not found.`);
    }

    const start = new Date(data.startAt).getTime();
    const end = new Date(data.endAt).getTime();
    if (isNaN(start) || isNaN(end) || start >= end) {
      const err: any = new Error('Invalid start or end time for amenity booking.');
      err.statusCode = 400;
      throw err;
    }

    // Overlap conflict check: newStart < existingEnd && newEnd > existingStart
    const hasConflict = this.state.amenityBookings.some((b) => {
      if (b.amenityId !== data.amenityId || b.status !== 'CONFIRMED') return false;
      const bStart = new Date(b.startAt).getTime();
      const bEnd = new Date(b.endAt).getTime();
      return start < bEnd && end > bStart;
    });

    if (hasConflict) {
      const err: any = new Error(
        'The requested amenity slot is already booked. Please choose another time window.'
      );
      err.statusCode = 409;
      throw err;
    }

    let flatIdentifier = 'T07-1203';
    if (data.flatId === 'flat-t12-0408') {
      flatIdentifier = 'T12-0408';
    } else if (data.flatId === 'flat-t21-1601') {
      flatIdentifier = 'T21-1601';
    }

    const newBooking: AmenityBookingRecord = {
      id: `amen-book-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      amenityId: amenity.id,
      amenityName: amenity.name,
      flatId: data.flatId,
      flatIdentifier,
      residentId: data.residentId,
      residentName: data.residentName,
      startAt: data.startAt,
      endAt: data.endAt,
      feePaise: amenity.feePaise,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
    };

    this.state.amenityBookings.unshift(newBooking);
    this.saveToDisk(this.state);
    return newBooking;
  }

  public cancelAmenityBooking(bookingId: string, residentId?: string, userRole?: string): AmenityBookingRecord {
    const booking = this.state.amenityBookings.find((b) => b.id === bookingId);
    if (!booking) {
      const err: any = new Error(`Amenity booking ${bookingId} not found.`);
      err.statusCode = 404;
      throw err;
    }

    // Check authorization: resident can only cancel their own booking
    if (userRole === 'RESIDENT' && residentId && booking.residentId !== residentId) {
      const err: any = new Error('You are not authorized to cancel this booking.');
      err.statusCode = 403;
      throw err;
    }

    booking.status = 'CANCELLED';
    booking.cancelledAt = new Date().toISOString();
    this.saveToDisk(this.state);
    return booking;
  }
}

export const societyStore = new SocietyStore();

