import React, { useState, useEffect } from 'react';
import {
  Download,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  FileSpreadsheet,
  RefreshCw,
  Info,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { StatCard } from '../components/ui/StatCard.js';
import { Button } from '../components/ui/Button.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { formatPaiseToINR, CommitteeDashboardMetrics } from '@nivasa/shared';
import { ApiClient } from '../services/api.js';

export function CommitteeDashboardPage() {
  const [metrics, setMetrics] = useState<CommitteeDashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-11');

  const loadMetrics = async (period: string = selectedPeriod) => {
    setIsLoading(true);
    setError(null);
    try {
      await ApiClient.authenticateCommittee();
      const data = await ApiClient.getCommitteeDashboard(period);
      setMetrics(data);
    } catch (err: any) {
      console.error('Failed to load committee dashboard metrics:', err);
      setError(err.message || 'Failed to connect to committee reporting service');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics(selectedPeriod);
  }, [selectedPeriod]);

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      await ApiClient.authenticateCommittee();
      const csvContent = await ApiClient.downloadMonthlyCollectionCsv(selectedPeriod);

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Nivasa_Monthly_Collection_${selectedPeriod || 'all'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-walnut-900">
              Federation Committee Oversight
            </h1>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900 border border-amber-200">
              Executive View
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Certified operational collection metrics and complaint response times for 2,400 apartments in 28 towers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period Filter */}
          <div className="flex items-center gap-1.5 text-xs bg-surface border border-border rounded-control px-2.5 py-1.5">
            <Calendar className="h-3.5 w-3.5 text-text-muted" />
            <select
              aria-label="Filter billing period"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-transparent text-xs font-semibold text-text-primary focus:outline-none cursor-pointer"
            >
              <option value="2026-11">November 2026 (Current)</option>
              <option value="ALL">All Billing Periods</option>
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadMetrics(selectedPeriod)}
            leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Download className="h-4 w-4" />}
            isLoading={isExporting}
            onClick={handleExportCSV}
          >
            Export Monthly Report (CSV)
          </Button>
        </div>
      </div>

      {/* Audit & Data Provenance Notice Banner */}
      <div className="p-3.5 rounded-control border border-sage-300 bg-sage-50/70 text-xs text-sage-950 space-y-1">
        <div className="flex items-center gap-2 font-bold text-sage-900">
          <ShieldCheck className="h-4 w-4 text-sage-700 shrink-0" />
          <span>Authoritative Database Provenance & Operational Disclosures</span>
        </div>
        <p className="text-[11px] text-sage-900/90 leading-relaxed">
          • All figures are derived strictly from persisted ledger transactions and complaint tickets.
          • Operational targets (&lt;8% reopen rate, 90% collection efficiency) are benchmark goals from the product brief, not historical 6-month trends.
          • No historical society billing records exist in this system prior to November 2026.
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-surface border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadMetrics(selectedPeriod)}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-surface bg-surface-alt border border-border p-4"></div>
            ))}
          </div>
          <div className="h-48 rounded-surface bg-surface-alt border border-border animate-pulse"></div>
        </div>
      )}

      {/* Loaded Dashboard Content */}
      {!isLoading && metrics && (
        <>
          {/* Top Financial Stat Cards (FEATURE 1, 2, 3, 4) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label={`Total Maintenance Billed (${metrics.currentBillingPeriod})`}
              value={formatPaiseToINR(metrics.financialMetrics.totalBilledPaise)}
              subValue={`${metrics.financialMetrics.invoicesCount} active flat account(s) @ ₹6.50/sq ft`}
              icon={<Building2 className="h-4 w-4 text-walnut-500" />}
            />
            <StatCard
              label="Collections Realized"
              value={formatPaiseToINR(metrics.financialMetrics.totalCollectedPaise)}
              variant="accent"
              subValue={`${metrics.financialMetrics.collectionPercentage}% collection efficiency`}
              badge={
                <StatusBadge
                  variant={metrics.financialMetrics.collectionPercentage >= 70 ? 'paid' : 'warning'}
                  label={metrics.financialMetrics.collectionPercentage >= 70 ? 'On Track' : 'Below Target'}
                />
              }
              icon={<CheckCircle2 className="h-4 w-4 text-sage-700" />}
            />
            <StatCard
              label="Outstanding Balance"
              value={formatPaiseToINR(metrics.financialMetrics.outstandingBalancePaise)}
              variant="warning"
              subValue={`${metrics.financialMetrics.overdueInvoicesCount} flat account(s) overdue`}
              badge={
                <StatusBadge
                  variant={metrics.financialMetrics.outstandingBalancePaise === 0 ? 'paid' : 'warning'}
                  label={metrics.financialMetrics.outstandingBalancePaise === 0 ? 'Zero Dues' : 'Unpaid Dues'}
                />
              }
              icon={<AlertCircle className="h-4 w-4 text-amber-600" />}
            />
            <StatCard
              label="Complaint Reopen Rate"
              value={`${metrics.complaintMetrics.reopenedRatePct}%`}
              variant="accent"
              subValue="Quality Target < 8.0%"
              badge={
                <StatusBadge
                  variant={metrics.complaintMetrics.reopenedRatePct <= 8.0 ? 'paid' : 'critical'}
                  label={metrics.complaintMetrics.reopenedRatePct <= 8.0 ? 'Quality Goal Met' : 'Above Target'}
                />
              }
              icon={<Clock className="h-4 w-4 text-sage-700" />}
            />
          </div>

          {/* Dues Ageing Breakdown per TDD.md (FEATURE 5) */}
          <div className="rounded-surface border border-border bg-surface p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border gap-2">
              <div>
                <h3 className="text-sm font-bold text-walnut-900">Dues Ageing Distribution</h3>
                <p className="text-xs text-text-muted">
                  Configurable analysis of outstanding balances bucketed by days past invoice due date
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-walnut-900 block">
                  Total Outstanding: {formatPaiseToINR(metrics.duesAgeing.totalOutstandingPaise)}
                </span>
                <span className="text-[10px] text-text-muted italic block">
                  Reporting buckets, not legal definitions
                </span>
              </div>
            </div>

            {/* Proportional Ageing Visualizer */}
            <div className="my-5">
              <div className="w-full h-3.5 rounded-full bg-surface-alt overflow-hidden flex shadow-inner">
                {metrics.duesAgeing.buckets.map((bucket) => {
                  const width = bucket.percentageOfOutstanding > 0 ? bucket.percentageOfOutstanding : 0;
                  if (width === 0) return null;
                  return (
                    <div
                      key={bucket.key}
                      className={`${bucket.color} transition-all`}
                      style={{ width: `${width}%` }}
                      title={`${bucket.label}: ${formatPaiseToINR(bucket.amountPaise)} (${bucket.percentageOfOutstanding}%)`}
                    />
                  );
                })}
              </div>
            </div>

            {/* 5 Ageing Buckets Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
              {metrics.duesAgeing.buckets.map((bucket) => (
                <div key={bucket.key} className="p-3.5 rounded-control border border-border bg-surface-alt/40 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${bucket.color}`} />
                    <span className="text-xs font-semibold text-text-primary">{bucket.label}</span>
                  </div>
                  <div className="text-base font-bold text-walnut-900 font-mono tabular-nums">
                    {formatPaiseToINR(bucket.amountPaise)}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-text-muted">
                    <span>{bucket.count} flat(s)</span>
                    <span className="font-semibold text-text-secondary">{bucket.percentageOfOutstanding}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Flat-Level Outstanding Accounts Table (FEATURE 6) */}
          <div className="rounded-surface border border-border bg-surface shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border bg-surface-alt/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-walnut-900">Flat-Level Outstanding Accounts</h3>
                <p className="text-xs text-text-muted">
                  Line-item detail of units with pending maintenance dues
                </p>
              </div>
              <span className="text-xs font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded">
                {metrics.flatOutstandingAccounts.length} Unit(s) Pending
              </span>
            </div>

            {metrics.flatOutstandingAccounts.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted">
                No flat accounts with outstanding dues in this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-surface-alt/70 text-text-muted">
                      <th className="py-3 px-4 font-semibold">Unit & Tower</th>
                      <th className="py-3 px-4 font-semibold">Resident</th>
                      <th className="py-3 px-4 font-semibold">Billing Period</th>
                      <th className="py-3 px-4 font-semibold text-right">Billed (INR)</th>
                      <th className="py-3 px-4 font-semibold text-right">Paid (INR)</th>
                      <th className="py-3 px-4 font-semibold text-right">Outstanding (INR)</th>
                      <th className="py-3 px-4 font-semibold text-center">Overdue Days</th>
                      <th className="py-3 px-4 font-semibold">Ageing Bucket</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {metrics.flatOutstandingAccounts.map((account) => (
                      <tr key={account.flatId} className="hover:bg-surface-alt/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-walnut-900 whitespace-nowrap">
                          Tower {account.tower} - {account.flatNumber}
                        </td>
                        <td className="py-3 px-4 text-text-primary whitespace-nowrap">
                          {account.residentName}
                        </td>
                        <td className="py-3 px-4 text-text-muted whitespace-nowrap">
                          {account.billingPeriod}
                        </td>
                        <td className="py-3 px-4 font-mono text-right tabular-nums">
                          {formatPaiseToINR(account.totalBilledPaise)}
                        </td>
                        <td className="py-3 px-4 font-mono text-right tabular-nums text-emerald-700">
                          {formatPaiseToINR(account.paidAmountPaise)}
                        </td>
                        <td className="py-3 px-4 font-mono text-right tabular-nums font-bold text-rose-700">
                          {formatPaiseToINR(account.outstandingBalancePaise)}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-semibold">
                          {account.daysOverdue > 0 ? (
                            <span className="text-amber-800">{account.daysOverdue}d</span>
                          ) : (
                            <span className="text-text-muted">0d</span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-text-secondary">
                          {account.ageingBucket}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <StatusBadge
                            variant={account.status === 'OVERDUE' ? 'warning' : 'in-progress'}
                            label={account.status}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Complaint Service Level Oversight (FEATURE 7, 8, 9, 10) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-surface border border-border bg-surface p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-walnut-900 pb-3 border-b border-border">
                Help Desk Service Level Compliance
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-1">
                  <span className="text-text-secondary">Total Complaints Logged</span>
                  <span className="font-mono font-bold text-text-primary tabular-nums">
                    {metrics.complaintMetrics.totalComplaints} tickets
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-text-secondary">Currently Open Complaints</span>
                  <span className="font-mono font-bold text-amber-800 tabular-nums">
                    {metrics.complaintMetrics.openComplaints} tickets
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-text-secondary">Resolved Complaints</span>
                  <span className="font-mono font-bold text-emerald-700 tabular-nums">
                    {metrics.complaintMetrics.resolvedComplaints} tickets
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-text-secondary">Average Initial Response Time</span>
                  <span className="font-mono font-bold text-text-primary tabular-nums">
                    {metrics.complaintMetrics.averageResponseTimeMinutes !== null
                      ? `${metrics.complaintMetrics.averageResponseTimeMinutes} minutes`
                      : 'Pending response data'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-text-secondary">Average Mean Time to Resolve (MTTR)</span>
                  <span className="font-mono font-bold text-text-primary tabular-nums">
                    {metrics.complaintMetrics.averageResolutionTimeHours !== null
                      ? `${metrics.complaintMetrics.averageResolutionTimeHours} hours`
                      : 'Pending resolved tickets'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-border pt-2">
                  <span className="text-text-secondary">Reopened Complaints (Quality Defect Rate)</span>
                  <span className="font-mono font-bold text-sage-950 tabular-nums">
                    {metrics.complaintMetrics.reopenedRatePct}% ({metrics.complaintMetrics.reopenedCount} ticket(s))
                  </span>
                </div>
              </div>
            </div>

            {/* Certified Monthly Operations Report & Methodology */}
            <div className="rounded-surface border border-border bg-surface p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-sm font-bold text-walnut-900 pb-3 border-b border-border">
                  Monthly Operations Report & Metric Formulas
                </h3>
                <div className="mt-3 space-y-2 text-[11px] text-text-secondary leading-relaxed bg-surface-alt p-3 rounded-control border border-border">
                  <p>
                    <strong>Response Time:</strong> {metrics.complaintMetrics.calculationDocumentation.responseTimeFormula}
                  </p>
                  <p>
                    <strong>Resolution Time:</strong> {metrics.complaintMetrics.calculationDocumentation.resolutionTimeFormula}
                  </p>
                  <p>
                    <strong>Reopened Rate:</strong> {metrics.complaintMetrics.calculationDocumentation.reopenedRateFormula}
                  </p>
                  <p className="italic text-text-muted pt-1">
                    {metrics.complaintMetrics.calculationDocumentation.disclaimer}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <FileSpreadsheet className="h-4 w-4 text-sage-700" />
                  <span>Format: CSV (Actual Persisted Records)</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Download className="h-3.5 w-3.5" />}
                  isLoading={isExporting}
                  onClick={handleExportCSV}
                >
                  Download CSV
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
