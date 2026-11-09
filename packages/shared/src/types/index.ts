import {
  UserRole,
  InvoiceStatus,
  PaymentStatus,
  BankTransactionStatus,
  ComplaintCategory,
  ComplaintUrgency,
  ComplaintStatus,
} from '../constants/index.js';

export interface UserDTO {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  preferredLanguage: string;
  isActive: boolean;
  createdAt: string;
}

export interface FlatDTO {
  id: string;
  flatNumber: string;
  tower: string;
  areaSqFt: number;
  maintenanceRate: number;
  isActive: boolean;
}

export interface InvoiceDTO {
  id: string;
  flatId: string;
  billingPeriod: string; // e.g. "2026-11"
  areaSqFt: number;
  ratePerSqFt: number;
  baseAmountPaise: number;
  lateFeePaise: number;
  totalAmountPaise: number;
  paidAmountPaise: number;
  dueDate: string;
  status: InvoiceStatus;
  createdAt: string;
}

export interface PaymentDTO {
  id: string;
  invoiceId: string;
  residentId: string;
  amountPaise: number;
  provider: string;
  providerReference: string;
  idempotencyKey: string;
  status: PaymentStatus;
  paidAt?: string;
  createdAt: string;
}

export interface ComplaintDTO {
  id: string;
  residentId: string;
  flatId: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  urgency: ComplaintUrgency;
  status: ComplaintStatus;
  assignedTo?: string;
  createdAt: string;
  resolvedAt?: string;
  reopenedAt?: string;
}

export interface BankTransactionDTO {
  id: string;
  batchId: string;
  transactionDate: string;
  amountPaise: number;
  reference: string;
  upiId?: string;
  description?: string;
  status: BankTransactionStatus;
}

// Committee Dashboard Reporting Types
export interface DuesAgeingBucket {
  key: 'CURRENT' | 'DAYS_1_30' | 'DAYS_31_60' | 'DAYS_61_90' | 'DAYS_90_PLUS';
  label: string;
  dayRange: string;
  count: number;
  amountPaise: number;
  percentageOfOutstanding: number;
  color: string;
}

export interface FlatOutstandingAccount {
  flatId: string;
  tower: string;
  flatNumber: string;
  residentName: string;
  residentPhone?: string;
  billingPeriod: string;
  totalBilledPaise: number;
  paidAmountPaise: number;
  outstandingBalancePaise: number;
  daysOverdue: number;
  ageingBucket: string;
  status: string;
}

export interface CommitteeDashboardMetrics {
  currentBillingPeriod: string;
  generatedAt: string;
  summary: {
    totalApartments: number;
    totalTowers: number;
    totalBilledPaise: number;
    totalCollectedPaise: number;
    totalOverduePaise: number;
    collectionEfficiencyPct: number;
  };
  financialMetrics: {
    totalBilledPaise: number;
    totalCollectedPaise: number;
    outstandingBalancePaise: number;
    collectionPercentage: number;
    invoicesCount: number;
    paidInvoicesCount: number;
    partiallyPaidInvoicesCount: number;
    overdueInvoicesCount: number;
  };
  duesAgeing: {
    definitionNotice: string;
    totalOutstandingPaise: number;
    buckets: DuesAgeingBucket[];
  };
  flatOutstandingAccounts: FlatOutstandingAccount[];
  complaintMetrics: {
    totalComplaints: number;
    openComplaints: number;
    resolvedComplaints: number;
    reopenedCount: number;
    reopenedRatePct: number;
    averageResponseTimeMinutes: number | null;
    averageResolutionTimeHours: number | null;
    calculationDocumentation: {
      responseTimeFormula: string;
      resolutionTimeFormula: string;
      reopenedRateFormula: string;
      disclaimer: string;
    };
  };
  disclosures: {
    isSampleData: boolean;
    sampleAccountsCount: number;
    townshipTotalFlats: number;
    historicalDataAvailable: boolean;
    operationalImprovementClaimed: boolean;
    notes: string[];
  };
}

