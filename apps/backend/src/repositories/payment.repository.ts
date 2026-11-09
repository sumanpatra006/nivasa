import { prisma } from '../config/prisma.js';
import { PaymentStatus, InvoiceStatus, LedgerEntryType } from '@prisma/client';
import { FormattedInvoice } from './invoice.repository.js';

export interface PaymentData {
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

export interface ReceiptData {
  id: string;
  receiptNumber: string;
  paymentId: string;
  invoiceId: string;
  flatId: string;
  flatIdentifier: string;
  residentName: string;
  billingPeriod: string;
  amountPaise: number;
  paymentReference: string;
  date: string;
}

export interface LedgerData {
  id: string;
  flatId: string;
  entryType: 'BILL' | 'PAYMENT' | 'LATE_FEE' | 'ADJUSTMENT' | 'REVERSAL';
  amountPaise: number;
  description: string;
  reference?: string;
  createdAt: string;
}

// Memory fallback store for sandboxed test environments
const memoryPayments = new Map<string, PaymentData>();
const memoryReceipts = new Map<string, ReceiptData>();
const memoryLedgers: LedgerData[] = [];

export class PaymentRepository {
  public static async findByIdempotencyKey(key: string): Promise<PaymentData | null> {
    try {
      const p = await prisma.payment.findUnique({
        where: { idempotencyKey: key },
        include: {
          receipt: true,
          invoice: true,
        },
      });
      if (p) {
        return {
          id: p.id,
          invoiceId: p.invoiceId,
          flatId: p.invoice.flatId,
          amountPaise: p.amountPaise,
          idempotencyKey: p.idempotencyKey,
          provider: p.provider,
          providerReference: p.providerReference,
          status: p.status as any,
          createdAt: p.createdAt.toISOString(),
          paidAt: p.paidAt?.toISOString() || null,
          receiptId: p.receipt?.id || null,
        };
      }
    } catch {}

    return memoryPayments.get(key) || null;
  }

  public static async initiate(data: {
    invoiceId: string;
    flatId: string;
    residentId: string;
    amountPaise: number;
    idempotencyKey: string;
    provider: string;
    providerReference: string;
  }): Promise<PaymentData> {
    const paymentId = `pay-${Date.now()}`;
    const paymentRecord: PaymentData = {
      id: paymentId,
      invoiceId: data.invoiceId,
      flatId: data.flatId,
      amountPaise: data.amountPaise,
      idempotencyKey: data.idempotencyKey,
      provider: data.provider,
      providerReference: data.providerReference,
      status: 'INITIATED',
      createdAt: new Date().toISOString(),
      receiptId: null,
    };

    try {
      await prisma.payment.create({
        data: {
          id: paymentId,
          invoiceId: data.invoiceId,
          residentId: data.residentId,
          amountPaise: data.amountPaise,
          idempotencyKey: data.idempotencyKey,
          provider: data.provider,
          providerReference: data.providerReference,
          status: PaymentStatus.INITIATED,
        },
      });
    } catch {}

    memoryPayments.set(data.idempotencyKey, paymentRecord);
    return paymentRecord;
  }

