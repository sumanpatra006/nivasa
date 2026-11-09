import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommitteeDashboardPage } from '../pages/CommitteeDashboardPage.js';
import { ApiClient } from '../services/api.js';

// Hoist mock metrics for vi.mock
const { mockCommitteeMetrics } = vi.hoisted(() => {
  return {
    mockCommitteeMetrics: {
      currentBillingPeriod: '2026-11',
      generatedAt: '2026-11-09T12:00:00Z',
      summary: {
        totalApartments: 2400,
        totalTowers: 28,
        totalBilledPaise: 2545500, // ₹25,455.00
        totalCollectedPaise: 1247500, // ₹12,475.00
        totalOverduePaise: 1298000, // ₹12,980.00
        collectionEfficiencyPct: 49.0,
      },
      financialMetrics: {
        totalBilledPaise: 2545500,
        totalCollectedPaise: 1247500,
        outstandingBalancePaise: 1298000,
        collectionPercentage: 49.0,
        invoicesCount: 3,
        paidInvoicesCount: 1,
        partiallyPaidInvoicesCount: 1,
        overdueInvoicesCount: 2,
      },
      duesAgeing: {
        definitionNotice: 'Dues ageing categories are management reporting buckets, not legal definitions.',
        totalOutstandingPaise: 1298000,
        buckets: [
          {
            key: 'CURRENT',
            label: 'Current / Not Overdue',
            dayRange: '0 days',
            count: 1,
            amountPaise: 0,
            percentageOfOutstanding: 0,
            color: 'bg-emerald-500',
          },
          {
            key: 'DAYS_1_30',
            label: '1–30 Days Overdue',
            dayRange: '1–30 days',
            count: 1,
            amountPaise: 599000,
            percentageOfOutstanding: 46.1,
            color: 'bg-amber-400',
          },
          {
            key: 'DAYS_31_60',
            label: '31–60 Days Overdue',
            dayRange: '31–60 days',
            count: 1,
            amountPaise: 699000,
            percentageOfOutstanding: 53.9,
            color: 'bg-amber-600',
          },
          {
            key: 'DAYS_61_90',
            label: '61–90 Days Overdue',
            dayRange: '61–90 days',
            count: 0,
            amountPaise: 0,
            percentageOfOutstanding: 0,
            color: 'bg-rose-500',
          },
          {
            key: 'DAYS_90_PLUS',
            label: '90+ Days Overdue',
            dayRange: '> 90 days',
            count: 0,
            amountPaise: 0,
            percentageOfOutstanding: 0,
            color: 'bg-rose-700',
          },
        ],
      },
      flatOutstandingAccounts: [
        {
          flatId: 'flat-t12-0408',
          tower: 'T12',
          flatNumber: '0408',
          residentName: 'Swati Joshi',
          residentPhone: '9820000002',
          billingPeriod: '2026-11',
          totalBilledPaise: 699000,
          paidAmountPaise: 0,
          outstandingBalancePaise: 699000,
          daysOverdue: 47,
          ageingBucket: '31–60 Days Overdue',
          status: 'OVERDUE',
        },
        {
          flatId: 'flat-t21-1601',
          tower: 'T21',
          flatNumber: '1601',
          residentName: 'Aamir Shaikh',
          residentPhone: '9820000003',
          billingPeriod: '2026-11',
          totalBilledPaise: 1099000,
          paidAmountPaise: 500000,
          outstandingBalancePaise: 599000,
          daysOverdue: 18,
          ageingBucket: '1–30 Days Overdue',
          status: 'OVERDUE',
        },
      ],
      complaintMetrics: {
        totalComplaints: 2,
        openComplaints: 1,
        resolvedComplaints: 1,
        reopenedCount: 0,
        reopenedRatePct: 0.0,
        averageResponseTimeMinutes: 25,
        averageResolutionTimeHours: 4.0,
        calculationDocumentation: {
          responseTimeFormula: 'Time from registration to first staff action in timeline.',
          resolutionTimeFormula: 'Time from registration to resolvedAt timestamp in hours.',
          reopenedRateFormula: '(Count of reopened / total) * 100.',
          disclaimer: 'Response time is never derived from resolution time.',
        },
      },
      disclosures: {
        isSampleData: true,
        sampleAccountsCount: 3,
        townshipTotalFlats: 2400,
        historicalDataAvailable: false,
        operationalImprovementClaimed: false,
        notes: [
          'Metrics reflect authoritative seeded database records.',
          'Operational targets from brief are benchmark goals.',
        ],
      },
    },
  };
});

