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

export interface ComplaintRecord {
  id: string;
  residentId: string;
  flatId: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  urgency: ComplaintUrgency;
  status: string;
  assignedTo?: string | null;
  createdAt: string;
  isSafetyEscalation: boolean;
  safetyReason?: string | null;
  duplicateOfId?: string | null;
  duplicateLinks: string[];
  reopenCount: number;
  timeline: Array<{
    id: string;
    message: string;
    actor?: string;
    createdAt: string;
  }>;
}

// In-memory complaints store initialized with authoritative seed
const mockComplaints: ComplaintRecord[] = [
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
    duplicateOfId: null,
    duplicateLinks: [],
    reopenCount: 0,
    timeline: [
      { id: 'tl-1', message: 'Complaint registered by resident Swati Joshi', actor: 'Swati Joshi', createdAt: '2026-11-01T08:30:00Z' },
      { id: 'tl-2', message: 'Assigned to Plumbing Duty Team by Ramesh Sawant', actor: 'Ramesh Sawant', createdAt: '2026-11-01T09:15:00Z' },
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

  // 1. Deterministic safety check (Safety takes absolute precedence over any AI output)
  const safetyCheck = checkSafetyEscalation(title, description);

  // 2. Default categorization / deterministic classification fallback
  let category: ComplaintCategory = COMPLAINT_CATEGORY.OTHER;
  const descLower = `${title} ${description}`.toLowerCase();
  if (descLower.includes('water') || descLower.includes('leak') || descLower.includes('pipe') || descLower.includes('tap') || descLower.includes('drain')) {
    category = COMPLAINT_CATEGORY.PLUMBING;
  } else if (descLower.includes('power') || descLower.includes('light') || descLower.includes('switch') || descLower.includes('spark') || descLower.includes('electric')) {
    category = COMPLAINT_CATEGORY.ELECTRICAL;
  } else if (descLower.includes('lift') || descLower.includes('elevator')) {
    category = COMPLAINT_CATEGORY.LIFT;
  } else if (descLower.includes('clean') || descLower.includes('garbage') || descLower.includes('dust')) {
    category = COMPLAINT_CATEGORY.CLEANING;
  } else if (descLower.includes('guard') || descLower.includes('gate') || descLower.includes('security')) {
    category = COMPLAINT_CATEGORY.SECURITY;
  }

  // 3. Urgency rules (Safety override forces CRITICAL)
  const urgency: ComplaintUrgency = safetyCheck.isSafetyEscalation
    ? COMPLAINT_URGENCY.CRITICAL
    : COMPLAINT_URGENCY.NORMAL;

  const newComplaint: ComplaintRecord = {
    id: `cmp-${Date.now()}`,
    residentId: req.user!.id,
    flatId,
    title,
    description,
    category,
    urgency,
    status: COMPLAINT_STATUS.NEW,
    assignedTo: null,
    isSafetyEscalation: safetyCheck.isSafetyEscalation,
    safetyReason: safetyCheck.reason || null,
    duplicateOfId: null,
    duplicateLinks: [],
    reopenCount: 0,
    createdAt: new Date().toISOString(),
    timeline: [
      {
        id: `tl-${Date.now()}-reg`,
        message: 'Complaint registered by resident',
        actor: req.user!.name || req.user!.phone,
        createdAt: new Date().toISOString(),
      },
    ],
  };

  // If safety escalation triggered, append dedicated automated timeline entry
  if (safetyCheck.isSafetyEscalation) {
    newComplaint.timeline.push({
      id: `tl-${Date.now()}-safety`,
      message: `AUTOMATED SAFETY ESCALATION TRIGGERED: ${safetyCheck.reason}`,
      actor: 'System Safety Monitor',
      createdAt: new Date().toISOString(),
    });
  }

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
    actor: req.user!.name || req.user!.phone,
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

  // Validate allowed status transitions
  const validStatuses = Object.values(COMPLAINT_STATUS);
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid complaint status' });
    return;
  }

  if (status === COMPLAINT_STATUS.REOPENED) {
    complaint.reopenCount += 1;
  }

  complaint.status = status;
  complaint.timeline.push({
    id: `tl-${Date.now()}`,
    message: `Status transitioned to ${status}${comment ? `: ${comment}` : ''}`,
    actor: req.user!.name || req.user!.phone,
    createdAt: new Date().toISOString(),
  });

  res.status(200).json({ complaint });
});

// Link duplicate complaint (never silently deletes; preserves links)
complaintsRouter.post('/:id/link-duplicate', (req: Request, res: Response) => {
  const { id } = req.params;
  const { duplicateId } = req.body;

  const primary = mockComplaints.find((c) => c.id === id);
  const duplicate = mockComplaints.find((c) => c.id === duplicateId);

  if (!primary || !duplicate) {
    res.status(404).json({ error: 'One or both complaints not found' });
    return;
  }

  duplicate.duplicateOfId = primary.id;
  if (!primary.duplicateLinks.includes(duplicate.id)) {
    primary.duplicateLinks.push(duplicate.id);
  }

  primary.timeline.push({
    id: `tl-${Date.now()}-dup-pri`,
    message: `Linked duplicate complaint ${duplicate.id} ("${duplicate.title}")`,
    actor: req.user!.name || req.user!.phone,
    createdAt: new Date().toISOString(),
  });

  duplicate.timeline.push({
    id: `tl-${Date.now()}-dup-sec`,
    message: `Marked as linked duplicate of primary complaint ${primary.id}`,
    actor: req.user!.name || req.user!.phone,
    createdAt: new Date().toISOString(),
  });

  res.status(200).json({
    message: 'Duplicate complaint linked successfully',
    primary,
    duplicate,
  });
});
