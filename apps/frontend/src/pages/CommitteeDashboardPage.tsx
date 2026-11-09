import React, { useState } from 'react';
import {
  Download,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  FileSpreadsheet,
} from 'lucide-react';
import { StatCard } from '../components/ui/StatCard.js';
import { Button } from '../components/ui/Button.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { DEMO_COMMITTEE_METRICS } from '../fixtures/uiData.js';
import { formatPaiseToINR } from '@nivasa/shared';

export function CommitteeDashboardPage() {
  const [isExporting, setIsExporting] = useState(false);
  const metrics = DEMO_COMMITTEE_METRICS;

  const handleExportCSV = () => {
    setIsExporting(true);
    setTimeout(() => {
      // Simulate CSV file download
      const csvHeader = 'Tower,Flats,Area SqFt,Billed INR,Collected INR,Overdue INR,Collection Efficiency\n';
      const csvRows = [
        'T01 to T06,514,591100,3842150,3457935,384215,90.0%',
        'T07 to T12,514,591100,3842150,3457935,384215,90.0%',
        'T13 to T18,514,591100,3842150,3457935,384215,90.0%',
        'T19 to T24,514,591100,3842150,3457935,384215,90.0%',
        'T25 to T28,344,404830,2631400,2368260,263140,90.0%',
        'All 28 Towers (Total),2400,2769230,18000000,16200000,1800000,90.0%',
      ].join('\n');

      const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Nivasa_Monthly_Collection_November_2026.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsExporting(false);
    }, 600);
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

        <Button
          variant="secondary"
          size="md"
          leftIcon={<Download className="h-4 w-4" />}
          isLoading={isExporting}
          onClick={handleExportCSV}
        >
          Export Monthly Report (CSV)
        </Button>
      </div>

      {/* Top Financial Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Billed (Nov 2026)"
          value={formatPaiseToINR(metrics.totalBilledPaise)}
          subValue="2,400 flats @ ₹6.50/sq ft"
          icon={<Building2 className="h-4 w-4 text-walnut-500" />}
        />
        <StatCard
          label="Collections Achieved"
          value={formatPaiseToINR(metrics.totalCollectedPaise)}
          variant="accent"
          subValue="90.0% collection efficiency"
          badge={<StatusBadge variant="paid" label="On Track" />}
          icon={<CheckCircle2 className="h-4 w-4 text-sage-700" />}
        />
        <StatCard
          label="Outstanding Dues"
          value={formatPaiseToINR(metrics.totalOverduePaise)}
          variant="warning"
          subValue="Across 28 towers"
          badge={<StatusBadge variant="warning" label="10.0% Pending" />}
          icon={<AlertCircle className="h-4 w-4 text-amber-600" />}
        />
        <StatCard
          label="Complaint Reopen Rate"
          value={`${metrics.operationalMetrics.reopenRatePct}%`}
          variant="accent"
          subValue="Target < 8% (Brief Success Target)"
          badge={<StatusBadge variant="paid" label="Target Met" />}
          icon={<Clock className="h-4 w-4 text-sage-700" />}
        />
      </div>

      {/* Dues Ageing Breakdown per TDD.md Section 3 */}
      <div className="rounded-surface border border-border bg-surface p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border gap-2">
          <div>
            <h3 className="text-sm font-bold text-walnut-900">Dues Ageing Distribution</h3>
            <p className="text-xs text-text-muted">
              Analysis of outstanding balances bucketed by days overdue
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-text-secondary">
            Total Outstanding: {formatPaiseToINR(metrics.totalOverduePaise)}
          </span>
        </div>

        {/* Proportional Ageing Visualizer */}
        <div className="my-5">
          <div className="w-full h-3 rounded-full bg-surface-alt overflow-hidden flex shadow-inner">
            {metrics.duesAgeing.map((bucket, i) => (
              <div
                key={i}
                className={`${bucket.color} transition-all`}
                style={{ width: `${bucket.pct}%` }}
                title={`${bucket.label}: ${bucket.pct}%`}
              />
            ))}
          </div>
        </div>

        {/* Buckets Table */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {metrics.duesAgeing.map((bucket, i) => (
            <div key={i} className="p-3.5 rounded-control border border-border bg-surface-alt/40 space-y-1">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${bucket.color}`} />
                <span className="text-xs font-semibold text-text-primary">{bucket.label}</span>
              </div>
              <div className="text-lg font-bold text-walnut-900 font-mono tabular-nums">
                {formatPaiseToINR(bucket.amountPaise)}
              </div>
              <span className="text-[11px] text-text-muted block">
                {bucket.pct}% of total overdue
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Complaint Response SLA Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-surface border border-border bg-surface p-5 shadow-xs">
          <h3 className="text-sm font-bold text-walnut-900 pb-3 border-b border-border">
            Help Desk Service Level Compliance
          </h3>
          <div className="mt-4 space-y-3.5 text-xs">
            <div className="flex justify-between items-center py-1">
              <span className="text-text-secondary">Average Initial Response Time</span>
              <span className="font-mono font-bold text-text-primary tabular-nums">
                {metrics.operationalMetrics.avgResponseMinutes} minutes
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-text-secondary">Average Mean Time to Resolve (MTTR)</span>
              <span className="font-mono font-bold text-text-primary tabular-nums">
                {metrics.operationalMetrics.avgResolutionHours} hours
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-text-secondary">Open Complaints Across Society</span>
              <span className="font-mono font-bold text-text-primary tabular-nums">
                {metrics.operationalMetrics.openComplaints} tickets
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-t border-border pt-2">
              <span className="text-text-secondary">Reopened Complaints (Quality Index)</span>
              <span className="font-mono font-bold text-sage-900 tabular-nums">
                {metrics.operationalMetrics.reopenRatePct}% ({metrics.operationalMetrics.reopenedCount} tickets)
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-surface border border-border bg-surface p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-walnut-900 pb-3 border-b border-border">
              Certified Monthly Operations Report
            </h3>
            <p className="mt-3 text-xs text-text-secondary leading-relaxed">
              Every month, a reconciliation summary is prepared for the federation committee and management company auditors. This document confirms all 28 towers, bank deposits, and overdue notices.
            </p>
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <FileSpreadsheet className="h-4 w-4 text-sage-700" />
              <span>Format: CSV (Tally Compatible)</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="h-3.5 w-3.5" />}
              onClick={handleExportCSV}
            >
              Download
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

