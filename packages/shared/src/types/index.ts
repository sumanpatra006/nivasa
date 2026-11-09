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

