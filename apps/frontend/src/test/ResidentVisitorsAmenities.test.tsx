import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResidentVisitorsPage } from '../pages/ResidentVisitorsPage.js';
import { ResidentAmenitiesPage } from '../pages/ResidentAmenitiesPage.js';
import { DEMO_FLATS } from '../fixtures/uiData.js';
import { ApiClient } from '../services/api.js';

// Mock react-router-dom outlet context
vi.mock('react-router-dom', async () => {
  const actual: any = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({ currentFlat: DEMO_FLATS[0] }), // Neeraj Kulkarni (flat-t07-1203)
  };
});

vi.mock('../services/api.js', () => {
  return {
    ApiClient: {
      authenticateResident: vi.fn().mockResolvedValue('mock-resident-token'),
      getVisitors: vi.fn().mockResolvedValue({
        visitors: [
          {
            id: 'vis-1',
            visitorName: 'Sunil Verma',
            purpose: 'Amazon Delivery',
            approvalStatus: 'PENDING',
            entryStatus: 'CHECKED_IN',
          },
        ],
      }),
      getGuestCodes: vi.fn().mockResolvedValue({
        guestCodes: [
          {
            id: 'gc-1',
            guestName: 'Kavita Kulkarni',
            purpose: 'Family Visit',
            codePlain: '842619',
            validUntil: '2026-11-15T00:00:00Z',
            usageCount: 0,
            usageLimit: 2,
            isActive: true,
          },
        ],
      }),
      createGuestCode: vi.fn().mockResolvedValue({
        guestCode: {
          id: 'gc-new',
          guestName: 'Rohan Sharma',
          codePlain: '519342',
          validUntil: '2026-11-11T00:00:00Z',
          usageLimit: 1,
          usageCount: 0,
          isActive: true,
        },
      }),
      approveVisitor: vi.fn().mockResolvedValue({
        visitor: { id: 'vis-1', approvalStatus: 'APPROVED' },
      }),
      getAmenities: vi.fn().mockResolvedValue({
        amenities: [
          {
            id: 'amen-1',
            name: 'Main Clubhouse Hall',
            description: 'Community hall for events.',
            rules: 'Quiet hours after 10 PM.',
            feePaise: 500000,
            capacity: 150,
            openTime: '09:00',
            closeTime: '23:00',
            slotDurationMinutes: 120,
            isActive: true,
            isDemoFee: true,
          },
          {
            id: 'amen-2',
            name: 'Tennis Court 1',
            description: 'Synthetic hard court.',
            rules: 'Non-marking shoes only.',
            feePaise: 20000,
            capacity: 4,
            openTime: '06:00',
            closeTime: '21:00',
            slotDurationMinutes: 60,
            isActive: true,
            isDemoFee: true,
          },
        ],
        disclaimer: 'Demo fees only',
      }),
      getAmenitySlots: vi.fn().mockResolvedValue({
        amenityId: 'amen-2',
        date: '2026-11-10',
        slots: [
          {
            id: 'slot-1',
            amenityId: 'amen-2',
            date: '2026-11-10',
            startAt: '2026-11-10T06:00:00.000Z',
            endAt: '2026-11-10T07:00:00.000Z',
            label: '6:00 AM – 7:00 AM',
            isAvailable: true,
            feePaise: 20000,
          },
        ],
      }),
      getAmenityBookings: vi.fn().mockResolvedValue({
        bookings: [
          {
            id: 'book-1',
            amenityId: 'amen-2',
            amenityName: 'Tennis Court 1',
            flatId: 'flat-t07-1203',
            flatIdentifier: 'T07-1203',
            startAt: '2026-11-10T07:00:00.000Z',
            endAt: '2026-11-10T08:00:00.000Z',
            feePaise: 20000,
            status: 'CONFIRMED',
          },
        ],
      }),
      bookAmenity: vi.fn().mockResolvedValue({
        booking: {
          id: 'book-new',
          amenityId: 'amen-2',
          amenityName: 'Tennis Court 1',
          status: 'CONFIRMED',
          feePaise: 20000,
        },
      }),
      cancelAmenityBooking: vi.fn().mockResolvedValue({
        booking: { id: 'book-1', status: 'CANCELLED' },
      }),
    },
  };
});

describe('Resident Visitors & Amenities Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders visitor management, active pre-approved guest codes, and approves arriving guest', async () => {
    render(<ResidentVisitorsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Visitors & Pre-Approved Passes/i)).toBeInTheDocument();
      expect(screen.getByText(/Kavita Kulkarni/i)).toBeInTheDocument();
      expect(screen.getByText(/PIN: 842619/i)).toBeInTheDocument();
      expect(screen.getByText(/Sunil Verma/i)).toBeInTheDocument();
    });

    // Approve the pending visitor
    const approveBtn = screen.getByRole('button', { name: /Approve/i });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(ApiClient.approveVisitor).toHaveBeenCalledWith('vis-1', 'APPROVED');
    });
  });

  it('renders amenities with demo fees, lists slots, and cancels an existing booking', async () => {
    render(<ResidentAmenitiesPage />);

    await waitFor(() => {
      expect(screen.getByText(/Society Amenities & Slot Booking/i)).toBeInTheDocument();
      expect(screen.getByText(/Non-Statutory Demo Fees & Rules/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Main Clubhouse Hall/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Tennis Court 1/i).length).toBeGreaterThanOrEqual(1);
    });

    // Cancel existing tennis court booking
    const cancelBtn = screen.getByRole('button', { name: /Cancel Booking/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(ApiClient.cancelAmenityBooking).toHaveBeenCalledWith('book-1');
      expect(screen.getByText(/Booking cancelled. The slot has been freed for other residents./i)).toBeInTheDocument();
    });
  });
});

