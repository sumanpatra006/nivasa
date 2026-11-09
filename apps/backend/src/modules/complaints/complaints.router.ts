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
import { societyStore, ComplaintRecord } from '../billing/societyStore.js';
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

function formatComplaintWithSla(c: ComplaintRecord) {
  const sla = calculateComplaintSla(c.createdAt, c.urgency, c.status, c.resolvedAt);
  return {
    ...c,
    sla,
    slaTimeRemaining: sla.displayRemaining,
  };
}

/**
 * GET /api/v1/complaints
 * Lists complaints with optional filters (category, urgency, status, search).
 * Enforces server-side authorization: residents can only access their authorized flats.
 */
complaintsRouter.get('/', (req: Request, res: Response) => {
  const user = req.user!;
  const allComplaints = societyStore.getComplaints();

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
complaintsRouter.get('/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const complaint = societyStore.getComplaintById(id);

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
 * duplicate suggestion scanning, and persistent disk store.
 */
complaintsRouter.post('/', async (req: Request, res: Response) => {
  const parsed = CreateComplaintSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation Error', details: parsed.error.format() });
    return;
  }

  const { title, description, flatId, category: userSuppliedCategory, photoUrl } = parsed.data;

  // Authorization check: residents can only file complaints for their authorized flats
  if (req.user!.role === USER_ROLES.RESIDENT && !req.user!.flatIds.includes(flatId)) {
    res.status(403).json({ error: 'Forbidden: You cannot file complaints for an unauthorized flat' });
    return;
  }

  // Flat metadata extraction
  const invoices = societyStore.getInvoices();
  const matchedInvoice = invoices.find((inv) => inv.flatId === flatId);
  const tower = matchedInvoice?.tower || (flatId.includes('t07') ? 'T07' : flatId.includes('t12') ? 'T12' : 'T21');
  const flatNumber = matchedInvoice?.flatNumber || (flatId.includes('1203') ? '1203' : flatId.includes('0408') ? '0408' : '1601');
  const residentName = req.user!.name || matchedInvoice?.residentName || 'Resident';

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
  let dutyManagerAlerted = false;

  if (safetyCheck.isSafetyEscalation) {
    isSafetyEscalation = true;
    finalUrgency = COMPLAINT_URGENCY.CRITICAL;
    safetyReason = safetyCheck.reason || 'Safety emergency triggered';
    dutyManagerAlerted = true;
  }

  // 3. Duplicate Detection across existing society complaints
  const existingTickets = societyStore.getComplaints().map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    category: c.category,
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
      tower,
      flatNumber,
      createdAt: new Date().toISOString(),
    },
    existingTickets
  );

  const complaintId = `cmp-${Date.now()}`;
  const nowIso = new Date().toISOString();

  // Initial timeline events
  const timeline: Array<{ id: string; message: string; actor?: string; createdAt: string }> = [
    {
      id: `tl-${Date.now()}-reg`,
      message: `Complaint registered by resident ${residentName}`,
      actor: residentName,
      createdAt: nowIso,
    },
  ];

  if (isSafetyEscalation) {
    timeline.push({
      id: `tl-${Date.now()}-safety`,
      message: `AUTOMATED SAFETY ESCALATION TRIGGERED: ${safetyReason}. Duty Manager alerted for immediate dispatch.`,
      actor: 'System Safety Monitor',
      createdAt: new Date().toISOString(),
    });
  }

  const newComplaint: ComplaintRecord = {
    id: complaintId,
    residentId: req.user!.id,
    residentName,
    residentPhone: req.user!.phone,
    flatId,
    tower,
    flatNumber,
    title,
    description,
    category: finalCategory,
    originalCategory: finalCategory,
    urgency: finalUrgency,
    originalUrgency: finalUrgency,
    status: COMPLAINT_STATUS.NEW,
    assignedTo: classification.suggestedTeam || null,
    photoUrl: photoUrl || null,
    rating: null,
    isSafetyEscalation,
    safetyReason,
    dutyManagerAlerted,
    isAiFallback: classification.isFallback,
    aiConfidence: classification.confidence,
    aiSuggestedTeam: classification.suggestedTeam,
    aiExplanation: classification.explanation,
    duplicateOfId: null,
    duplicateLinks: [],
    duplicateSuggestions,
    reopenCount: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
    timeline,
  };

  societyStore.addComplaint(newComplaint);

  res.status(201).json({ complaint: formatComplaintWithSla(newComplaint) });
});

/**
 * PATCH /api/v1/complaints/:id/status
 * Updates ticket status, validates transition rules, records resolution comments,
 * and increments reopen counter when reopened.
 */
