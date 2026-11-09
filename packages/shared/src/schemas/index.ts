import { z } from 'zod';
import {
  COMPLAINT_CATEGORY,
  COMPLAINT_STATUS,
} from '../constants/index.js';

// Auth Schemas
export const RequestOtpSchema = z.object({
  phone: z.string().regex(/^[0-9]{10}$/, 'Phone number must be a 10-digit Indian mobile number'),
});

export const VerifyOtpSchema = z.object({
  phone: z.string().regex(/^[0-9]{10}$/, 'Phone number must be a 10-digit Indian mobile number'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

// Complaint Creation Schema
export const CreateComplaintSchema = z.object({
  flatId: z.string().min(1, 'Flat ID is required'),
  title: z.string().min(3, 'Title must be at least 3 characters').max(120),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  category: z.nativeEnum(COMPLAINT_CATEGORY).optional(),
});

// Update Complaint Status Schema
export const UpdateComplaintStatusSchema = z.object({
  status: z.nativeEnum(COMPLAINT_STATUS),
  comment: z.string().max(500).optional(),
});

// Assign Complaint Schema
export const AssignComplaintSchema = z.object({
  assignedTo: z.string().min(1, 'Assignee ID is required'),
  reason: z.string().max(500).optional(),
});

// Payment Initiation Schema
export const InitiatePaymentSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  amountPaise: z.number().int().positive('Payment amount must be greater than zero'),
  idempotencyKey: z.string().min(8, 'Idempotency key is required'),
});

// Bank CSV Transaction Schema
export const BankCsvRowSchema = z.object({
  transactionDate: z.string().min(1, 'Transaction date is required'),
  amount: z.string().or(z.number()),
  reference: z.string().min(1, 'Reference is required'),
  upiId: z.string().optional(),
  description: z.string().optional(),
});

// Types inferred from schemas
export type RequestOtpInput = z.infer<typeof RequestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type CreateComplaintInput = z.infer<typeof CreateComplaintSchema>;
export type UpdateComplaintStatusInput = z.infer<typeof UpdateComplaintStatusSchema>;
export type AssignComplaintInput = z.infer<typeof AssignComplaintSchema>;
export type InitiatePaymentInput = z.infer<typeof InitiatePaymentSchema>;
export type BankCsvRowInput = z.infer<typeof BankCsvRowSchema>;

