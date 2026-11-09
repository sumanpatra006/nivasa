import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResidentComplaintsPage } from '../pages/ResidentComplaintsPage.js';
import { DEMO_FLATS } from '../fixtures/uiData.js';
import { ApiClient } from '../services/api.js';

// Hoist mock complaints so vi.mock can reference them
const { mockComplaints } = vi.hoisted(() => {
  return {
    mockComplaints: [
      {
        id: 'cmp-01',
        residentId: 'user-9820000002',
        residentName: 'Swati Joshi',
        residentPhone: '9820000002',
        flatId: 'flat-t12-0408',
        tower: 'T12',
        flatNumber: '0408',
        title: 'Water leakage in master bathroom',
        description: 'Continuous slow drip under the washbasin pipe damaging wooden cabinet.',
        category: 'PLUMBING',
        urgency: 'NORMAL',
        status: 'ASSIGNED',
        assignedTo: 'Plumbing Duty Team (Santosh Shinde)',
        photoUrl: null,
        rating: null,
        isSafetyEscalation: false,
        dutyManagerAlerted: false,
        isAiFallback: true,
        duplicateLinks: [],
        duplicateSuggestions: [],
        reopenCount: 0,
        createdAt: '2026-11-01T08:30:00Z',
        updatedAt: '2026-11-01T09:15:00Z',
        slaTimeRemaining: '3h 45m remaining',
        timeline: [
          {
            id: 'tl-1',
            message: 'Complaint registered by resident Swati Joshi',
            actor: 'Swati Joshi',
            createdAt: '2026-11-01T08:30:00Z',
          },
        ],
      },
      {
        id: 'cmp-02',
        residentId: 'user-9820000002',
        residentName: 'Swati Joshi',
        residentPhone: '9820000002',
        flatId: 'flat-t12-0408',
        tower: 'T12',
        flatNumber: '0408',
        title: 'Kitchen exhaust fan jammed',
        description: 'Grease buildup caused the exhaust motor to lock up.',
        category: 'ELECTRICAL',
        urgency: 'NORMAL',
        status: 'RESOLVED',
        assignedTo: 'Electrical Duty Team',
        photoUrl: null,
        rating: null,
        isSafetyEscalation: false,
        dutyManagerAlerted: false,
        isAiFallback: true,
        duplicateLinks: [],
        duplicateSuggestions: [],
        reopenCount: 0,
        createdAt: '2026-10-25T10:00:00Z',
        updatedAt: '2026-10-25T14:00:00Z',
        resolvedAt: '2026-10-25T14:00:00Z',
        resolutionComment: 'Motor bearings cleaned and lubricated',
        slaTimeRemaining: 'Resolved on time',
        timeline: [
          {
            id: 'tl-2',
            message: 'Complaint resolved by Electrical Team',
            actor: 'Mahesh Jadhav',
            createdAt: '2026-10-25T14:00:00Z',
          },
        ],
      },
    ],
  };
});

// Mock react-router-dom outlet context to provide currentFlat
vi.mock('react-router-dom', async () => {
  const actual: any = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({ currentFlat: DEMO_FLATS[1] }), // Flat T12-0408 (Swati Joshi)
  };
});

vi.mock('../services/api.js', () => {
  return {
    ApiClient: {
      authenticateResident: vi.fn().mockResolvedValue('mock-token'),
      getComplaints: vi.fn().mockResolvedValue({ complaints: mockComplaints }),
      createComplaint: vi.fn().mockImplementation((payload) => {
        return Promise.resolve({
          complaint: {
            id: 'cmp-new-999',
            residentId: 'user-9820000002',
            residentName: 'Swati Joshi',
            flatId: payload.flatId,
            tower: 'T12',
            flatNumber: '0408',
            title: payload.title,
            description: payload.description,
            category: payload.category || 'PLUMBING',
            urgency: 'NORMAL',
            status: 'NEW',
            assignedTo: 'Plumbing Duty Team',
            photoUrl: payload.photoUrl || null,
            rating: null,
            isSafetyEscalation: false,
            dutyManagerAlerted: false,
            isAiFallback: true,
            duplicateLinks: [],
            duplicateSuggestions: [],
            reopenCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            slaTimeRemaining: '4h 0m remaining',
            timeline: [
              {
                id: 'tl-new',
                message: 'Complaint registered by resident Swati Joshi',
                actor: 'Swati Joshi',
                createdAt: new Date().toISOString(),
              },
            ],
          },
        });
      }),
      rateComplaint: vi.fn().mockResolvedValue({
        complaint: {
          ...mockComplaints[1],
          rating: {
            stars: 5,
            feedback: 'Quick and clean job by technician!',
            ratedAt: new Date().toISOString(),
          },
        },
      }),
      updateComplaintStatus: vi.fn().mockResolvedValue({
        complaint: {
          ...mockComplaints[1],
          status: 'REOPENED',
          reopenCount: 1,
        },
      }),
    },
  };
});

