import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Receipt,
  CreditCard,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  RefreshCw,
  Info,
  Calendar,
  Layers,
} from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { Modal } from '../components/ui/Modal.js';
import { DemoFlat } from '../fixtures/uiData.js';
import { formatPaiseToINR, paiseToRupees } from '@nivasa/shared';
import {
  ApiClient,
  ApiInvoice,
  ApiReceipt,
  ApiLedgerEntry,
} from '../services/api.js';

export function MaintenancePage() {
  const { currentFlat } = useOutletContext<{ currentFlat: DemoFlat }>();

  // Data states
  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<ApiInvoice | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<ApiLedgerEntry[]>([]);
  const [closingBalancePaise, setClosingBalancePaise] = useState<number>(0);
  const [receipts, setReceipts] = useState<ApiReceipt[]>([]);
  const [activeReceipt, setActiveReceipt] = useState<ApiReceipt | null>(null);

  // Status & UI states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Payment flow modal states
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [paymentAmountRupees, setPaymentAmountRupees] = useState<number>(0);
  const [paymentType, setPaymentType] = useState<'FULL' | 'CUSTOM'>('FULL');
  const [simulateFailure, setSimulateFailure] = useState<boolean>(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [paymentResult, setPaymentResult] = useState<{
    status: 'SUCCESS' | 'FAILED';
    message: string;
    receipt?: ApiReceipt | null;
  } | null>(null);

  // Load backend data for current flat
  const loadData = useCallback(async () => {
    try {
      setApiError(null);

      // Authenticate session as the current demo resident
      await ApiClient.authenticateResident(currentFlat.phone);

      // 1. Fetch Invoices
      const billsRes = await ApiClient.getBills();
      const flatInvoices = billsRes.invoices.filter((inv) => inv.flatId === currentFlat.id);
      setInvoices(flatInvoices);

      const target = flatInvoices[0] || null;
      setSelectedInvoice(target);
      if (target) {
        setPaymentAmountRupees(paiseToRupees(target.remainingBalancePaise));
      }

      // 2. Fetch Ledger
      const ledgerRes = await ApiClient.getLedger(currentFlat.id);
      setLedgerEntries(ledgerRes.entries);
      setClosingBalancePaise(ledgerRes.closingBalancePaise);

      // 3. Fetch Receipts
      const receiptsRes = await ApiClient.getReceipts();
      const flatReceipts = receiptsRes.receipts.filter((r) => r.flatId === currentFlat.id);
      setReceipts(flatReceipts);
    } catch (err: any) {
      console.error('Failed to load maintenance data from backend:', err);
      setApiError(err.message || 'Unable to connect to Nivasa backend server.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentFlat.id, currentFlat.phone]);

  useEffect(() => {
    setIsLoading(true);
    loadData();
  }, [loadData]);

  // Handle Payment Initiation & Gateway Verification
  const handleExecutePayment = async () => {
    if (!selectedInvoice) return;

    const amountPaise = Math.round(paymentAmountRupees * 100);

    if (amountPaise <= 0) {
      setApiError('Payment amount must be greater than ₹0.00');
      return;
    }

    if (amountPaise > selectedInvoice.remainingBalancePaise) {
      setApiError(
        `Payment amount (₹${paymentAmountRupees}) exceeds outstanding balance (${formatPaiseToINR(
          selectedInvoice.remainingBalancePaise
        )}).`
      );
      return;
    }

    setIsProcessingPayment(true);
    setApiError(null);

    try {
      const idempotencyKey = `pay-${currentFlat.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // 1. Initiate with backend
      await ApiClient.initiatePayment(selectedInvoice.id, amountPaise, idempotencyKey);

      // 2. Mock Gateway processing & verification
      const verifyRes = await ApiClient.verifyPayment(
        idempotencyKey,
        simulateFailure ? 'FAILED' : 'SUCCESS',
        simulateFailure
      );

      if (verifyRes.payment.status === 'SUCCESS') {
        setPaymentResult({
          status: 'SUCCESS',
          message: 'Payment authorized and posted to flat ledger successfully.',
          receipt: verifyRes.receipt,
        });

        // Automatically reload persistent backend data
        await loadData();
      } else {
        setPaymentResult({
          status: 'FAILED',
          message:
            verifyRes.payment.failureReason ||
            'Payment declined by issuing bank gateway. Please try an alternate UPI or NetBanking account.',
        });
      }
    } catch (err: any) {
      setPaymentResult({
        status: 'FAILED',
        message: err.message || 'Payment transaction encountered an error.',
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Loading skeleton state
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-surface-alt rounded-control" />
        <div className="h-64 rounded-surface bg-surface border border-border p-6" />
        <div className="h-64 rounded-surface bg-surface border border-border p-6" />
      </div>
    );
  }

  // API error banner state
  if (apiError && invoices.length === 0) {
    return (
      <div className="rounded-surface border border-rose-200 bg-rose-50/50 p-6 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-rose-900">Backend Connection Error</h3>
          <p className="text-xs text-rose-700 mt-1 max-w-md mx-auto">{apiError}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setIsLoading(true);
            loadData();
          }}
          leftIcon={<RefreshCw className="h-4 w-4" />}
        >
          Retry Connection
        </Button>
      </div>
    );
  }

  const primaryInvoice = selectedInvoice || invoices[0];
  const duePaise = primaryInvoice ? primaryInvoice.remainingBalancePaise : 0;

  return (
    <div className="space-y-6">
      {/* Top Header with Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-walnut-900">Maintenance & Ledger</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Verified monthly dues, real-time flat payment ledger, and official receipts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              loadData();
            }}
            disabled={isRefreshing}
            leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
          >
            {isRefreshing ? 'Syncing...' : 'Sync with Server'}
          </Button>
        </div>
      </div>

      {/* Bill List / Selection (when multiple bills exist) */}
      {invoices.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {invoices.map((inv) => (
            <button
              key={inv.id}
              onClick={() => {
                setSelectedInvoice(inv);
                setPaymentAmountRupees(paiseToRupees(inv.remainingBalancePaise));
              }}
              className={`px-3 py-2 rounded-control border text-xs font-semibold whitespace-nowrap transition-colors ${
                primaryInvoice?.id === inv.id
                  ? 'border-sage-500 bg-sage-50 text-sage-900'
                  : 'border-border bg-surface text-text-secondary hover:bg-surface-alt'
              }`}
            >
              {inv.billingPeriod} • {formatPaiseToINR(inv.remainingBalancePaise)}
            </button>
          ))}
        </div>
      )}

      {/* Primary Invoice Itemized Card */}
      {primaryInvoice ? (
        <div className="rounded-surface border border-border bg-surface p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-text-muted">
                  INV-{primaryInvoice.billingPeriod.replace('-', '')}-{primaryInvoice.flatNumber}
                </span>
                <StatusBadge
                  variant={
                    primaryInvoice.status === 'PAID'
                      ? 'paid'
                      : primaryInvoice.daysOverdue > 0
                      ? 'overdue'
                      : 'pending'
                  }
                  label={
                    primaryInvoice.status === 'PAID'
                      ? 'Fully Paid'
                      : primaryInvoice.daysOverdue > 0
                      ? `${primaryInvoice.daysOverdue} Days Overdue`
                      : 'Payment Pending'
                  }
                />
              </div>
              <h3 className="text-base font-bold text-walnut-900 mt-1 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-sage-600" />
                Billing Period: {primaryInvoice.billingPeriod === '2026-11' ? 'November 2026' : primaryInvoice.billingPeriod}
              </h3>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-xs text-text-muted block">Total Billed</span>
              <span className="text-xl font-bold text-text-primary tabular-nums">
                {formatPaiseToINR(primaryInvoice.totalAmountPaise)}
              </span>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="py-4 space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-border/50 text-text-secondary">
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-text-muted" /> Apartment Area
              </span>
              <span className="font-semibold text-text-primary tabular-nums">
                {primaryInvoice.areaSqFt} sq ft
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-border/50 text-text-secondary">
              <span>Approved Society Rate</span>
              <span className="font-semibold text-text-primary tabular-nums">
                ₹{(primaryInvoice.ratePerSqFtPaise / 100).toFixed(2)} per sq ft
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-border/50 text-text-secondary">
              <span>Base Maintenance Amount</span>
              <span className="font-semibold text-text-primary tabular-nums">
                {formatPaiseToINR(primaryInvoice.baseAmountPaise)}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-border/50 text-text-secondary">
              <span className="flex items-center gap-1">
                Late Fee Penalty
                {primaryInvoice.lateFeePaise > 0 && (
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                    Demo Policy: ₹250 flat + ₹10/day
                  </span>
                )}
              </span>
              <span
                className={`font-semibold tabular-nums ${
                  primaryInvoice.lateFeePaise > 0 ? 'text-amber-800' : 'text-text-primary'
                }`}
              >
                {formatPaiseToINR(primaryInvoice.lateFeePaise)}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-border/50 text-text-secondary">
              <span>Amount Paid to Date</span>
              <span className="font-semibold text-emerald-800 tabular-nums">
                {formatPaiseToINR(primaryInvoice.paidAmountPaise)}
              </span>
            </div>

            <div className="flex justify-between py-2 text-sm font-bold text-walnut-900 bg-surface-alt/40 px-3 rounded-control">
              <span>Remaining Balance Due</span>
              <span className="font-mono text-base tabular-nums text-walnut-900">
                {formatPaiseToINR(primaryInvoice.remainingBalancePaise)}
              </span>
            </div>
          </div>

          {/* Action Bar */}
          <div className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <Info className="h-3.5 w-3.5 text-sage-600 shrink-0" />
              <span>
                Due Date: {new Date(primaryInvoice.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} • Demo Society Configuration
              </span>
            </div>

            <div className="flex items-center gap-2">
              {receipts.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<FileText className="h-3.5 w-3.5" />}
                  onClick={() => setActiveReceipt(receipts[0])}
                >
                  View Latest Receipt
                </Button>
              )}

              {duePaise > 0 && (
                <Button
                  variant={primaryInvoice.daysOverdue > 0 ? 'amber' : 'primary'}
                  size="sm"
                  leftIcon={<CreditCard className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setPaymentResult(null);
                    setPaymentType('FULL');
                    setPaymentAmountRupees(paiseToRupees(duePaise));
                    setIsPaymentModalOpen(true);
                  }}
                >
                  Pay Dues ({formatPaiseToINR(duePaise)})
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-surface border border-border bg-surface p-8 text-center text-text-muted">
          No maintenance bills issued for this flat.
        </div>
      )}

      {/* Flat Ledger Section */}
      <div className="rounded-surface border border-border bg-surface p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border gap-2">
          <div>
            <h3 className="text-sm font-bold text-walnut-900">Flat Payment Ledger</h3>
            <p className="text-xs text-text-muted">
              Immutable double-entry transaction record • Running Account Balance:{' '}
              <strong className="text-walnut-900 font-mono">
                {formatPaiseToINR(closingBalancePaise)}
              </strong>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Download className="h-3.5 w-3.5" />}
              onClick={() => {
                const csvHeader = 'Date,Type,Description,Reference,Debit INR,Credit INR,Balance INR\n';
                const csvRows = ledgerEntries
                  .map((e) =>
                    `"${e.createdAt.substring(0, 10)}","${e.entryType}","${e.description}","${e.reference || ''}",${
                      e.entryType === 'BILL' || e.entryType === 'LATE_FEE' ? (e.amountPaise / 100).toFixed(2) : '0.00'
                    },${
                      e.entryType === 'PAYMENT' ? (e.amountPaise / 100).toFixed(2) : '0.00'
                    }`
                  )
                  .join('\n');
                const blob = new Blob([csvHeader + csvRows], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ledger-${currentFlat.tower}-${currentFlat.flatNumber}.csv`;
                a.click();
              }}
            >
              Export CSV
            </Button>
          </div>
        </div>

        {ledgerEntries.length === 0 ? (
          <div className="py-8 text-center text-xs text-text-muted">No ledger transactions recorded.</div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-text-muted">
                  <th className="py-2.5 font-semibold">Date</th>
                  <th className="py-2.5 font-semibold">Type</th>
                  <th className="py-2.5 font-semibold">Description</th>
                  <th className="py-2.5 font-semibold text-right">Debit (₹)</th>
                  <th className="py-2.5 font-semibold text-right">Credit (₹)</th>
                  <th className="py-2.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {ledgerEntries.map((row) => {
                  const isDebit = row.entryType === 'BILL' || row.entryType === 'LATE_FEE';
                  return (
                    <tr key={row.id} className="hover:bg-surface-alt/40 transition-colors">
                      <td className="py-2.5 font-mono text-text-secondary whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            row.entryType === 'PAYMENT'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : row.entryType === 'LATE_FEE'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-surface-alt text-text-secondary border border-border'
                          }`}
                        >
                          {row.entryType}
                        </span>
                      </td>
                      <td className="py-2.5 text-text-primary">
                        {row.description}
                        {row.reference && (
                          <span className="block text-[10px] font-mono text-text-muted">
                            Ref: {row.reference}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-text-primary">
                        {isDebit ? formatPaiseToINR(row.amountPaise) : '—'}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-emerald-800 font-medium">
                        {!isDebit ? formatPaiseToINR(row.amountPaise) : '—'}
                      </td>
                      <td className="py-2.5 text-right">
                        {row.reference && (
                          <button
                            onClick={() => {
                              const match = receipts.find((r) => r.paymentReference === row.reference);
                              if (match) setActiveReceipt(match);
                            }}
                            className="text-[11px] text-sage-800 font-semibold hover:underline"
                          >
                            Receipt
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Initiation & Mock Gateway Modal */}
      {isPaymentModalOpen && primaryInvoice && (
        <Modal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            if (!isProcessingPayment) {
              setIsPaymentModalOpen(false);
              setPaymentResult(null);
            }
          }}
          title={paymentResult ? 'Transaction Outcome' : 'Confirm Payment'}
          description={
            paymentResult
              ? `Mock Gateway authorization status for ${currentFlat.tower}-${currentFlat.flatNumber}`
              : `Review outstanding dues for Flat ${currentFlat.tower}-${currentFlat.flatNumber}`
          }
        >
          {paymentResult ? (
            /* Payment Result View */
            <div className="space-y-4">
              <div
                className={`rounded-control p-4 text-center border ${
                  paymentResult.status === 'SUCCESS'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-rose-200 bg-rose-50 text-rose-900'
                }`}
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full mb-2">
                  {paymentResult.status === 'SUCCESS' ? (
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  ) : (
                    <XCircle className="h-8 w-8 text-rose-600" />
                  )}
                </div>
                <h4 className="font-bold text-sm">
                  {paymentResult.status === 'SUCCESS' ? 'Payment Succeeded' : 'Payment Failed'}
                </h4>
                <p className="text-xs mt-1">{paymentResult.message}</p>
              </div>

              {paymentResult.status === 'SUCCESS' && paymentResult.receipt && (
                <div className="rounded-control border border-border p-3 bg-surface-alt/40 space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Receipt Number:</span>
                    <span className="font-bold text-walnut-900">
                      {paymentResult.receipt.receiptNumber}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Amount Paid:</span>
                    <span className="font-bold text-emerald-800">
                      {formatPaiseToINR(paymentResult.receipt.amountPaise)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Reference:</span>
                    <span>{paymentResult.receipt.paymentReference}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                {paymentResult.status === 'SUCCESS' && paymentResult.receipt && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveReceipt(paymentResult.receipt!);
                      setIsPaymentModalOpen(false);
                      setPaymentResult(null);
                    }}
                  >
                    View Official Receipt
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setIsPaymentModalOpen(false);
                    setPaymentResult(null);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            /* Review & Initiate Form */
            <div className="space-y-4">
              {/* Payment Summary Box */}
              <div className="rounded-control border border-border bg-surface-alt/40 p-4 space-y-2 text-xs">
                <div className="flex justify-between text-text-secondary">
                  <span>Billing Period:</span>
                  <span className="font-semibold text-text-primary">
                    {primaryInvoice.billingPeriod === '2026-11' ? 'November 2026' : primaryInvoice.billingPeriod}
                  </span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Total Dues Outstanding:</span>
                  <span className="font-semibold font-mono text-text-primary">
                    {formatPaiseToINR(primaryInvoice.remainingBalancePaise)}
                  </span>
                </div>
              </div>

              {/* Payment Type Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-walnut-900 block">Payment Option</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentType('FULL');
                      setPaymentAmountRupees(paiseToRupees(primaryInvoice.remainingBalancePaise));
                    }}
                    className={`p-2.5 rounded-control border text-left text-xs transition-colors ${
                      paymentType === 'FULL'
                        ? 'border-sage-500 bg-sage-50 text-sage-900 font-semibold'
                        : 'border-border bg-surface hover:bg-surface-alt text-text-secondary'
                    }`}
                  >
                    <span className="block font-bold">Full Balance</span>
                    <span className="text-[11px] font-mono">
                      {formatPaiseToINR(primaryInvoice.remainingBalancePaise)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentType('CUSTOM');
                    }}
                    className={`p-2.5 rounded-control border text-left text-xs transition-colors ${
                      paymentType === 'CUSTOM'
                        ? 'border-sage-500 bg-sage-50 text-sage-900 font-semibold'
                        : 'border-border bg-surface hover:bg-surface-alt text-text-secondary'
                    }`}
                  >
                    <span className="block font-bold">Custom Amount</span>
                    <span className="text-[11px]">Partial payment</span>
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              {paymentType === 'CUSTOM' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-secondary block">
                    Enter Amount (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-text-muted">₹</span>
                    <input
                      type="number"
                      min={1}
                      max={paiseToRupees(primaryInvoice.remainingBalancePaise)}
                      value={paymentAmountRupees || ''}
                      onChange={(e) => setPaymentAmountRupees(parseFloat(e.target.value) || 0)}
                      className="w-full pl-7 pr-3 py-1.5 rounded-control border border-border bg-surface text-xs font-mono font-semibold focus:outline-none focus:border-sage-500"
                    />
                  </div>
                  <span className="text-[10px] text-text-muted block">
                    Max: {formatPaiseToINR(primaryInvoice.remainingBalancePaise)}
                  </span>
                </div>
              )}

              {/* Mock Provider Deterministic Control */}
              <div className="rounded-control border border-border p-3 bg-surface-alt/30 text-xs space-y-2">
                <span className="font-semibold text-walnut-900 block flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-amber-600" /> Deterministic Mock Provider Options
                </span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simulateFailure}
                    onChange={(e) => setSimulateFailure(e.target.checked)}
                    className="rounded border-border text-sage-600 focus:ring-sage-500"
                  />
                  <span className="text-text-secondary text-[11px]">
                    Simulate Gateway Failure (declines transaction deterministically)
                  </span>
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPaymentModalOpen(false)}
                  disabled={isProcessingPayment}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleExecutePayment}
                  disabled={isProcessingPayment || paymentAmountRupees <= 0}
                  leftIcon={
                    isProcessingPayment ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CreditCard className="h-3.5 w-3.5" />
                    )
                  }
                >
                  {isProcessingPayment ? 'Authorizing...' : `Pay ₹${paymentAmountRupees.toLocaleString('en-IN')}`}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Official Receipt Modal */}
      {activeReceipt && (
        <Modal
          isOpen={!!activeReceipt}
          onClose={() => setActiveReceipt(null)}
          title="Payment Receipt"
          description={`Official Society Acknowledgment for Flat ${activeReceipt.flatIdentifier}`}
          footer={
            <div className="flex justify-between w-full">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Download className="h-3.5 w-3.5" />}
                onClick={() => {
                  window.print();
                }}
              >
                Print / Save PDF
              </Button>
              <Button variant="primary" size="sm" onClick={() => setActiveReceipt(null)}>
                Done
              </Button>
            </div>
          }
        >
          <div className="rounded-control border border-border p-5 bg-surface-alt/30 space-y-3 font-mono text-xs">
            <div className="flex justify-between border-b border-border pb-2.5">
              <span className="text-text-muted">Receipt Number:</span>
              <span className="font-bold text-walnut-900">{activeReceipt.receiptNumber}</span>
            </div>
            <div className="flex justify-between border-b border-border pb-2.5">
              <span className="text-text-muted">Flat Identifier:</span>
              <span className="font-semibold text-text-primary">{activeReceipt.flatIdentifier}</span>
            </div>
            <div className="flex justify-between border-b border-border pb-2.5">
              <span className="text-text-muted">Billing Period:</span>
              <span>{activeReceipt.billingPeriod}</span>
            </div>
            <div className="flex justify-between border-b border-border pb-2.5">
              <span className="text-text-muted">Resident Name:</span>
              <span>{activeReceipt.residentName}</span>
            </div>
            <div className="flex justify-between border-b border-border pb-2.5">
              <span className="text-text-muted">Payment Reference:</span>
              <span>{activeReceipt.paymentReference}</span>
            </div>
            <div className="flex justify-between border-b border-border pb-2.5">
              <span className="text-text-muted">Date of Transaction:</span>
              <span>{new Date(activeReceipt.date).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-walnut-900 pt-1.5">
              <span>Amount Paid:</span>
              <span className="text-emerald-800 font-bold">
                {formatPaiseToINR(activeReceipt.amountPaise)}
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
