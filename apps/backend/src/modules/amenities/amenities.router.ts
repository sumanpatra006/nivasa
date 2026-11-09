import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';

export const amenitiesRouter = Router();

amenitiesRouter.use(authMiddleware);

const mockAmenities = [
  { id: 'amen-1', name: 'Main Clubhouse Hall', feePaise: 500000, capacity: 150, isActive: true },
  { id: 'amen-2', name: 'Tennis Court 1', feePaise: 20000, capacity: 4, isActive: true },
  { id: 'amen-3', name: 'Badminton Court A', feePaise: 15000, capacity: 4, isActive: true },
];

const mockBookings: any[] = [];

amenitiesRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).json({ amenities: mockAmenities });
});

amenitiesRouter.post('/:id/book', (req: Request, res: Response) => {
  const { id } = req.params;
  const { flatId, startAt, endAt } = req.body;

  const amenity = mockAmenities.find((a) => a.id === id);
  if (!amenity) {
    res.status(404).json({ error: 'Amenity not found' });
    return;
  }

  // Conflict overlap check
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();

  const hasConflict = mockBookings.some((b) => {
    if (b.amenityId !== id || b.status !== 'CONFIRMED') return false;
    const bStart = new Date(b.startAt).getTime();
    const bEnd = new Date(b.endAt).getTime();
    return start < bEnd && end > bStart;
  });

  if (hasConflict) {
    res.status(409).json({
      error: 'Conflict',
      message: 'The requested amenity slot is already booked. Please choose another time window.',
    });
    return;
  }

  const booking = {
    id: `book-${Date.now()}`,
    amenityId: id,
    flatId,
    residentId: req.user!.id,
    startAt,
    endAt,
    feePaise: amenity.feePaise,
    status: 'CONFIRMED',
    createdAt: new Date().toISOString(),
  };

  mockBookings.push(booking);
  res.status(201).json({ booking });
});