vi.mock('../services/api.js', () => {
  return {
    ApiClient: {
      authenticateCommittee: vi.fn().mockResolvedValue('mock-committee-token'),
      getCommitteeDashboard: vi.fn().mockResolvedValue(mockCommitteeMetrics),
      downloadMonthlyCollectionCsv: vi.fn().mockResolvedValue('Tower,Flat,Resident\nT12,0408,Swati Joshi\nTOTAL,,,'),
    },
  };
});

describe('CommitteeDashboardPage UI & Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders executive committee oversight dashboard with financial stat cards', async () => {
    render(<CommitteeDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Federation Committee Oversight')).toBeInTheDocument();
      expect(screen.getByText('Total Maintenance Billed (2026-11)')).toBeInTheDocument();
      expect(screen.getByText('Collections Realized')).toBeInTheDocument();
      expect(screen.getByText('Outstanding Balance')).toBeInTheDocument();
    });

    expect(screen.getByText('49% collection efficiency')).toBeInTheDocument();
    expect(screen.getByText('2 flat account(s) overdue')).toBeInTheDocument();
  });

  it('renders dues ageing breakdown with all 5 configurable reporting buckets', async () => {
    render(<CommitteeDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Dues Ageing Distribution')).toBeInTheDocument();
    });

    expect(screen.getByText('Current / Not Overdue')).toBeInTheDocument();
    expect(screen.getAllByText('1–30 Days Overdue').length).toBeGreaterThan(0);
    expect(screen.getAllByText('31–60 Days Overdue').length).toBeGreaterThan(0);
    expect(screen.getByText('61–90 Days Overdue')).toBeInTheDocument();
    expect(screen.getByText('90+ Days Overdue')).toBeInTheDocument();

    expect(screen.getByText('46.1%')).toBeInTheDocument();
    expect(screen.getByText('53.9%')).toBeInTheDocument();
  });

  it('renders flat-level outstanding accounts table with units, balances, and overdue days', async () => {
    render(<CommitteeDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Flat-Level Outstanding Accounts')).toBeInTheDocument();
      expect(screen.getByText('Tower T12 - 0408')).toBeInTheDocument();
      expect(screen.getByText('Swati Joshi')).toBeInTheDocument();
      expect(screen.getByText('Tower T21 - 1601')).toBeInTheDocument();
      expect(screen.getByText('Aamir Shaikh')).toBeInTheDocument();
    });

    expect(screen.getByText('47d')).toBeInTheDocument();
    expect(screen.getByText('18d')).toBeInTheDocument();
  });

  it('renders complaint service level metrics with calculation documentation disclaimer', async () => {
    render(<CommitteeDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Help Desk Service Level Compliance')).toBeInTheDocument();
      expect(screen.getByText('25 minutes')).toBeInTheDocument();
      expect(screen.getByText('4 hours')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Response time is never derived from resolution time/i)
    ).toBeInTheDocument();
  });

  it('triggers CSV download when Export Monthly Report button is clicked', async () => {
    // Mock URL.createObjectURL, URL.revokeObjectURL, and HTMLAnchorElement.prototype.click
    const originalCreateObjectUrl = window.URL.createObjectURL;
    const originalRevokeObjectUrl = window.URL.revokeObjectURL;
    const originalAnchorClick = HTMLAnchorElement.prototype.click;

    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();

    render(<CommitteeDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Export Monthly Report (CSV)')).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole('button', { name: /export monthly report \(csv\)/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(ApiClient.downloadMonthlyCollectionCsv).toHaveBeenCalledWith('2026-11');
      expect(window.URL.createObjectURL).toHaveBeenCalled();
    });

    window.URL.createObjectURL = originalCreateObjectUrl;
    window.URL.revokeObjectURL = originalRevokeObjectUrl;
    HTMLAnchorElement.prototype.click = originalAnchorClick;
  });
});