describe('ResidentComplaintsPage UI & Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders complaints from API with status badges, category, and SLA timer', async () => {
    render(<ResidentComplaintsPage />);

    await waitFor(() => {
      expect(screen.getByText('Water leakage in master bathroom')).toBeInTheDocument();
      expect(screen.getByText('Kitchen exhaust fan jammed')).toBeInTheDocument();
    });

    expect(screen.getByText('PLUMBING')).toBeInTheDocument();
    expect(screen.getByText('ASSIGNED')).toBeInTheDocument();
    expect(screen.getByText('3h 45m remaining')).toBeInTheDocument();
  });

  it('opens new complaint modal and shows real-time safety alert when emergency keywords are entered', async () => {
    render(<ResidentComplaintsPage />);

    await waitFor(() => {
      expect(screen.getByText('Water leakage in master bathroom')).toBeInTheDocument();
    });

    // Click Raise New Complaint
    const newBtn = screen.getByRole('button', { name: /raise new complaint/i });
    fireEvent.click(newBtn);

    expect(screen.getByText('Raise Maintenance Complaint')).toBeInTheDocument();

    const titleInput = screen.getByLabelText(/issue title/i);
    const descInput = screen.getByLabelText(/detailed description/i);

    // Type gas leak emergency
    fireEvent.change(titleInput, { target: { value: 'Gas leak emergency' } });
    fireEvent.change(descInput, { target: { value: 'Strong cooking gas leak smell near kitchen duct' } });

    // Live safety emergency banner must appear
    expect(screen.getByText('SAFETY EMERGENCY DETECTED')).toBeInTheDocument();
    expect(screen.getByText(/Emergency indicators detected: \[gas leak\]/i)).toBeInTheDocument();
  });

  it('submits new complaint to backend and prepends to the list', async () => {
    render(<ResidentComplaintsPage />);

    await waitFor(() => {
      expect(screen.getByText('Water leakage in master bathroom')).toBeInTheDocument();
    });

    const newBtn = screen.getByRole('button', { name: /raise new complaint/i });
    fireEvent.click(newBtn);

    const titleInput = screen.getByLabelText(/issue title/i);
    const descInput = screen.getByLabelText(/detailed description/i);

    fireEvent.change(titleInput, { target: { value: 'Main door handle loose' } });
    fireEvent.change(descInput, { target: { value: 'Screws are coming off the front door handle.' } });

    const submitBtn = screen.getByRole('button', { name: /submit complaint/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(ApiClient.createComplaint).toHaveBeenCalledWith(
        expect.objectContaining({
          flatId: 'flat-t12-0408',
          title: 'Main door handle loose',
          description: 'Screws are coming off the front door handle.',
        })
      );
      expect(screen.getByText('Main door handle loose')).toBeInTheDocument();
    });
  });

  it('allows resident to open resolved ticket and submit 5-star rating with feedback', async () => {
    render(<ResidentComplaintsPage />);

    await waitFor(() => {
      expect(screen.getByText('Kitchen exhaust fan jammed')).toBeInTheDocument();
    });

    // Click the resolved ticket
    const resolvedCard = screen.getByText('Kitchen exhaust fan jammed');
    fireEvent.click(resolvedCard);

    // Modal opens showing resolution feedback section
    await waitFor(() => {
      expect(screen.getByText('Resident Resolution Feedback')).toBeInTheDocument();
      expect(screen.getByText(/Motor bearings cleaned and lubricated/i)).toBeInTheDocument();
    });

    // Enter feedback and submit rating
    const feedbackInput = screen.getByPlaceholderText(/add brief feedback/i);
    fireEvent.change(feedbackInput, { target: { value: 'Quick and clean job by technician!' } });

    const rateBtn = screen.getByRole('button', { name: /submit 5-star rating/i });
    fireEvent.click(rateBtn);

    await waitFor(() => {
      expect(ApiClient.rateComplaint).toHaveBeenCalledWith(
        'cmp-02',
        5,
        'Quick and clean job by technician!'
      );
      expect(screen.getByText('Rated 5 / 5 Stars')).toBeInTheDocument();
    });
  });
});
