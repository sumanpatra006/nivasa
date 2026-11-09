import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import {
  CreateComplaintSchema,
  COMPLAINT_CATEGORY,
  COMPLAINT_URGENCY,
  COMPLAINT_STATUS,
  ComplaintCategory,
  ComplaintUrgency,
  USER_ROLES,
  checkSafetyEscalation,
} from '@nivasa/shared';

export const complaintsRouter = Router();

complaintsRouter.use(authMiddleware);

// In-memory complaints store
const mockComplaints: any[] = [
  {
    id: 'cmp-01',
    residentId: 'user-9820000002',
    flatId: 'flat-t12-0408',
    title: 'Water leakage in master bathroom',
    description: 'Continuous slow drip under the washbasin pipe damaging wooden cabinet.',
    category: COMPLAINT_CATEGORY.PLUMBING,
    urgency: COMPLAINT_URGENCY.NORMAL,
    status: COMPLAINT_STATUS.ASSIGNED,
    assignedTo: 'Plumbing Duty Team',
    createdAt: '2026-11-01T08:30:00Z',
    isSafetyEscalation: false,
    timeline: [
      { id: 'tl-1', message: 'Complaint registered by resident Swati Joshi', createdAt: '2026-11-01T08:30:00Z' },
      { id: 'tl-2', message: 'Assigned to Plumbing Duty Team by Ramesh Sawant', createdAt: '2026-11-01T09:15:00Z' },
    ],
  },
];

complaintsRouter.get('/', (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role === USER_ROLES.RESIDENT) {
    const userComplaints = mockComplaints.filter((c) => user.flatIds.includes(c.flatId));
    res.status(200).json({ complaints: userComplaints });
    return;
  }
  res.status(200).json({ complaints: mockComplaints });
});

complaintsRouter.post('/', (req: Request, res: Response) => {
  const parsed = CreateComplaintSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation Error', details: parsed.error.format() });
    return;
  }

  const { title, description, flatId } = parsed.data;

  // 1. Deterministic safety check
  const safetyCheck = checkSafetyEscalation(title, description);

  // 2. Default categorization
  let category: ComplaintCategory = COMPLAINT_CATEGORY.OTHER;
  const descLower = description.toLowerCase();
  if (descLower.includes('water') || descLower.includes('leak') || descLower.includes('pipe') || descLower.includes('tap')) {
    category = COMPLAINT_CATEGORY.PLUMBING;
  } else if (descLower.includes('power') || descLower.includes('light') || descLower.includes('switch') || descLower.includes('spark')) {
    category = COMPLAINT_CATEGORY.ELECTRICAL;
  } else if (descLower.includes('lift') || descLower.includes('elevator')) {
    category = COMPLAINT_CATEGORY.LIFT;
  } else if (descLower.includes('clean') || descLower.includes('garbage')) {
    category = COMPLAINT_CATEGORY.CLEANING;
  }

  // 3. Urgency rules (Safety override takes absolute precedence)
  const urgency: ComplaintUrgency = safetyCheck.isSafetyEscalation
    ? COMPLAINT_URGENCY.CRITICAL
    : COMPLAINT_URGENCY.NORMAL;

  const newComplaint = {
    id: `cmp-${Date.now()}`,
    residentId: req.user!.id,
    flatId,
    title,
    description,
    category,
    urgency,
    status: COMPLAINT_STATUS.NEW,
    isSafetyEscalation: safetyCheck.isSafetyEscalation,
    safetyReason: safetyCheck.reason,
    createdAt: new Date().toISOString(),
    timeline: [
      {
        id: `tl-${Date.now()}`,
        message: safetyCheck.isSafetyEscalation
          ? `AUTOMATED SAFETY ESCALATION TRIGGERED: ${safetyCheck.reason}`
          : 'Complaint registered by resident',
        createdAt: new Date().toISOString(),
      },
    ],
  };

  mockComplaints.unshift(newComplaint);

  res.status(201).json({ complaint: newComplaint });
});

complaintsRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const complaint = mockComplaints.find((c) => c.id === id);
  if (!complaint) {
    res.status(404).json({ error: 'Complaint not found' });
    return;
  }
  res.status(200).json({ complaint });
});

complaintsRouter.patch('/:id/category', (req: Request, res: Response) => {
  const { id } = req.params;
  const { category } = req.body;
  const complaint = mockComplaints.find((c) => c.id === id);
  if (!complaint) {
    res.status(404).json({ error: 'Complaint not found' });
    return;
  }

  complaint.category = category;
  complaint.timeline.push({
    id: `tl-${Date.now()}`,
    message: `Category reclassified to ${category} by staff`,
    createdAt: new Date().toISOString(),
  });

  res.status(200).json({ complaint });
});

complaintsRouter.patch('/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, comment } = req.body;
  const complaint = mockComplaints.find((c) => c.id === id);
  if (!complaint) {
    res.status(404).json({ error: 'Complaint not found' });
    return;
  }

  complaint.status = status;
  complaint.timeline.push({
    id: `tl-${Date.now()}`,
    message: `Status transitioned to ${status}${comment ? `: ${comment}` : ''}`,
    createdAt: new Date().toISOString(),
  });

  res.status(200).json({ complaint });
});
