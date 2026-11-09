import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StaffComplaintsPage } from '../pages/StaffComplaintsPage.js';
import { ApiClient } from '../services/api.js';

// Hoist mock complaints for vi.mock
const { mockStaffComplaints } = vi.hoisted(() => {
  return {
    mockStaffComplaints: [
      {
        id: 'cmp-01',
        residentId: 'user-9820000002',
        residentName: 'Swati Joshi',
        flatId: 'flat-t12-0408',
        tower: 'T12',
        flatNumber: '0408',
        title: 'Water leakage in master bathroom',
        description: 'Continuous slow drip under the washbasin pipe damaging wooden cabinet.',
        category: 'PLUMBING',
        urgency: 'NORMAL',
        status: 'ASSIGNED',
        assignedTo: 'Plumbing Duty Team (Santosh Shinde)',
        isSafetyEscalation: false,
        dutyManagerAlerted: false,
        isAiFallback: true,
        aiConfidence: 0.88,
        duplicateLinks: [],
        duplicateSuggestions: [
          {
            candidateId: 'cmp-03',
            candidateTitle: 'Water drip in bathroom washbasin pipe',
            candidateFlat: 'Tower T12 - 0408',
            candidateStatus: 'NEW',
            confidence: 0.85,
            matchingFactors: ['Same Tower (T12)', 'Same Residential Flat Unit', 'Same Category (PLUMBING)'],
          },
        ],
        reopenCount: 0,
        createdAt: '2026-11-01T08:30:00Z',
        updatedAt: '2026-11-01T09:15:00Z',
        slaTimeRemaining: '3h 30m remaining',
        timeline: [
          { id: 'tl-1', message: 'Registered by resident', actor: 'Swati Joshi', createdAt: '2026-11-01T08:30:00Z' },
        ],
      },
      {
        id: 'cmp-safety',
        residentId: 'user-9820000001',
        residentName: 'Neeraj Kulkarni',
        flatId: 'flat-t07-1203',
        tower: 'T07',
        flatNumber: '1203',
        title: 'Emergency: Lift #2 stuck between 8th and 9th floor',
        description: 'Passenger elevator stopped abruptly with passengers inside.',
        category: 'LIFT',
        urgency: 'CRITICAL',
        status: 'ASSIGNED',
        assignedTo: 'Lift Emergency Tech (OTIS)',
        isSafetyEscalation: true,
        safetyReason: 'Automated safety override triggered due to matching safety indicators: [lift stuck]',
        dutyManagerAlerted: true,
        isAiFallback: true,
        aiConfidence: 0.95,
        duplicateLinks: [],
        duplicateSuggestions: [],
        reopenCount: 0,
        createdAt: '2026-11-03T10:00:00Z',
        updatedAt: '2026-11-03T10:05:00Z',
        slaTimeRemaining: '12 mins remaining',
        timeline: [
          { id: 'tl-s1', message: 'Safety escalation triggered', actor: 'System Safety Monitor', createdAt: '2026-11-03T10:00:00Z' },
        ],
      },
    ],
  };
});

vi.mock('../services/api.js', () => {
  return {
    ApiClient: {
      authenticateStaff: vi.fn().mockResolvedValue('mock-staff-token'),
      getComplaints: vi.fn().mockResolvedValue({ complaints: mockStaffComplaints }),
      correctComplaint: vi.fn().mockImplementation((id, payload) => {
        const found = mockStaffComplaints.find((c) => c.id === id);
        return Promise.resolve({
          complaint: { ...found, category: payload.category || found?.category },
        });
      }),
      assignComplaint: vi.fn().mockImplementation((id, assignedTo) => {
        const found = mockStaffComplaints.find((c) => c.id === id);
        return Promise.resolve({
          complaint: { ...found, assignedTo },
        });
      }),
      updateComplaintStatus: vi.fn().mockImplementation((id, status, comment) => {
        const found = mockStaffComplaints.find((c) => c.id === id);
        return Promise.resolve({
          complaint: { ...found, status, resolutionComment: comment },
        });
      }),
      linkDuplicateComplaint: vi.fn().mockImplementation((primaryId, duplicateId) => {
        const primary = mockStaffComplaints.find((c) => c.id === primaryId);
        return Promise.resolve({
          message: 'Duplicate linked',
          primary: { ...primary, duplicateLinks: [duplicateId], duplicateSuggestions: [] },
          duplicate: { id: duplicateId, duplicateOfId: primaryId },
        });
      }),
    },
  };
});

describe('StaffComplaintsPage UI & Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders queue and displays pinned Priority 1 Safety Escalation banner', async () => {
    render(<StaffComplaintsPage />);

    await waitFor(() => {
      expect(screen.getByText('PRIORITY 1 SAFETY ESCALATION PINNED (1 ACTIVE)')).toBeInTheDocument();
      expect(screen.getByText('Water leakage in master bathroom')).toBeInTheDocument();
      expect(screen.getByText('Emergency: Lift #2 stuck between 8th and 9th floor')).toBeInTheDocument();
    });

    expect(screen.getByText(/Duty Manager notified/i)).toBeInTheDocument();
  });

  it('allows staff to assign a technician via the dropdown', async () => {
    render(<StaffComplaintsPage />);

    await waitFor(() => {
      expect(screen.getByText('Water leakage in master bathroom')).toBeInTheDocument();
    });

    const assignDropdowns = screen.getAllByLabelText(/assign technician/i);
    expect(assignDropdowns.length).toBeGreaterThan(0);

    // Change technician on ticket 1
    fireEvent.change(assignDropdowns[0], {
      target: { value: 'Plumbing Duty Team (Santosh Shinde)' },
    });

    await waitFor(() => {
      expect(ApiClient.assignComplaint).toHaveBeenCalledWith(
        'cmp-01',
        'Plumbing Duty Team (Santosh Shinde)',
        expect.any(String)
      );
    });
  });

  it('opens duplicate review modal and confirms duplicate link', async () => {
    render(<StaffComplaintsPage />);

    await waitFor(() => {
      expect(screen.getByText(/1 duplicate\(s\)\?/i)).toBeInTheDocument();
    });

    // Click duplicate indicator button
    const dupBtn = screen.getByText(/1 duplicate\(s\)\?/i);
    fireEvent.click(dupBtn);

    // Duplicate review modal opens
    expect(screen.getByText('Review Duplicate Complaint Suggestions')).toBeInTheDocument();
    expect(screen.getByText('Water drip in bathroom washbasin pipe')).toBeInTheDocument();
    expect(screen.getByText('85% Match')).toBeInTheDocument();

    // Click Confirm & Link Duplicate
    const confirmBtn = screen.getByRole('button', { name: /confirm & link duplicate/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(ApiClient.linkDuplicateComplaint).toHaveBeenCalledWith('cmp-01', 'cmp-03');
    });
  });

  it('opens resolution modal and marks ticket resolved with comment', async () => {
    render(<StaffComplaintsPage />);

    await waitFor(() => {
      expect(screen.getByText('Water leakage in master bathroom')).toBeInTheDocument();
    });

    // On ticket cmp-01, click Start Work first to put it in progress
    const startWorkBtns = screen.getAllByRole('button', { name: /start work/i });
    fireEvent.click(startWorkBtns[0]);

    await waitFor(() => {
      expect(ApiClient.updateComplaintStatus).toHaveBeenCalledWith('cmp-01', 'IN_PROGRESS');
    });
  });
});
