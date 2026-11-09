import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import {
  CreateVisitorSchema,
  VisitorApprovalSchema,
  GenerateGuestCodeSchema,
  ValidateGuestCodeSchema,
  BatchSyncVisitorsSchema,
} from '@nivasa/shared';
import { VisitorRepository } from '../../repositories/visitor.repository.js';

export const visitorsRouter = Router();

visitorsRouter.use(authMiddleware);

/**
 * GET /api/v1/visitors
 * Retrieve visitor logs from the database.
 */
visitorsRouter.get('/', async (req: Request, res: Response) => {
  const user = req.user!;
  let flatId = req.query.flatId as string | undefined;

  if (user.role === 'RESIDENT') {
    flatId = user.flatIds[0];
  }

  const visitors = await VisitorRepository.findMany(flatId);
  res.status(200).json({ visitors });
});

/**
 * POST /api/v1/visitors
 * Guard or resident registers a visitor entry.
 */
visitorsRouter.post('/', async (req: Request, res: Response) => {
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

  if (user.role === 'RESIDENT' && !user.flatIds.includes(data.flatId)) {
    res.status(403).json({ error: 'You are not authorized to register visitors for another flat.' });
    return;
  }

  const visitor = await VisitorRepository.create({
    flatId: data.flatId,
    visitorName: data.visitorName,
    visitorPhone: data.visitorPhone,
    purpose: data.purpose,
    vehicleNumber: data.vehicleNumber,
    photoBase64: data.photoBase64,
    approvalStatus: user.role === 'RESIDENT' ? 'APPROVED' : 'PENDING',
  });

  res.status(201).json({ visitor });
});

/**
 * PATCH /api/v1/visitors/:id/approval
 * Resident approves or denies pending visitor entry.
 */
visitorsRouter.patch('/:id/approval', async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parseResult = VisitorApprovalSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Validation Error',
      details: parseResult.error.format(),
    });
    return;
  }

  const { status } = parseResult.data;
  const updated = await VisitorRepository.updateApproval(id, status);

  if (!updated) {
    res.status(404).json({ error: 'Visitor record not found' });
    return;
  }

  res.status(200).json({
    message: `Visitor entry ${status.toLowerCase()} successfully`,
    visitor: updated,
  });
});

/**
 * POST /api/v1/visitors/:id/exit
 * Guard logs visitor exit.
 */
visitorsRouter.post('/:id/exit', async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const updated = await VisitorRepository.recordExit(id);

  if (!updated) {
    res.status(404).json({ error: 'Visitor record not found' });
    return;
  }

  res.status(200).json({
    message: 'Visitor departure confirmed',
    visitor: updated,
  });
});

/**
 * POST /api/v1/visitors/purge-photos
 * DPDP Act 2023 compliance scheduled photo deletion job.
 */
visitorsRouter.post('/purge-photos', async (_req: Request, res: Response) => {
  const purgeResult = await VisitorRepository.purgeExpiredPhotos();

  res.status(200).json({
    message: 'DPDP 90-day retention purge completed',
    purgedPhotosCount: purgeResult.purgedCount,
    purgedFiles: purgeResult.filesDeleted,
    complianceStatus: 'DPDP_ACT_2023_COMPLIANT',
  });
});

/**
 * GET /api/v1/visitors/guest-codes
 * Retrieve active pre-approved guest codes.
 */
visitorsRouter.get('/guest-codes', async (req: Request, res: Response) => {
  const user = req.user!;
  let flatId = req.query.flatId as string | undefined;

  if (user.role === 'RESIDENT') {
    flatId = user.flatIds[0];
  }

  const codes = await VisitorRepository.getGuestCodes(flatId);
  res.status(200).json({ guestCodes: codes });
});

/**
 * POST /api/v1/visitors/guest-codes
 * Resident generates a 6-digit PIN for an upcoming guest.
 */
visitorsRouter.post('/guest-codes', async (req: Request, res: Response) => {
  const parseResult = GenerateGuestCodeSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Validation Error',
      details: parseResult.error.format(),
    });
    return;
  }

  const data = parseResult.data;
  const user = req.user!;

  if (user.role === 'RESIDENT' && !user.flatIds.includes(data.flatId)) {
    res.status(403).json({ error: 'You are not authorized to create guest passes for another flat.' });
    return;
  }

  const validUntilHours = data.validUntil
    ? Math.max(1, Math.round((new Date(data.validUntil).getTime() - Date.now()) / 3600000))
    : 24;

  const guestCode = await VisitorRepository.createGuestCode({
    flatId: data.flatId,
    residentId: user.id || 'user-staff-vikram',
    guestName: data.guestName,
    validUntilHours,
  });

  res.status(201).json({ guestCode });
});

/**
 * POST /api/v1/visitors/guest-codes/validate
 * Guard terminal enters 6-digit PIN on tablet keypad.
 */
visitorsRouter.post('/guest-codes/validate', async (req: Request, res: Response) => {
  const parseResult = ValidateGuestCodeSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Validation Error',
      details: parseResult.error.format(),
    });
    return;
  }

  const result = await VisitorRepository.validateGuestCode(parseResult.data.code);

  res.status(200).json({
    isValid: result.isValid,
    reason: result.reason,
    guestCode: result.guestCode,
  });
});

/**
 * POST /api/v1/visitors/batch-sync
 * Guard tablet syncs queued offline visitor records when reconnecting.
 */
visitorsRouter.post('/batch-sync', async (req: Request, res: Response) => {
  const parseResult = BatchSyncVisitorsSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Validation Error',
      details: parseResult.error.format(),
    });
    return;
  }

  const items = parseResult.data.visitors;
  for (const item of items) {
    await VisitorRepository.create({
      flatId: item.flatId,
      visitorName: item.visitorName,
      visitorPhone: item.visitorPhone,
      purpose: item.purpose,
      vehicleNumber: item.vehicleNumber,
      photoBase64: item.photoBase64,
    });
  }

  res.status(200).json({
    message: `Successfully synchronized ${items.length} visitor record(s).`,
    syncedCount: items.length,
    totalReceived: items.length,
  });
});
