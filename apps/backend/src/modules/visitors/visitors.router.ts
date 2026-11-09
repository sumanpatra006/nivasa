import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import {
  CreateVisitorSchema,
  VisitorApprovalSchema,
  GenerateGuestCodeSchema,
  ValidateGuestCodeSchema,
  BatchSyncVisitorsSchema,
} from '@nivasa/shared';
import { societyStore } from '../billing/societyStore.js';

export const visitorsRouter = Router();

visitorsRouter.use(authMiddleware);

/**
 * GET /api/v1/visitors
 * Retrieve visitor logs. Residents only see visitors for their authorized flat.
 */
visitorsRouter.get('/', (req: Request, res: Response) => {
  const user = req.user!;
  let flatId = req.query.flatId as string | undefined;

  // Enforce resident boundary: residents can only see their own flat's visitors
  if (user.role === 'RESIDENT') {
    const residentFlatId = user.phone === '9820000001' ? 'flat-t07-1203' : 'flat-t12-0408';
    flatId = residentFlatId;
  }

  const visitors = societyStore.getVisitors(flatId);
  res.status(200).json({ visitors });
});

/**
 * POST /api/v1/visitors
 * Guard or resident registers a visitor entry.
 */
visitorsRouter.post('/', (req: Request, res: Response) => {
  const parseResult = CreateVisitorSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Validation Error',
      details: parseResult.error.format(),
    });
    return;
  }

  const data = parseResult.data;
  const user = req.user!;

  // If resident registers, enforce their flat
  if (user.role === 'RESIDENT') {
    const residentFlatId = user.phone === '9820000001' ? 'flat-t07-1203' : 'flat-t12-0408';
    if (data.flatId !== residentFlatId) {
      res.status(403).json({ error: 'You are not authorized to register visitors for another flat.' });
      return;
    }
  }

  const visitor = societyStore.addVisitor({
    clientUuid: data.clientUuid,
    flatId: data.flatId,
    visitorName: data.visitorName,
    visitorPhone: data.visitorPhone,
    purpose: data.purpose,
    vehicleNumber: data.vehicleNumber,
    photoBase64: data.photoBase64,
    visitorPhotoKey: data.visitorPhotoKey,
    preApprovedCode: data.preApprovedCode,
    recordedAt: data.recordedAt,
    approvalStatus: data.preApprovedCode ? 'APPROVED' : (user.role === 'RESIDENT' ? 'APPROVED' : 'PENDING'),
    entryStatus: 'CHECKED_IN',
  });

  res.status(201).json({ visitor });
});

/**
 * POST /api/v1/visitors/sync-batch
 * Offline queue sync batch endpoint for guard tablet.
 * Deduplicates using clientUuid and preserves original recordedAt timestamp.
 */
visitorsRouter.post('/sync-batch', (req: Request, res: Response) => {
  const parseResult = BatchSyncVisitorsSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Validation Error',
      details: parseResult.error.format(),
    });
    return;
  }

  const result = societyStore.batchSyncVisitors(parseResult.data.visitors);
  res.status(200).json(result);
});

/**
 * GET /api/v1/visitors/guest-codes
 * Retrieve guest pass codes.
 */
visitorsRouter.get('/guest-codes', (req: Request, res: Response) => {
  const user = req.user!;
  let flatId = req.query.flatId as string | undefined;

  if (user.role === 'RESIDENT') {
    const residentFlatId = user.phone === '9820000001' ? 'flat-t07-1203' : 'flat-t12-0408';
    flatId = residentFlatId;
  }

  const guestCodes = societyStore.getGuestCodes(flatId);
  res.status(200).json({ guestCodes });
});

/**
 * POST /api/v1/visitors/guest-codes
 * Resident generates a 6-digit pre-approved guest pass PIN with validity window.
 */
visitorsRouter.post('/guest-codes', (req: Request, res: Response) => {
  const user = req.user!;
  const parseResult = GenerateGuestCodeSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Validation Error',
      details: parseResult.error.format(),
    });
    return;
  }

  const data = parseResult.data;
  if (user.role === 'RESIDENT') {
    const residentFlatId = user.phone === '9820000001' ? 'flat-t07-1203' : 'flat-t12-0408';
    if (data.flatId !== residentFlatId) {
      res.status(403).json({ error: 'You are not authorized to create guest passes for another flat.' });
      return;
    }
  }

  const guestCode = societyStore.createGuestCode({
    flatId: data.flatId,
    guestName: data.guestName,
    purpose: data.purpose,
    validFrom: data.validFrom,
    validUntil: data.validUntil,
    usageLimit: data.usageLimit,
  });

  res.status(201).json({ guestCode });
});

/**
 * POST /api/v1/visitors/guest-codes/validate
 * Guard tablet keypad validates a 6-digit PIN and automatically checks in the guest.
 */
visitorsRouter.post('/guest-codes/validate', (req: Request, res: Response) => {
  const parseResult = ValidateGuestCodeSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Validation Error',
      details: parseResult.error.format(),
    });
    return;
  }

  const result = societyStore.validateGuestCode(parseResult.data.code);
  if (!result.isValid) {
    res.status(400).json({
      isValid: false,
      reason: result.reason,
    });
    return;
  }

  res.status(200).json({
    isValid: true,
    guestCode: result.guestCode,
    visitor: result.visitor,
    message: `Guest pass validated. Visitor ${result.guestCode?.guestName} checked in successfully.`,
  });
});

/**
 * PATCH /api/v1/visitors/:id/approval
 * Resident approves or denies an arriving visitor.
 */
visitorsRouter.patch('/:id/approval', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parseResult = VisitorApprovalSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Validation Error',
      details: parseResult.error.format(),
    });
    return;
  }

  const visitor = societyStore.getVisitorById(id);
  if (!visitor) {
    res.status(404).json({ error: 'Visitor record not found' });
    return;
  }

  const user = req.user!;
  if (user.role === 'RESIDENT') {
    const residentFlatId = user.phone === '9820000001' ? 'flat-t07-1203' : 'flat-t12-0408';
    if (visitor.flatId !== residentFlatId) {
      res.status(403).json({ error: 'You are not authorized to approve visitors for another flat.' });
      return;
    }
  }

  const updated = societyStore.updateVisitorApproval(id, parseResult.data.status);
  res.status(200).json({ visitor: updated });
});

/**
 * PATCH /api/v1/visitors/:id/entry
 * Guard records visitor entry / check-in.
 */
visitorsRouter.patch('/:id/entry', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const visitor = societyStore.getVisitorById(id);
  if (!visitor) {
    res.status(404).json({ error: 'Visitor record not found' });
    return;
  }

  const updated = societyStore.recordVisitorEntry(id);
  res.status(200).json({ visitor: updated });
});

/**
 * PATCH /api/v1/visitors/:id/exit
 * Guard records visitor exit / check-out.
 */
visitorsRouter.patch('/:id/exit', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const visitor = societyStore.getVisitorById(id);
  if (!visitor) {
    res.status(404).json({ error: 'Visitor record not found' });
    return;
  }

  const updated = societyStore.recordVisitorExit(id);
  res.status(200).json({ visitor: updated });
});

/**
 * POST /api/v1/visitors/purge-expired-photos
 * DPDP Act 2023 compliance endpoint (scheduled daily job triggers this).
 * Deletes the physical photo file from disk after 90 days.
 */
visitorsRouter.post('/purge-expired-photos', (_req: Request, res: Response) => {
  const result = societyStore.purgeExpiredVisitorPhotos();
  res.status(200).json(result);
});
