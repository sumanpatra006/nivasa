import React from 'react';
import { Link } from 'react-router-dom';
import { Wrench, ArrowRightLeft, ShieldAlert, CheckCircle2, Clock, Users } from 'lucide-react';
import { StatCard } from '../components/ui/StatCard.js';
import { Button } from '../components/ui/Button.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { DEMO_COMPLAINTS, DEMO_RECONCILIATION_QUEUE } from '../fixtures/uiData.js';

export function StaffOverviewPage() {
  const criticalComplaints = DEMO_COMPLAINTS.filter((c) => c.isSafetyEscalation);
  const pendingReconciliations = DEMO_RECONCILIATION_QUEUE.filter((r) => r.status !== 'Posted');

  return (
    <div className="space-y-6">
      {/* Critical Alert Banner if Safety Issues Exist */}
      {criticalComplaints.length > 0 && (
        <div className="p-4 rounded-surface border border-rose-300 bg-status-danger-bg text-status-danger flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-status-danger text-white">
              <ShieldAlert className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold">
                {criticalComplaints.length} Critical Safety Escalation Active
              </h3>
              <p className="text-xs text-status-danger/90">
                Lift stuck between 4th & 5th floor in Tower T07. Senior resident inside. OTIS technician on-site.
              </p>
            </div>
          </div>
          <Link to="/staff/complaints">
            <Button variant="danger" size="sm">
              View Emergency Ticket
            </Button>
          </Link>
        </div>
      )}

      {/* Operational Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Open Complaints"
          value={DEMO_COMPLAINTS.length}
          subValue="2 assigned, 1 in progress"
          icon={<Wrench className="h-4 w-4 text-walnut-500" />}
        />
        <StatCard
          label="Safety Critical"
          value={criticalComplaints.length}
          variant="danger"
          subValue="Requires immediate SLA"
          icon={<ShieldAlert className="h-4 w-4 text-status-danger" />}
        />
        <StatCard
          label="Bank Matches Pending"
          value={pendingReconciliations.length}
          variant="warning"
          subValue="1 high confidence (95%)"
          icon={<ArrowRightLeft className="h-4 w-4 text-amber-500" />}
        />
        <StatCard
          label="On-Duty Technicians"
          value="4"
          subValue="Plumbing, Electrical, Lift"
          icon={<Users className="h-4 w-4 text-sage-500" />}
        />
      </div>

      {/* Quick Action Workspaces */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Help Desk Queue Teaser */}
        <div className="rounded-surface border border-border bg-surface p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-sm font-bold text-walnut-900">Help Desk Queue</h3>
              <Link to="/staff/complaints" className="text-xs text-sage-700 hover:underline">
                View all queue →
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {DEMO_COMPLAINTS.slice(0, 2).map((c) => (
                <div key={c.id} className="p-2.5 rounded-control border border-border text-xs flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-walnut-900 block">{c.title}</span>
                    <span className="text-[11px] text-text-muted">Flat {c.flat} • {c.category}</span>
                  </div>
                  <StatusBadge variant={c.isSafetyEscalation ? 'critical' : 'assigned'} label={c.status} />
                </div>
              ))}
            </div>
          </div>
          <div className="pt-4 mt-2">
            <Link to="/staff/complaints">
              <Button variant="outline" size="sm" className="w-full">
                Open Help Desk Dispatch Console
              </Button>
            </Link>
          </div>
        </div>

        {/* Bank Reconciliation Teaser */}
        <div className="rounded-surface border border-border bg-surface p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-sm font-bold text-walnut-900">Bank Statement Reconciliation</h3>
              <Link to="/staff/reconciliation" className="text-xs text-sage-700 hover:underline">
                Open queue →
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {pendingReconciliations.slice(0, 2).map((r) => (
                <div key={r.id} className="p-2.5 rounded-control border border-border text-xs flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-walnut-900 block font-mono">₹{(r.amountPaise / 100).toLocaleString('en-IN')}</span>
                    <span className="text-[11px] text-text-muted">{r.description}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-sage-700 bg-sage-50 px-2 py-0.5 rounded-full border border-sage-200">
                    {Math.round(r.confidence * 100)}% Match
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-4 mt-2">
            <Link to="/staff/reconciliation">
              <Button variant="outline" size="sm" className="w-full">
                Review & Confirm Matches
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

