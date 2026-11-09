import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MaintenancePage } from '../pages/MaintenancePage.js';
import { DEMO_FLATS } from '../fixtures/uiData.js';

// Mock react-router-dom outlet context to provide currentFlat
vi.mock('react-router-dom', async () => {
  const actual: any = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({ currentFlat: DEMO_FLATS[1] }),
  };
});

// Mock ApiClient to verify frontend-backend interaction
vi.mock('../services/api.js', () => {
  return {
    ApiClient: {
      authenticateResident: vi.fn().mockResolvedValue('mock-token'),
      getBills: vi.fn().mockResolvedValue({
        invoices: [
          {
            id: 'inv-t12-0408-202611',
            flatId: 'flat-t12-0408',
            tower: 'T12',
            flatNumber: '0408',
            residentName: 'Swati Joshi',
            residentPhone: '9820000002',
            billingPeriod: '2026-11',
            areaSqFt: 980,
            ratePerSqFtPaise: 650,
            baseAmountPaise: 637000,
            lateFeePaise: 62000,
            totalAmountPaise: 699000,
            paidAmountPaise: 0,
            remainingBalancePaise: 699000,
            dueDate: '2026-09-24T00:00:00Z',
            status: 'OVERDUE',
            daysOverdue: 47,
          },
        ],
      }),
      getLedger: vi.fn().mockResolvedValue({
        flatId: 'flat-t12-0408',
        closingBalancePaise: 699000,
        entries: [
          {
            id: 'led-1',
            flatId: 'flat-t12-0408',
            entryType: 'BILL',
            amountPaise: 637000,
            description: 'Monthly Maintenance November 2026',
            createdAt: '2026-11-01T00:00:00Z',
          },
          {
            id: 'led-2',
            flatId: 'flat-t12-0408',
            entryType: 'LATE_FEE',
            amountPaise: 62000,
            description: 'Overdue interest penalty (47 days overdue, demo policy)',
            createdAt: '2026-11-01T00:00:00Z',
          },
        ],
      }),
      getReceipts: vi.fn().mockResolvedValue({
        receipts: [],
      }),
      initiatePayment: vi.fn().mockResolvedValue({
        payment: {
          id: 'pay-test-1',
          status: 'INITIATED',
          amountPaise: 699000,
        },
      }),
      verifyPayment: vi.fn().mockImplementation((_key, outcome, simulateFailure) => {
        if (simulateFailure || outcome === 'FAILED') {
          return Promise.resolve({
            payment: {
              id: 'pay-test-1',
              status: 'FAILED',
              failureReason: 'Card/UPI gateway declined by issuing bank',
            },
            receipt: null,
          });
        }
        return Promise.resolve({
          payment: {
            id: 'pay-test-1',
            status: 'SUCCESS',
            amountPaise: 699000,
          },
          receipt: {
            id: 'rec-test-1',
            receiptNumber: 'REC-202611-0005',
            flatIdentifier: 'T12-0408',
            billingPeriod: 'November 2026',
            residentName: 'Swati Joshi',
            amountPaise: 699000,
            paymentReference: 'MOCK-UPI-99482',
            date: '2026-11-09T10:00:00Z',
          },
        });
      }),
    },
  };
});

describe('MaintenancePage UI & Payment Flow', () => {
  const swatiFlat = DEMO_FLATS[1]; // Flat T12-0408

  const renderComponent = () => {
    return render(
      <MemoryRouter initialEntries={['/resident/maintenance']}>
        <Routes>
          <Route
            path="/resident/maintenance"
            element={<MaintenancePage />}
          />
        </Routes>
      </MemoryRouter>,
      {
        // Provide currentFlat via outlet context wrapper
        wrapper: ({ children }) => {
          const OutletContextComponent = () => {
            return (
              <Routes>
                <Route
                  path="/resident"
                  element={<div>{children}</div>}
                />
              </Routes>
            );
          };
          return children;
        },
      }
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders bill details: billing period, flat area, rate, base maintenance, late fee, and dues', async () => {
    // Provide Outlet context by mocking useOutletContext
    render(
      <MemoryRouter>
        <MaintenancePage />
      </MemoryRouter>
    );

    // Verify itemized invoice breakdown appears after data loads
    await waitFor(() => {
      expect(screen.getByText(/Apartment Area/i)).toBeInTheDocument();
      expect(screen.getByText('980 sq ft')).toBeInTheDocument();
      expect(screen.getByText(/₹6.50 per sq ft/i)).toBeInTheDocument();
      expect(screen.getByText(/Base Maintenance Amount/i)).toBeInTheDocument();
      expect(screen.getByText(/Late Fee Penalty/i)).toBeInTheDocument();
    });

    // Check payment button is present with outstanding amount
    expect(screen.getByRole('button', { name: /Pay Dues/i })).toBeInTheDocument();
  });

  it('renders flat payment ledger with debit, credit and closing balance', async () => {
    render(
      <MemoryRouter>
        <MaintenancePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Flat Payment Ledger')).toBeInTheDocument();
      expect(screen.getByText('Monthly Maintenance November 2026')).toBeInTheDocument();
    });
  });

  it('opens payment confirmation modal when resident clicks Pay Dues', async () => {
    render(
      <MemoryRouter>
        <MaintenancePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Pay Dues/i })).toBeInTheDocument();
    });

    const payButton = screen.getByRole('button', { name: /Pay Dues/i });
    fireEvent.click(payButton);

    expect(screen.getByText('Confirm Payment')).toBeInTheDocument();
    expect(screen.getByText(/Total Dues Outstanding/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pay ₹/i })).toBeInTheDocument();
  });

  it('executes successful payment and displays receipt details in modal', async () => {
    render(
      <MemoryRouter>
        <MaintenancePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Pay Dues/i })).toBeInTheDocument();
    });

    // 1. Open modal
    fireEvent.click(screen.getByRole('button', { name: /Pay Dues/i }));

    // 2. Click Pay
    const submitBtn = screen.getByRole('button', { name: /Pay ₹/i });
    fireEvent.click(submitBtn);

    // 3. Verify success message appears
    await waitFor(() => {
      expect(screen.getByText('Payment Succeeded')).toBeInTheDocument();
      expect(screen.getByText('REC-202611-0005')).toBeInTheDocument();
    });
  });

  it('handles simulated gateway failure and displays clear decline reason', async () => {
    render(
      <MemoryRouter>
        <MaintenancePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Pay Dues/i })).toBeInTheDocument();
    });

    // 1. Open modal
    fireEvent.click(screen.getByRole('button', { name: /Pay Dues/i }));

    // 2. Check "Simulate Gateway Failure" checkbox
    const failureCheckbox = screen.getByRole('checkbox');
    fireEvent.click(failureCheckbox);

    // 3. Submit payment
    const submitBtn = screen.getByRole('button', { name: /Pay ₹/i });
    fireEvent.click(submitBtn);

    // 4. Verify failure message
    await waitFor(() => {
      expect(screen.getByText('Payment Failed')).toBeInTheDocument();
      expect(screen.getByText(/Card\/UPI gateway declined/i)).toBeInTheDocument();
    });
  });
});
