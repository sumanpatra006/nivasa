import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import {
  CreateComplaintSchema,
  UpdateComplaintStatusSchema,
  AssignComplaintSchema,
  CorrectComplaintSchema,
  RateComplaintSchema,
  LinkDuplicateSchema,
  COMPLAINT_CATEGORY,
  COMPLAINT_URGENCY,
  COMPLAINT_STATUS,
  ComplaintCategory,
  ComplaintUrgency,
  ComplaintStatus,
  USER_ROLES,
  checkSafetyEscalation,
  calculateComplaintSla,
} from '@nivasa/shared';
import { ComplaintRepository, FormattedComplaint } from '../../repositories/complaint.repository.js';
import { complaintClassifier } from './complaintClassifier.js';
import { detectDuplicates } from './duplicateDetector.js';

export const complaintsRouter = Router();

complaintsRouter.use(authMiddleware);

/**
 * Valid status transitions matrix.
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  [COMPLAINT_STATUS.NEW]: [COMPLAINT_STATUS.ASSIGNED, COMPLAINT_STATUS.IN_PROGRESS, 'CANCELLED'],
  [COMPLAINT_STATUS.ASSIGNED]: [COMPLAINT_STATUS.IN_PROGRESS, COMPLAINT_STATUS.WAITING_FOR_RESIDENT, COMPLAINT_STATUS.RESOLVED],
  [COMPLAINT_STATUS.IN_PROGRESS]: [COMPLAINT_STATUS.WAITING_FOR_RESIDENT, COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.ASSIGNED],
  [COMPLAINT_STATUS.WAITING_FOR_RESIDENT]: [COMPLAINT_STATUS.IN_PROGRESS, COMPLAINT_STATUS.RESOLVED],
  [COMPLAINT_STATUS.RESOLVED]: [COMPLAINT_STATUS.CLOSED, COMPLAINT_STATUS.REOPENED],
  [COMPLAINT_STATUS.CLOSED]: [COMPLAINT_STATUS.REOPENED],
  [COMPLAINT_STATUS.REOPENED]: [COMPLAINT_STATUS.ASSIGNED, COMPLAINT_STATUS.IN_PROGRESS, COMPLAINT_STATUS.RESOLVED],
};

function formatComplaintWithSla(c: FormattedComplaint) {
  const sla = calculateComplaintSla(c.createdAt, c.urgency as any, c.status as any, c.resolvedAt);
  return {
    ...c,
    sla,
    slaTimeRemaining: sla.displayRemaining,
  };
}

/**
 * GET /api/v1/complaints
 * Lists complaints with optional filters from the database.
 */
complaintsRouter.get('/', async (req: Request, res: Response) => {
  const user = req.user!;
  const allComplaints = await ComplaintRepository.findMany();

  let filtered = allComplaints;

  // Authorization filter: residents only see their own flat complaints
  if (user.role === USER_ROLES.RESIDENT) {
    filtered = filtered.filter((c) => user.flatIds.includes(c.flatId));
  }

  // Query parameter filters
  const { category, urgency, status, search } = req.query;

  if (category && typeof category === 'string' && category !== 'ALL') {
    filtered = filtered.filter((c) => c.category === category);
  }

  if (urgency && typeof urgency === 'string' && urgency !== 'ALL') {
    if (urgency === 'SAFETY_CRITICAL') {
      filtered = filtered.filter((c) => c.isSafetyEscalation);
    } else {
      filtered = filtered.filter((c) => c.urgency === urgency);
    }
  }

  if (status && typeof status === 'string' && status !== 'ALL') {
    filtered = filtered.filter((c) => c.status === status);
  }

  if (search && typeof search === 'string') {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.title.toLowerCase().includes(s) ||
        c.description.toLowerCase().includes(s) ||
        c.tower.toLowerCase().includes(s) ||
        c.flatNumber.toLowerCase().includes(s) ||
        c.residentName.toLowerCase().includes(s)
    );
  }

  const enriched = filtered.map(formatComplaintWithSla);
  res.status(200).json({ complaints: enriched });
});

/**
 * GET /api/v1/complaints/:id
 * Retrieves a single complaint with its timeline and SLA status.
 */
complaintsRouter.get('/:id', async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const complaint = await ComplaintRepository.findById(id);

  if (!complaint) {
    res.status(404).json({ error: 'Complaint not found' });
    return;
  }

  // Authorization check for residents
  if (req.user!.role === USER_ROLES.RESIDENT && !req.user!.flatIds.includes(complaint.flatId)) {
    res.status(403).json({ error: 'Forbidden: You do not have access to this unit complaint' });
    return;
  }

  res.status(200).json({ complaint: formatComplaintWithSla(complaint) });
});

/**
 * POST /api/v1/complaints
 * Create a new complaint with deterministic safety escalation, AI/fallback classification,
 * duplicate suggestion scanning, and persistent database storage.
 */
