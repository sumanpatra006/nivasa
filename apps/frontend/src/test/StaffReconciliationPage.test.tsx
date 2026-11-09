import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StaffReconciliationPage } from '../pages/StaffReconciliationPage.js';

// Mock ApiClient
vi.mock('../services/api.js', () => {
  return {
    ApiClient: {
      authenticateStaff: vi.fn().mockResolvedValue('mock-staff-token'),
      getReconciliationQueue: vi.fn().mockResolvedValue({
        queue: [
          {
            id: 'txn-1',
            transaction: {
              id: 'txn-1',
              rowNumber: 2,
              rawRow: '2026-11-02,7475.00,UPI123,neeraj@oksbi,Maintenance payment for T07-1203 Neeraj Kulkarni',
              transactionDate: '2026-11-02T10:15:00.000Z',
              amountPaise: 747500,
              reference: 'UPI123',
              upiId: 'neeraj@oksbi',
              description: 'Maintenance payment for T07-1203 Neeraj Kulkarni',
              isDuplicateInBatch: false,
            },
            status: 'SUGGESTED',
            suggestedMatch: {
              invoiceId: 'inv-t07-1203-202611',
              flatIdentifier: 'T07-1203',
              candidateInvoice: {
                id: 'inv-t07-1203-202611',
                balancePaise: 747500,
                dueDate: '2026-11-10T00:00:00Z',
              },
              candidateFlat: {
                flatId: 'flat-t07-1203',
                tower: 'T07',
                flatNumber: '1203',
                residentName: 'Neeraj Kulkarni',
              },
              confidence: 0.95,
              matchingReasons: [
                'Exact flat code "T07-1203" found in narration (+35 pts)',
                'Exact amount match: ₹7475.00 (+25 pts)',
                'Resident name "Neeraj Kulkarni" (+20 pts)',
              ],
              missingEvidence: [],
            },
            alternativeMatches: [],
            isAmbiguous: false,
          },
        ],
      }),
      getReconciliationBatches: vi.fn().mockResolvedValue({
        batches: [
          {
            id: 'batch-1',
            filename: 'statement_nov.csv',
            fileHash: 'sample-hash-1',
            uploadedAt: '2026-11-02T10:00:00Z',
            totalRows: 4,
            processedRows: 4,
            duplicateRows: 0,
            invalidRows: 0,
            rowErrors: [],
          },
        ],
      }),
      searchCandidates: vi.fn().mockResolvedValue({
        candidates: [
          {
            id: 'inv-t07-1203-202611',
            flatId: 'flat-t07-1203',
            tower: 'T07',
            flatNumber: '1203',
            residentName: 'Neeraj Kulkarni',
            balancePaise: 747500,
            dueDate: '2026-11-10T00:00:00Z',
          },
        ],
      }),
      confirmReconciliationMatch: vi.fn().mockResolvedValue({
        transaction: {
          id: 'txn-1',
          transaction: { amountPaise: 747500 },
          status: 'POSTED',
          suggestedMatch: { flatIdentifier: 'T07-1203' },
        },
        receipt: { receiptNumber: 'REC-202611-0001' },
      }),
      rejectReconciliationMatch: vi.fn().mockResolvedValue({
        transaction: { id: 'txn-1', status: 'REJECTED' },
      }),
      markReconciliationReview: vi.fn().mockResolvedValue({
        transaction: { id: 'txn-1', status: 'NEEDS_REVIEW' },
      }),
      uploadBankCsv: vi.fn().mockResolvedValue({
        message: 'Imported',
        summary: { validRows: 3, suggestedCount: 1, needsReviewCount: 1, duplicateRows: 0 },
      }),
    },
  };
});

describe('StaffReconciliationPage UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders reconciliation queue table with transactions from API', async () => {
    render(
      <MemoryRouter>
        <StaffReconciliationPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Bank Statement Reconciliation')).toBeInTheDocument();
      expect(screen.getByText('UPI123')).toBeInTheDocument();
      expect(screen.getByText('T07-1203')).toBeInTheDocument();
      expect(screen.getByText('95%')).toBeInTheDocument();
    });
  });

  it('opens review evidence modal displaying positive reasons and raw CSV row', async () => {
    render(
      <MemoryRouter>
        <StaffReconciliationPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Review Evidence')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Review Evidence'));

    await waitFor(() => {
      expect(screen.getByText(/Transaction Match Evidence & Review/i)).toBeInTheDocument();
      expect(screen.getByText(/Raw CSV Row Data:/i)).toBeInTheDocument();
      expect(screen.getByText(/Exact flat code "T07-1203" found in narration/i)).toBeInTheDocument();
    });
  });

  it('confirms match and displays success confirmation notice', async () => {
    render(
      <MemoryRouter>
        <StaffReconciliationPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Confirm & Post')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Confirm & Post'));

    await waitFor(() => {
      expect(screen.getByText(/Successfully posted/i)).toBeInTheDocument();
    });
  });

  it('opens CSV import modal when clicking Import Bank CSV Statement', async () => {
    render(
      <MemoryRouter>
        <StaffReconciliationPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Import Bank CSV Statement/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Import Bank CSV Statement/i }));

    expect(screen.getByText(/Drag & drop bank CSV statement here/i)).toBeInTheDocument();
  });
});

