import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Receipt, CreditCard, Download, Clock, ShieldCheck, FileText } from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { Modal } from '../components/ui/Modal.js';
import { DemoFlat } from '../fixtures/uiData.js';
import { formatPaiseToINR } from '@nivasa/shared';

export function MaintenancePage() {
  const { currentFlat } = useOutletContext<{ currentFlat: DemoFlat }>();
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);

  const duePaise = currentFlat.monthlyBillPaise - currentFlat.paidAmountPaise;

  const mockLedger = [
    {
      id: 'led-1',
      date: '01 Nov 2026',
      type: 'Bill',
      description: 'Monthly Maintenance (November 2026)',
      debitPaise: currentFlat.monthlyBillPaise,
      creditPaise: 0,
      balancePaise: currentFlat.monthlyBillPaise,
    },
    ...(currentFlat.paidAmountPaise > 0
      ? [
          {
            id: 'led-2',
            date: '02 Nov 2026',
            type: 'Payment',
            description: 'Online Payment (UPI/Gateway Ref: MOCK-78219)',
            debitPaise: 0,
            creditPaise: currentFlat.paidAmountPaise,
            balancePaise: duePaise,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-walnut-900">Maintenance & Ledger</h2>
        <p className="text-xs text-text-secondary mt-0.5">
          Itemized maintenance bills, verified receipts, and running account statement.
        </p>
      </div>

      {/* Current Invoice Itemized Card */}
      <div className="rounded-surface border border-border bg-surface p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-text-muted">INV-202611-{currentFlat.flatNumber}</span>
              <StatusBadge
                variant={duePaise === 0 ? 'paid' : currentFlat.daysOverdue > 0 ? 'overdue' : 'pending'}
                label={duePaise === 0 ? 'Paid' : currentFlat.daysOverdue > 0 ? `${currentFlat.daysOverdue} Days Overdue` : 'Pending'}
              />
            </div>
            <h3 className="text-base font-bold text-walnut-900 mt-1">
              Billing Period: November 2026
            </h3>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs text-text-muted block">Total Billed</span>
            <span className="text-xl font-bold text-text-primary tabular-nums">
              {formatPaiseToINR(currentFlat.monthlyBillPaise)}
            </span>
          </div>
        </div>

        {/* Breakdown Table */}
        <div className="py-4 space-y-2 text-xs">
          <div className="flex justify-between py-1.5 border-b border-border/50 text-text-secondary">
            <span>Apartment Area</span>
            <span className="font-semibold text-text-primary tabular-nums">{currentFlat.areaSqFt} sq ft</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-border/50 text-text-secondary">
            <span>Approved Society Rate</span>
            <span className="font-semibold text-text-primary tabular-nums">₹6.50 per sq ft</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-border/50 text-text-secondary">
            <span>Base Maintenance Amount</span>
            <span className="font-semibold text-text-primary tabular-nums">
              {formatPaiseToINR(currentFlat.monthlyBillPaise)}
            </span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-border/50 text-text-secondary">
            <span>Late Fee / Interest</span>
            <span className="font-semibold text-text-primary tabular-nums">₹0.00</span>
          </div>
          <div className="flex justify-between py-2 text-sm font-bold text-walnut-900">
            <span>Amount Outstanding</span>
            <span className="font-mono text-base tabular-nums">
              {formatPaiseToINR(duePaise)}
            </span>
          </div>
        </div>

        {/* Action Bar */}
        <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] text-text-muted">
            Due Date: 10 Nov 2026 • Maharashtra Cooperative Societies Bye-Laws
          </span>
          <div className="flex gap-2">
            {currentFlat.paidAmountPaise > 0 && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<FileText className="h-3.5 w-3.5" />}
                onClick={() =>
                  setSelectedReceipt({
                    receiptNumber: `REC-202611-${currentFlat.flatNumber}`,
                    date: '02 Nov 2026',
                    amountPaise: currentFlat.paidAmountPaise,
                    mode: 'Online (Mock Gateway UPI)',
                  })
                }
              >
                View Receipt
              </Button>
            )}
            {duePaise > 0 && (
              <Button
                variant={currentFlat.daysOverdue > 0 ? 'amber' : 'primary'}
                size="sm"
                leftIcon={<CreditCard className="h-3.5 w-3.5" />}
              >
                Pay {formatPaiseToINR(duePaise)}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Flat Ledger Section (TDD.md Section 6 & DATA_MODEL.md Section 7) */}
      <div className="rounded-surface border border-border bg-surface p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 className="text-sm font-bold text-walnut-900">Flat Payment Ledger</h3>
            <p className="text-xs text-text-muted">Immutable double-entry transaction record</p>
          </div>
          <Button variant="ghost" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />}>
            Export
          </Button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="py-2.5 font-semibold">Date</th>
                <th className="py-2.5 font-semibold">Type</th>
                <th className="py-2.5 font-semibold">Description</th>
                <th className="py-2.5 font-semibold text-right">Debit (₹)</th>
                <th className="py-2.5 font-semibold text-right">Credit (₹)</th>
                <th className="py-2.5 font-semibold text-right">Balance (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {mockLedger.map((row) => (
                <tr key={row.id} className="hover:bg-surface-alt/40 transition-colors">
                  <td className="py-2.5 font-mono text-text-secondary whitespace-nowrap">{row.date}</td>
                  <td className="py-2.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        row.type === 'Payment'
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-surface-alt text-text-secondary'
                      }`}
                    >
                      {row.type}
                    </span>
                  </td>
                  <td className="py-2.5 text-text-primary">{row.description}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-text-primary">
                    {row.debitPaise > 0 ? formatPaiseToINR(row.debitPaise) : '—'}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-sage-900 font-medium">
                    {row.creditPaise > 0 ? formatPaiseToINR(row.creditPaise) : '—'}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums font-semibold text-walnut-900">
                    {formatPaiseToINR(row.balancePaise)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt View Modal */}
      {selectedReceipt && (
        <Modal
          isOpen={!!selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          title="Payment Receipt"
          description={`Official acknowledgment for Flat ${currentFlat.tower}-${currentFlat.flatNumber}`}
          footer={
            <Button variant="primary" size="sm" onClick={() => setSelectedReceipt(null)}>
              Done
            </Button>
          }
        >
          <div className="rounded-control border border-border p-4 bg-surface-alt/50 space-y-3 font-mono text-xs">
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-text-muted">Receipt Number:</span>
              <span className="font-bold text-walnut-900">{selectedReceipt.receiptNumber}</span>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-text-muted">Date of Payment:</span>
              <span>{selectedReceipt.date}</span>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-text-muted">Resident:</span>
              <span>{currentFlat.residentName} ({currentFlat.role})</span>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-text-muted">Payment Mode:</span>
              <span>{selectedReceipt.mode}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-walnut-900 pt-1">
              <span>Amount Paid:</span>
              <span>{formatPaiseToINR(selectedReceipt.amountPaise)}</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