complaintsRouter.patch('/:id/status', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = UpdateComplaintStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation Error', details: parsed.error.format() });
    return;
  }

  const { status, comment } = parsed.data;
  const complaint = societyStore.getComplaintById(id);
  if (!complaint) {
    res.status(404).json({ error: 'Complaint not found' });
    return;
  }

  // Safety rule: Safety complaints cannot be automatically closed without explicit resolution
  if (complaint.isSafetyEscalation && status === COMPLAINT_STATUS.CLOSED && complaint.status !== COMPLAINT_STATUS.RESOLVED) {
    res.status(400).json({ error: 'Safety critical complaints cannot be closed without being marked RESOLVED first' });
    return;
  }

  // Validate allowed status transitions
  const allowed = VALID_TRANSITIONS[complaint.status] || [];
  if (!allowed.includes(status) && complaint.status !== status) {
    res.status(400).json({
      error: `Invalid status transition from ${complaint.status} to ${status}. Allowed next states: ${allowed.join(', ')}`,
    });
    return;
  }

  const actor = req.user!.name || req.user!.phone;
  const nowIso = new Date().toISOString();
  const timelineEntry = {
    id: `tl-${Date.now()}`,
    message: '',
    actor,
    createdAt: nowIso,
  };

  const updates: Partial<ComplaintRecord> = { status };

  if (status === COMPLAINT_STATUS.REOPENED) {
    updates.reopenCount = (complaint.reopenCount || 0) + 1;
    timelineEntry.message = `Complaint reopened by ${actor}. Reason: ${comment || 'No reason provided'}`;
  } else if (status === COMPLAINT_STATUS.RESOLVED) {
    updates.resolvedAt = nowIso;
    updates.resolutionComment = comment || 'Issue resolved by maintenance technician';
    timelineEntry.message = `Complaint resolved by ${actor}. Resolution: ${updates.resolutionComment}`;
  } else {
    timelineEntry.message = `Status updated to ${status}${comment ? `: ${comment}` : ''}`;
  }

  updates.timeline = [...complaint.timeline, timelineEntry];

  const updated = societyStore.updateComplaint(id, updates);
  res.status(200).json({ complaint: formatComplaintWithSla(updated) });
});

/**
 * PATCH /api/v1/complaints/:id/assignment
 * Assign technician or team to complaint.
 */
complaintsRouter.patch('/:id/assignment', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = AssignComplaintSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation Error', details: parsed.error.format() });
    return;
  }

  const { assignedTo, reason } = parsed.data;
  const complaint = societyStore.getComplaintById(id);
  if (!complaint) {
    res.status(404).json({ error: 'Complaint not found' });
    return;
  }

  const actor = req.user!.name || req.user!.phone;
  const nowIso = new Date().toISOString();

  const updates: Partial<ComplaintRecord> = {
    assignedTo,
    status: complaint.status === COMPLAINT_STATUS.NEW ? COMPLAINT_STATUS.ASSIGNED : complaint.status,
    timeline: [
      ...complaint.timeline,
      {
        id: `tl-${Date.now()}`,
        message: `Assigned to ${assignedTo} by ${actor}${reason ? ` (${reason})` : ''}`,
        actor,
        createdAt: nowIso,
      },
    ],
  };

  const updated = societyStore.updateComplaint(id, updates);
  res.status(200).json({ complaint: formatComplaintWithSla(updated) });
});

/**
 * PATCH /api/v1/complaints/:id/correction
 * Manual correction of category and urgency by Help Desk staff.
 * Preserves original AI suggestion for audit integrity.
 */
complaintsRouter.patch('/:id/correction', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = CorrectComplaintSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation Error', details: parsed.error.format() });
    return;
  }

  const { category, urgency, reason } = parsed.data;
  const complaint = societyStore.getComplaintById(id);
  if (!complaint) {
    res.status(404).json({ error: 'Complaint not found' });
    return;
  }

  // Safety rule: Staff cannot downgrade a critical safety escalation without verified supervisor clearance
  if (complaint.isSafetyEscalation && urgency && urgency !== COMPLAINT_URGENCY.CRITICAL) {
    res.status(400).json({
      error: 'Safety escalation complaints cannot be downgraded below CRITICAL urgency.',
    });
    return;
  }

  const actor = req.user!.name || req.user!.phone;
  const nowIso = new Date().toISOString();
  const changes: string[] = [];

  const updates: Partial<ComplaintRecord> = {};
  if (category && category !== complaint.category) {
    updates.category = category;
    changes.push(`Category changed from ${complaint.category} to ${category}`);
  }
  if (urgency && urgency !== complaint.urgency) {
    updates.urgency = urgency;
    changes.push(`Urgency changed from ${complaint.urgency} to ${urgency}`);
  }

  if (changes.length === 0) {
    res.status(200).json({ complaint: formatComplaintWithSla(complaint) });
    return;
  }

  updates.timeline = [
    ...complaint.timeline,
    {
      id: `tl-${Date.now()}`,
      message: `Help-desk correction by ${actor}: ${changes.join(', ')}${reason ? ` (Reason: ${reason})` : ''}`,
      actor,
      createdAt: nowIso,
    },
  ];

  const updated = societyStore.updateComplaint(id, updates);
  res.status(200).json({ complaint: formatComplaintWithSla(updated) });
});

