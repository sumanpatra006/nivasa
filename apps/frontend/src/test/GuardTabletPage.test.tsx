import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GuardTabletPage } from '../pages/GuardTabletPage.js';
import { ApiClient } from '../services/api.js';

vi.mock('../services/api.js', () => {
  return {
    ApiClient: {
      authenticateGuard: vi.fn().mockResolvedValue('mock-guard-token'),
      getVisitors: vi.fn().mockResolvedValue({
        visitors: [
          {
            id: 'vis-1',
            flatId: 'flat-t07-1203',
            tower: 'T07',
            flatNumber: '1203',
            residentName: 'Neeraj Kulkarni',
            visitorName: 'Sunil Delivery',
            purpose: 'Amazon Package',
            entryStatus: 'CHECKED_IN',
            approvalStatus: 'APPROVED',
            arrivedAt: '2026-11-09T10:15:00.000Z',
          },
        ],
      }),
      validateGuestCode: vi.fn().mockImplementation(async (code: string) => {
        if (code === '842619') {
          return {
            isValid: true,
            guestCode: { guestName: 'Kavita Kulkarni' },
            visitor: {
              id: 'vis-verified',
              visitorName: 'Kavita Kulkarni',
              tower: 'T07',
              flatNumber: '1203',
              entryStatus: 'CHECKED_IN',
              approvalStatus: 'APPROVED',
            },
          };
        }
        return { isValid: false, reason: 'Invalid or expired guest code' };
      }),
      registerVisitor: vi.fn().mockResolvedValue({
        visitor: {
          id: 'vis-new',
          visitorName: 'Swiggy Agent',
          flatId: 'flat-t07-1203',
          tower: 'T07',
          flatNumber: '1203',
          entryStatus: 'CHECKED_IN',
          approvalStatus: 'PENDING',
        },
      }),
      syncVisitorBatch: vi.fn().mockResolvedValue({
        syncedCount: 1,
        totalReceived: 1,
        visitors: [{ id: 'vis-synced', visitorName: 'Offline Milk Delivery' }],
      }),
      recordVisitorExit: vi.fn().mockResolvedValue({
        visitor: { id: 'vis-1', entryStatus: 'CHECKED_OUT' },
      }),
      purgeExpiredPhotos: vi.fn().mockResolvedValue({
        message: 'DPDP 90-day retention purge completed',
        purgedPhotosCount: 2,
        purgedFiles: ['sample1.jpg', 'sample2.jpg'],
        complianceStatus: 'DPDP_ACT_2023_COMPLIANT',
      }),
    },
  };
});

describe('GuardTabletPage UI & Offline Terminal Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders tablet terminal header with DPDP privacy notice and large touch tabs', async () => {
    render(<GuardTabletPage />);

    expect(screen.getByText(/Gate 1 • Security Tablet Terminal/i)).toBeInTheDocument();
    expect(screen.getByText(/Gate Privacy Notice \(Digital Personal Data Protection Act/i)).toBeInTheDocument();
    expect(screen.getByText(/Pass PIN Keypad/i)).toBeInTheDocument();
    expect(screen.getByText(/Register Visitor/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Gate Log/i)).toBeInTheDocument();
  });

  it('handles 6-digit numeric keypad entry and validates guest pass PIN', async () => {
    render(<GuardTabletPage />);

    // Enter 842619 via PIN input / keypad
    const pinInput = screen.getByLabelText(/Guest pass 6-digit PIN/i);
    fireEvent.change(pinInput, { target: { value: '842619' } });

    // Click Verify PIN & Check In Guest
    const verifyBtn = screen.getByRole('button', { name: /Verify PIN & Check In Guest/i });
    await waitFor(() => {
      expect(verifyBtn).not.toBeDisabled();
    });
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(ApiClient.validateGuestCode).toHaveBeenCalledWith('842619');
      expect(screen.getAllByText(/ACCESS GRANTED/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Access Approved! Kavita Kulkarni checked in/i)).toBeInTheDocument();
    });
  });

  it('supports offline visitor registration and stores entries in local queue', async () => {
    render(<GuardTabletPage />);

    // Enable offline simulation
    const offlineToggle = screen.getByRole('button', { name: /Simulate Offline/i });
    fireEvent.click(offlineToggle);
    expect(screen.getByText(/Offline \(Local Queue Active\)/i)).toBeInTheDocument();

    // Navigate to Register Visitor tab
    fireEvent.click(screen.getByRole('button', { name: /Register Visitor/i }));

    // Fill form
    const nameInput = screen.getByPlaceholderText(/e.g. Ramesh Kumar/i);
    fireEvent.change(nameInput, { target: { value: 'Offline Cable Tech' } });

    // Submit registration while offline
    const submitBtn = screen.getByRole('button', { name: /Register & Check In Visitor/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Recorded Offline! Visitor stored in tablet local queue/i)).toBeInTheDocument();
    });

    // Verify item was saved in localStorage
    const savedQueue = JSON.parse(localStorage.getItem('nivasa_guard_offline_queue') || '[]');
    expect(savedQueue).toHaveLength(1);
    expect(savedQueue[0].visitorName).toBe('Offline Cable Tech');
  });

  it('triggers 90-day DPDP Act photo file purge job and shows purged count', async () => {
    render(<GuardTabletPage />);

    const purgeBtn = screen.getByRole('button', { name: /Run 90-Day Purge Job/i });
    fireEvent.click(purgeBtn);

    await waitFor(() => {
      expect(ApiClient.purgeExpiredPhotos).toHaveBeenCalled();
      expect(screen.getByText(/DPDP Act 2023 purge complete: 2 expired photo files removed from disk/i)).toBeInTheDocument();
    });
  });
});