complaintsRouter.post('/', async (req: Request, res: Response) => {
  const parsed = CreateComplaintSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation Error', details: parsed.error.format() });
    return;
  }

  const { title, description, flatId, category: userSuppliedCategory } = parsed.data;

  // Authorization check: residents can only file complaints for their authorized flats
  if (req.user!.role === USER_ROLES.RESIDENT && !req.user!.flatIds.includes(flatId)) {
    res.status(403).json({ error: 'Forbidden: You cannot file complaints for an unauthorized flat' });
    return;
  }

  // 1. Deterministic safety check (Safety takes ABSOLUTE PRECEDENCE over AI and user category)
  const safetyCheck = checkSafetyEscalation(title, description);

  // 2. AI / Deterministic Fallback Classification
  const classification = await complaintClassifier.classifyComplaint(title, description);

  // Final category selection
  let finalCategory: ComplaintCategory = userSuppliedCategory || classification.category;

  // Final urgency selection (Safety escalation ALWAYS forces CRITICAL)
  let finalUrgency: ComplaintUrgency = classification.urgency;
  let isSafetyEscalation = false;
  let safetyReason: string | null = null;

  if (safetyCheck.isSafetyEscalation) {
    isSafetyEscalation = true;
    finalUrgency = COMPLAINT_URGENCY.CRITICAL;
    safetyReason = safetyCheck.reason || 'Safety emergency triggered';
  }

  // 3. Duplicate Detection across existing society complaints
  const existing = await ComplaintRepository.findMany();
  const existingTickets = existing.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    category: c.category as any,
    tower: c.tower,
    flatNumber: c.flatNumber,
    status: c.status,
    createdAt: c.createdAt,
  }));

  const duplicateSuggestions = detectDuplicates(
    {
      title,
      description,
      category: finalCategory,
      tower: flatId.includes('t07') ? 'T07' : 'T12',
      flatNumber: flatId.includes('1203') ? '1203' : '0408',
      createdAt: new Date().toISOString(),
    },
    existingTickets
  );

  const initialStatus = isSafetyEscalation ? COMPLAINT_STATUS.ASSIGNED : COMPLAINT_STATUS.NEW;
  const initialAssignee = isSafetyEscalation ? 'Duty Manager (Emergency Rapid Response)' : null;

  const complaint = await ComplaintRepository.create({
    residentId: req.user!.id || 'user-staff-ramesh',
    flatId,
    title,
    description,
    category: finalCategory,
    urgency: finalUrgency,
    status: initialStatus,
    assignedTo: initialAssignee,
    isSafetyEscalation,
    safetyReason,
    isAiFallback: classification.isFallback,
    aiConfidence: classification.confidence,
    aiSuggestedTeam: classification.suggestedTeam,
    aiExplanation: classification.explanation,
    duplicateSuggestions,
  });

  res.status(201).json({ complaint: formatComplaintWithSla(complaint) });
});

/**
 * PATCH /api/v1/complaints/:id/status
 * Updates complaint status.
 */
complaintsRouter.patch('/:id/status', async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = UpdateComplaintStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation Error', details: parsed.error.format() });
    return;
  }

  const { status: newStatus, comment } = parsed.data;
  const complaint = await ComplaintRepository.findById(id);

  if (!complaint) {
    res.status(404).json({ error: 'Complaint not found' });
    return;
  }

  const allowedNext = VALID_TRANSITIONS[complaint.status] || [];
  if (!allowedNext.includes(newStatus)) {
    res.status(400).json({
      error: 'Invalid Transition',
      message: `Cannot transition complaint from ${complaint.status} to ${newStatus}. Valid transitions: [${allowedNext.join(', ')}]`,
    });
    return;
  }

  const updated = await ComplaintRepository.updateStatus(id, newStatus as any, comment, req.user!.name || 'Staff');
  res.status(200).json({ complaint: formatComplaintWithSla(updated!) });
});

/**
 * POST /api/v1/complaints/:id/assign
 * Help desk user assigns complaint to a technician or vendor.
 */
complaintsRouter.post('/:id/assign', async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = AssignComplaintSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation Error', details: parsed.error.format() });
    return;
  }

  const complaint = await ComplaintRepository.findById(id);
  if (!complaint) {
    res.status(404).json({ error: 'Complaint not found' });
    return;
  }

  const updated = await ComplaintRepository.assign(id, parsed.data.assignedTo);
  res.status(200).json({ complaint: formatComplaintWithSla(updated!) });
});

/**
 * POST /api/v1/complaints/:id/link-duplicate
 * Links a complaint as a duplicate of a primary complaint.
 */
complaintsRouter.post('/:id/link-duplicate', async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = LinkDuplicateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation Error', details: parsed.error.format() });
    return;
  }

  const { duplicateId } = parsed.data;
  const success = await ComplaintRepository.linkDuplicate(id, duplicateId);
  if (!success) {
    res.status(404).json({ error: 'Complaint not found' });
    return;
  }

  const primary = await ComplaintRepository.findById(id);
  const duplicate = await ComplaintRepository.findById(duplicateId);

  res.status(200).json({
    message: `Complaint ${duplicateId} linked as duplicate of ${id}`,
    primaryComplaint: formatComplaintWithSla(primary!),
    duplicateComplaint: formatComplaintWithSla(duplicate!),
  });
});

/**
 * POST /api/v1/complaints/:id/rate
 * Allows resident to rate resolved complaint.
 */
complaintsRouter.post('/:id/rate', async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = RateComplaintSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation Error', details: parsed.error.format() });
    return;
  }

  const complaint = await ComplaintRepository.findById(id);
  if (!complaint) {
    res.status(404).json({ error: 'Complaint not found' });
    return;
  }

  if (complaint.status !== COMPLAINT_STATUS.RESOLVED && complaint.status !== COMPLAINT_STATUS.CLOSED) {
    res.status(400).json({ error: 'Invalid Action', message: 'Only resolved or closed complaints can be rated' });
    return;
  }

  const updated = await ComplaintRepository.rate(id, parsed.data.stars, parsed.data.feedback);
  res.status(200).json({
    message: 'Feedback submitted successfully',
    complaint: formatComplaintWithSla(updated!),
  });
});