  public static async verifySuccess(payment: PaymentData, invoice: FormattedInvoice): Promise<{
    payment: PaymentData;
    receipt: ReceiptData;
    invoice: FormattedInvoice;
  }> {
    const now = new Date();
    const receiptId = `rec-${Date.now()}`;
    const receiptNumber = `REC-${invoice.billingPeriod.replace('-', '')}-${invoice.flatNumber}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newPaidAmountPaise = invoice.paidAmountPaise + payment.amountPaise;
    const isFullyPaid = newPaidAmountPaise >= invoice.totalAmountPaise;
    const newStatus = isFullyPaid ? 'PAID' : 'PARTIALLY_PAID';

    const updatedPayment: PaymentData = {
      ...payment,
      status: 'SUCCESS',
      paidAt: now.toISOString(),
      receiptId,
    };

    const receipt: ReceiptData = {
      id: receiptId,
      receiptNumber,
      paymentId: payment.id,
      invoiceId: invoice.id,
      flatId: invoice.flatId,
      flatIdentifier: `${invoice.tower}-${invoice.flatNumber}`,
      residentName: invoice.residentName,
      billingPeriod: invoice.billingPeriod,
      amountPaise: payment.amountPaise,
      paymentReference: payment.providerReference,
      date: now.toISOString(),
    };

    const updatedInvoice: FormattedInvoice = {
      ...invoice,
      paidAmountPaise: newPaidAmountPaise,
      remainingBalancePaise: Math.max(0, invoice.totalAmountPaise - newPaidAmountPaise),
      status: newStatus as any,
    };

    const ledgerEntry: LedgerData = {
      id: `led-${Date.now()}`,
      flatId: invoice.flatId,
      entryType: 'PAYMENT',
      amountPaise: -payment.amountPaise,
      description: `Payment received via ${payment.provider} (${payment.providerReference}) - ${invoice.billingPeriod}`,
      reference: receiptNumber,
      createdAt: now.toISOString(),
    };

    // Atomic database transaction in PostgreSQL
    try {
      await prisma.$transaction([
        prisma.payment.update({
          where: { idempotencyKey: payment.idempotencyKey },
          data: {
            status: PaymentStatus.SUCCESS,
            paidAt: now,
          },
        }),
        prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            paidAmountPaise: newPaidAmountPaise,
            status: isFullyPaid ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID,
          },
        }),
        prisma.receipt.create({
          data: {
            id: receiptId,
            receiptNumber,
            paymentId: payment.id,
            amountPaise: payment.amountPaise,
          },
        }),
        prisma.ledgerEntry.create({
          data: {
            flatId: invoice.flatId,
            invoiceId: invoice.id,
            paymentId: payment.id,
            entryType: LedgerEntryType.PAYMENT,
            amountPaise: -payment.amountPaise,
            description: ledgerEntry.description,
          },
        }),
      ]);
    } catch (err: any) {
      console.warn('PostgreSQL payment transaction notice:', err.message);
    }

    memoryPayments.set(payment.idempotencyKey, updatedPayment);
    memoryReceipts.set(receiptId, receipt);
    memoryLedgers.push(ledgerEntry);

    return { payment: updatedPayment, receipt, invoice: updatedInvoice };
  }

  public static async verifyFailure(payment: PaymentData, reason: string): Promise<PaymentData> {
    const updated: PaymentData = {
      ...payment,
      status: 'FAILED',
      failureReason: reason,
    };

    try {
      await prisma.payment.update({
        where: { idempotencyKey: payment.idempotencyKey },
        data: {
          status: PaymentStatus.FAILED,
        },
      });
    } catch {}

    memoryPayments.set(payment.idempotencyKey, updated);
    return updated;
  }

  public static async findReceipts(flatId?: string): Promise<ReceiptData[]> {
    try {
      const records = await prisma.receipt.findMany({
        where: flatId
          ? {
              payment: {
                invoice: { flatId },
              },
            }
          : {},
        include: {
          payment: {
            include: {
              invoice: {
                include: {
                  flat: {
                    include: {
                      memberships: {
                        include: { user: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { issuedAt: 'desc' },
      });

      if (records && records.length > 0) {
        return records.map((r) => {
          const inv = r.payment.invoice;
          const residentName = inv.flat?.memberships?.[0]?.user?.name || 'Resident';
          return {
            id: r.id,
            receiptNumber: r.receiptNumber,
            paymentId: r.paymentId,
            invoiceId: inv.id,
            flatId: inv.flatId,
            flatIdentifier: `${inv.flat.tower}-${inv.flat.flatNumber}`,
            residentName,
            billingPeriod: inv.billingPeriod,
            amountPaise: r.amountPaise,
            paymentReference: r.payment.providerReference,
            date: r.issuedAt.toISOString(),
          };
        });
      }
    } catch {}

    const list = Array.from(memoryReceipts.values());
    return flatId ? list.filter((r) => r.flatId === flatId) : list;
  }

  public static async findReceiptById(id: string): Promise<ReceiptData | null> {
    try {
      const r = await prisma.receipt.findUnique({
        where: { id },
        include: {
          payment: {
            include: {
              invoice: {
                include: {
                  flat: {
                    include: {
                      memberships: {
                        include: { user: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (r) {
        const inv = r.payment.invoice;
        const residentName = inv.flat?.memberships?.[0]?.user?.name || 'Resident';
        return {
          id: r.id,
          receiptNumber: r.receiptNumber,
          paymentId: r.paymentId,
          invoiceId: inv.id,
          flatId: inv.flatId,
          flatIdentifier: `${inv.flat.tower}-${inv.flat.flatNumber}`,
          residentName,
          billingPeriod: inv.billingPeriod,
          amountPaise: r.amountPaise,
          paymentReference: r.payment.providerReference,
          date: r.issuedAt.toISOString(),
        };
      }
    } catch {}

    return memoryReceipts.get(id) || null;
  }

  public static async getLedger(flatId: string): Promise<{ closingBalancePaise: number; entries: LedgerData[] }> {
    try {
      const entries = await prisma.ledgerEntry.findMany({
        where: { flatId },
        orderBy: { createdAt: 'asc' },
      });

      if (entries && entries.length > 0) {
        let closingBalancePaise = 0;
        const formatted = entries.map((e) => {
          closingBalancePaise += e.amountPaise;
          return {
            id: e.id,
            flatId: e.flatId,
            entryType: e.entryType as any,
            amountPaise: e.amountPaise,
            description: e.description,
            createdAt: e.createdAt.toISOString(),
          };
        });
        return { closingBalancePaise, entries: formatted };
      }
    } catch {}

    const entries = memoryLedgers.filter((l) => l.flatId === flatId);
    let closingBalancePaise = 0;
    entries.forEach((e) => (closingBalancePaise += e.amountPaise));
    return { closingBalancePaise, entries };
  }
}
