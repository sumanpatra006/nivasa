import React, { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import {
  CreditCard,
  AlertTriangle,
  Users,
  Bell,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { Modal } from '../components/ui/Modal.js';
import { DemoFlat, DEMO_NOTICES, DEMO_VISITORS_TODAY, DEMO_COMPLAINTS } from '../fixtures/uiData.js';
import { formatPaiseToINR } from '@nivasa/shared';

export function ResidentHomePage() {
  const { currentFlat } = useOutletContext<{ currentFlat: DemoFlat }>();
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);

  const duePaise = currentFlat.monthlyBillPaise - currentFlat.paidAmountPaise;
  const isOverdue = currentFlat.daysOverdue > 0 && duePaise > 0;
  const activeComplaints = DEMO_COMPLAINTS.filter((c) => c.status !== 'Resolved');

  const handleSimulatePayment = () => {
    setPaymentDone(true);
    setTimeout(() => {
      setIsPayModalOpen(false);
      setPaymentDone(false);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* 1. Maintenance Dues Hero Card (DESIGN.md Section 9) */}
      <div
        className={`rounded-surface border p-5 sm:p-6 shadow-sm transition-all ${
          isOverdue
            ? 'border-amber-300 bg-amber-50/40'
            : duePaise === 0
            ? 'border-sage-200 bg-sage-50/30'
            : 'border-border bg-surface'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Maintenance Due • November 2026
              </span>
              {isOverdue && (
                <StatusBadge variant="overdue" label={`${currentFlat.daysOverdue} days overdue`} />
              )}
              {duePaise === 0 && <StatusBadge variant="paid" label="Fully Paid" />}
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-bold tracking-tight text-walnut-900 tabular-nums">
                {formatPaiseToINR(duePaise)}
              </span>
              <span className="text-xs text-text-muted">
                {duePaise > 0 ? `Total due for ${currentFlat.areaSqFt} sq ft` : 'No outstanding dues'}
              </span>
            </div>

            <p className="mt-1 text-xs text-text-secondary">
              Due Date: <strong className="text-text-primary">10 Nov 2026</strong> • Rate: ₹6.50 / sq ft
            </p>
          </div>

          <div className="flex items-center gap-2 sm:self-center">
            {duePaise > 0 ? (
              <Button
                variant={isOverdue ? 'amber' : 'primary'}
                size="md"
                className="w-full sm:w-auto"
                leftIcon={<CreditCard className="h-4 w-4" />}
                onClick={() => setIsPayModalOpen(true)}
              >
                Pay Maintenance
              </Button>
            ) : (
              <Link to="/resident/maintenance">
                <Button variant="outline" size="md">
                  View Receipt
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Open Complaints & Today's Visitors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 2. Open Complaints */}
        <div className="rounded-surface border border-border bg-surface p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-walnut-500" />
                <h3 className="text-sm font-bold text-walnut-900">Active Complaints</h3>
              </div>
              <span className="text-xs font-semibold text-text-muted">
                {activeComplaints.length} active
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {activeComplaints.length > 0 ? (
                activeComplaints.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-control border border-border bg-surface-alt/50 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-walnut-900 line-clamp-1">
                        {c.title}
                      </span>
                      <StatusBadge
                        variant={c.isSafetyEscalation ? 'critical' : 'assigned'}
                        label={c.status}
                      />
                    </div>
                    <p className="text-xs text-text-secondary line-clamp-1">{c.description}</p>
                    <div className="flex items-center justify-between text-[11px] text-text-muted pt-1">
                      <span>{c.assignedTeam}</span>
                      <span className="font-medium text-amber-700">{c.slaTimeRemaining}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-text-muted">
                  <CheckCircle2 className="h-6 w-6 mx-auto mb-1 text-sage-500" />
                  No open complaints for your flat.
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-border/60">
            <Link
              to="/resident/complaints"
              className="text-xs font-semibold text-sage-700 hover:text-sage-900 inline-flex items-center gap-1"
            >
              Raise or view all complaints <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* 3. Expected Visitors */}
        <div className="rounded-surface border border-border bg-surface p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-walnut-500" />
                <h3 className="text-sm font-bold text-walnut-900">Today's Visitors</h3>
              </div>
              <span className="text-xs font-semibold text-text-muted">
                {DEMO_VISITORS_TODAY.length} visitors
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {DEMO_VISITORS_TODAY.map((v) => (
                <div
                  key={v.id}
                  className="p-3 rounded-control border border-border bg-surface-alt/50 flex items-center justify-between"
                >
                  <div>
                    <span className="text-xs font-semibold text-walnut-900 block">
                      {v.visitorName}
                    </span>
                    <span className="text-[11px] text-text-muted block">
                      {v.purpose} • {v.time}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-medium text-sage-700 block">
                      {v.status}
                    </span>
                    <span className="text-[10px] text-text-muted block">{v.gate}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-border/60 flex items-center justify-between">
            <Link
              to="/resident/visitors"
              className="text-xs font-semibold text-sage-700 hover:text-sage-900 inline-flex items-center gap-1"
            >
              Manage visitors & passes <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/resident/amenities"
              className="text-xs font-semibold text-walnut-700 hover:text-walnut-900 inline-flex items-center gap-1"
            >
              Book amenities <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 4. Important Notices */}
      <div className="rounded-surface border border-border bg-surface p-5 shadow-xs">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <Bell className="h-4 w-4 text-walnut-500" />
          <h3 className="text-sm font-bold text-walnut-900">Important Notices</h3>
        </div>

        <div className="mt-3 divide-y divide-border">
          {DEMO_NOTICES.map((n) => (
            <div key={n.id} className="py-3 first:pt-1 last:pb-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-walnut-900">{n.title}</h4>
                <span className="text-[11px] text-text-muted font-mono">{n.date}</span>
              </div>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">{n.body}</p>
              <span className="mt-1 text-[10px] text-text-muted block italic">Issued by: {n.author}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mock Payment Simulation Modal */}
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title="Pay Maintenance Bill"
        description={`Tower ${currentFlat.tower} • Flat ${currentFlat.flatNumber} — November 2026`}
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsPayModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSimulatePayment}
              disabled={paymentDone}
            >
              {paymentDone ? 'Payment Confirmed!' : `Pay ${formatPaiseToINR(duePaise)}`}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-control bg-surface-alt p-3.5 border border-border">
            <div className="flex justify-between text-xs text-text-secondary mb-1">
              <span>Base Maintenance ({currentFlat.areaSqFt} sq ft @ ₹6.50)</span>
              <span className="font-mono">{formatPaiseToINR(currentFlat.monthlyBillPaise)}</span>
            </div>
            {currentFlat.daysOverdue > 0 && (
              <div className="flex justify-between text-xs text-amber-700 mb-1">
                <span>Late fee ({currentFlat.daysOverdue} days overdue)</span>
                <span className="font-mono">₹0.00 (Demo Grace)</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-walnut-900 pt-2 border-t border-border">
              <span>Total Payable</span>
              <span className="font-mono text-sage-900">{formatPaiseToINR(duePaise)}</span>
            </div>
          </div>

          <div className="text-xs text-text-secondary space-y-2">
            <p className="font-medium text-text-primary">Simulated Payment Gateway (Test Mode)</p>
            <div className="p-2.5 rounded-control border border-sage-200 bg-sage-50 text-[11px] text-sage-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-sage-700" />
              <span>
                Deterministic mock gateway: Clicking Pay will record a verified receipt and update the flat ledger with zero floating-point error.
              </span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
