export const USER_ROLES = {
  RESIDENT: 'RESIDENT',
  HELPDESK: 'HELPDESK',
  ACCOUNTS: 'ACCOUNTS',
  COMMITTEE: 'COMMITTEE',
  GUARD: 'GUARD',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const MEMBERSHIP_TYPES = {
  OWNER: 'OWNER',
  TENANT: 'TENANT',
  FAMILY: 'FAMILY',
} as const;

export type MembershipType = (typeof MEMBERSHIP_TYPES)[keyof typeof MEMBERSHIP_TYPES];

export const INVOICE_STATUS = {
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
} as const;

export type InvoiceStatus = (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS];

export const PAYMENT_STATUS = {
  INITIATED: 'INITIATED',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const LEDGER_ENTRY_TYPE = {
  BILL: 'BILL',
  PAYMENT: 'PAYMENT',
  LATE_FEE: 'LATE_FEE',
  ADJUSTMENT: 'ADJUSTMENT',
  REVERSAL: 'REVERSAL',
} as const;

export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPE)[keyof typeof LEDGER_ENTRY_TYPE];

export const BANK_TRANSACTION_STATUS = {
  UNMATCHED: 'UNMATCHED',
  SUGGESTED: 'SUGGESTED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  MATCHED: 'MATCHED',
  POSTED: 'POSTED',
  DUPLICATE: 'DUPLICATE',
  REJECTED: 'REJECTED',
} as const;

export type BankTransactionStatus =
  (typeof BANK_TRANSACTION_STATUS)[keyof typeof BANK_TRANSACTION_STATUS];

export const COMPLAINT_CATEGORY = {
  PLUMBING: 'PLUMBING',
  ELECTRICAL: 'ELECTRICAL',
  LIFT: 'LIFT',
  SECURITY: 'SECURITY',
  CLEANING: 'CLEANING',
  COMMON_AREA: 'COMMON_AREA',
  CLUBHOUSE: 'CLUBHOUSE',
  OTHER: 'OTHER',
} as const;

export type ComplaintCategory = (typeof COMPLAINT_CATEGORY)[keyof typeof COMPLAINT_CATEGORY];

export const COMPLAINT_URGENCY = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export type ComplaintUrgency = (typeof COMPLAINT_URGENCY)[keyof typeof COMPLAINT_URGENCY];

export const COMPLAINT_STATUS = {
  NEW: 'NEW',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_FOR_RESIDENT: 'WAITING_FOR_RESIDENT',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  REOPENED: 'REOPENED',
} as const;

export type ComplaintStatus = (typeof COMPLAINT_STATUS)[keyof typeof COMPLAINT_STATUS];

/**
 * Standard society maintenance billing rate per square foot in paise.
 * ₹6.50 per sq ft = 650 paise per sq ft.
 */
export const DEFAULT_MAINTENANCE_RATE_PAISE = 650;

/**
 * Deterministic safety escalation keyword phrases.
 * If any of these are present in complaint title or description,
 * the complaint is escalated immediately to CRITICAL priority.
 */
export const SAFETY_ESCALATION_TERMS = [
  'fire',
  'gas leak',
  'gas leakage',
  'lift stuck',
  'elevator stuck',
  'electric shock',
  'short circuit',
] as const;

