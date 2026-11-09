import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { BookAmenitySchema, CancelBookingSchema } from '@nivasa/shared';
import { societyStore } from '../billing/societyStore.js';

export const amenitiesRouter = Router();

amenitiesRouter.use(authMiddleware);

/**
 * GET /api/v1/amenities
 * List all active society amenities with rules and demo fees.
 */
amenitiesRouter.get('/', (_req: Request, res: Response) => {
  const amenities = societyStore.getAmenities();
  res.status(200).json({
    amenities,
    disclaimer: 'All fees and bye-law rules are demo simulations for testing purposes only.',
  });
});

/**
 * GET /api/v1/amenities/bookings
 * List amenity bookings. Residents see their flat bookings; staff see all.
 */
amenitiesRouter.get('/bookings', (req: Request, res: Response) => {
  const user = req.user!;
  let flatId = req.query.flatId as string | undefined;

  if (user.role === 'RESIDENT') {
    const residentFlatId = user.phone === '9820000001' ? 'flat-t07-1203' : 'flat-t12-0408';
    flatId = residentFlatId;
  }

  const bookings = societyStore.getAmenityBookings(flatId);
  res.status(200).json({ bookings });
});

/**
 * GET /api/v1/amenities/:id/slots
 * Retrieve time slot availability for a specified date (YYYY-MM-DD).
 */
amenitiesRouter.get('/:id/slots', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10);

  try {
    const slots = societyStore.getAmenitySlots(id, dateStr);
    res.status(200).json({
      amenityId: id,
      date: dateStr,
      slots,
    });
  } catch (err: any) {
    res.status(404).json({ error: err.message || 'Amenity not found' });
  }
});

/**
 * POST /api/v1/amenities/:id/book
 * Book an amenity slot.
 * Rejects with 409 Conflict if slot is already occupied.
 */
amenitiesRouter.post('/:id/book', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = req.user!;

  const parseResult = BookAmenitySchema.safeParse({
    flatId: req.body.flatId,
    startAt: req.body.startAt,
    endAt: req.body.endAt,
  });

  if (!parseResult.success) {
    res.status(400).json({
      error: 'Validation Error',
      details: parseResult.error.format(),
    });
    return;
  }

  const data = parseResult.data;

  // Authorization check for residents
  if (user.role === 'RESIDENT') {
    const residentFlatId = user.phone === '9820000001' ? 'flat-t07-1203' : 'flat-t12-0408';
    if (data.flatId !== residentFlatId) {
      res.status(403).json({ error: 'You are not authorized to book amenities for another flat.' });
      return;
    }
  }

  try {
    const booking = societyStore.bookAmenity({
      amenityId: id,
      flatId: data.flatId,
      residentId: user.id,
      residentName: user.name || 'Resident',
      startAt: data.startAt,
      endAt: data.endAt,
    });

    res.status(201).json({ booking });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      error: statusCode === 409 ? 'Conflict' : 'Error',
      message: err.message,
    });
  }
});

/**
 * POST /api/v1/amenities/bookings/:id/cancel
 * Cancel an active amenity booking. Frees up the slot immediately.
 */
amenitiesRouter.post('/bookings/:id/cancel', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = req.user!;

  try {
    const booking = societyStore.cancelAmenityBooking(id, user.id, user.role);
    res.status(200).json({
      message: 'Booking cancelled successfully. The slot is now available.',
      booking,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      error: statusCode === 403 ? 'Forbidden' : 'Error',
      message: err.message,
    });
  }
});