/**
 * POST /api/v1/complaints/:id/rate
 * Resident rating (1-5 stars) and feedback for resolved complaint.
 */
complaintsRouter.post('/:id/rate', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = RateComplaintSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation Error', details: parsed.error.format() });
    return;
  }

  const complaint = societyStore.getComplaintById(id);
  if (!complaint) {
    res.status(404).json({ error: 'Complaint not found' });
    return;
  }

  // Resident authorization
  if (req.user!.role === USER_ROLES.RESIDENT && !req.user!.flatIds.includes(complaint.flatId)) {
    res.status(403).json({ error: 'Forbidden: You can only rate complaints for your flat' });
    return;
  }

  // Must be resolved or closed
  if (![COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED].includes(complaint.status as any)) {
    res.status(400).json({ error: 'Only resolved complaints can be rated' });
    return;
  }

  const { stars, feedback } = parsed.data;
  const actor = req.user!.name || req.user!.phone;
  const nowIso = new Date().toISOString();

  const updates: Partial<ComplaintRecord> = {
    rating: {
      stars,
      feedback: feedback || '',
      ratedAt: nowIso,
    },
    timeline: [
      ...complaint.timeline,
      {
        id: `tl-${Date.now()}`,
        message: `Resident submitted feedback rating: ${stars}/5 stars${feedback ? ` - "${feedback}"` : ''}`,
        actor,
        createdAt: nowIso,
      },
    ],
  };

  const updated = societyStore.updateComplaint(id, updates);
  res.status(200).json({ complaint: formatComplaintWithSla(updated) });
});

/**
 * POST /api/v1/complaints/:id/link-duplicate
 * Help-desk confirmation of duplicate complaint.
 * NEVER deletes either ticket; links them bidirectionally and updates audit trails.
 */
complaintsRouter.post('/:id/link-duplicate', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = LinkDuplicateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation Error', details: parsed.error.format() });
    return;
  }

  const { duplicateId } = parsed.data;
  const primary = societyStore.getComplaintById(id);
  const duplicate = societyStore.getComplaintById(duplicateId);

  if (!primary || !duplicate) {
    res.status(404).json({ error: 'One or both complaints not found' });
    return;
  }

  const actor = req.user!.name || req.user!.phone;
  const nowIso = new Date().toISOString();

  // Update duplicate complaint
  const updatedDuplicateLinks = primary.duplicateLinks.includes(duplicate.id)
    ? primary.duplicateLinks
    : [...primary.duplicateLinks, duplicate.id];

  // Remove from primary's suggestions if present
  const updatedSuggestions = primary.duplicateSuggestions.filter((s) => s.candidateId !== duplicate.id);

  societyStore.updateComplaint(primary.id, {
    duplicateLinks: updatedDuplicateLinks,
    duplicateSuggestions: updatedSuggestions,
    timeline: [
      ...primary.timeline,
      {
        id: `tl-${Date.now()}-pri`,
        message: `Linked duplicate complaint ${duplicate.id} ("${duplicate.title}") by ${actor}`,
        actor,
        createdAt: nowIso,
      },
    ],
  });

  societyStore.updateComplaint(duplicate.id, {
    duplicateOfId: primary.id,
    timeline: [
      ...duplicate.timeline,
      {
        id: `tl-${Date.now()}-sec`,
        message: `Marked as linked duplicate of primary ticket ${primary.id} by ${actor}`,
        actor,
        createdAt: nowIso,
      },
    ],
  });

  const finalPrimary = societyStore.getComplaintById(primary.id)!;
  const finalDuplicate = societyStore.getComplaintById(duplicate.id)!;

  res.status(200).json({
    message: 'Duplicate complaint linked successfully',
    primary: formatComplaintWithSla(finalPrimary),
    duplicate: formatComplaintWithSla(finalDuplicate),
  });
});

/**
 * POST /api/v1/complaints/:id/reject-duplicate
 * Help desk dismisses a suggested duplicate candidate.
 */
complaintsRouter.post('/:id/reject-duplicate', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { candidateId, reason } = req.body;

  if (!candidateId) {
    res.status(400).json({ error: 'Candidate ID is required' });
    return;
  }

  const complaint = societyStore.getComplaintById(id);
  if (!complaint) {
    res.status(404).json({ error: 'Complaint not found' });
    return;
  }

  const actor = req.user!.name || req.user!.phone;
  const nowIso = new Date().toISOString();

  const filteredSuggestions = complaint.duplicateSuggestions.filter((s) => s.candidateId !== candidateId);

  const updated = societyStore.updateComplaint(id, {
    duplicateSuggestions: filteredSuggestions,
    timeline: [
      ...complaint.timeline,
      {
        id: `tl-${Date.now()}`,
        message: `Duplicate suggestion for ticket ${candidateId} rejected by ${actor}${reason ? ` (${reason})` : ''}`,
        actor,
        createdAt: nowIso,
      },
    ],
  });

  res.status(200).json({ complaint: formatComplaintWithSla(updated) });
});
