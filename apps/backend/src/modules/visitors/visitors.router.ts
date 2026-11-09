import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';

export const visitorsRouter = Router();

visitorsRouter.use(authMiddleware);

const mockVisitors: Array<{
  id: string;
  flatId: string;
  visitorName: string;
  purpose: string;
  arrivedAt: string;
  approvalStatus: string;
  photoRetainUntil: string;
  visitorPhotoKey?: string;
}> = [
  {
    id: 'vis-1',
    flatId: 'flat-t07-1203',
    visitorName: 'Sunil Verma',
    purpose: 'Amazon Package Delivery',
    arrivedAt: '2026-11-09T11:45:00Z',
    approvalStatus: 'APPROVED',
    photoRetainUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    visitorPhotoKey: 'photo-stub.jpg',
  },
];

visitorsRouter.get('/', (req: Request, res: Response) => {
  const { flatId } = req.query;
  if (flatId) {
    res.status(200).json({ visitors: mockVisitors.filter((v) => v.flatId === flatId) });
    return;
  }
  res.status(200).json({ visitors: mockVisitors });
});

visitorsRouter.post('/', (req: Request, res: Response) => {
  const { flatId, visitorName, purpose, visitorPhotoKey } = req.body;
  const newVisitor = {
    id: `vis-${Date.now()}`,
    flatId,
    visitorName,
    purpose: purpose || 'Guest Visit',
    visitorPhotoKey: visitorPhotoKey || 'photo-stub.jpg',
    arrivedAt: new Date().toISOString(),
    approvalStatus: 'PENDING',
    photoRetainUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  };

  mockVisitors.unshift(newVisitor);
  res.status(201).json({ visitor: newVisitor });
});

visitorsRouter.patch('/:id/approval', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const visitor = mockVisitors.find((v) => v.id === id);
  if (!visitor) {
    res.status(404).json({ error: 'Visitor record not found' });
    return;
  }
  visitor.approvalStatus = status; // APPROVED or REJECTED
  res.status(200).json({ visitor });
});

// DPDP Act 2023 compliance endpoint (scheduled daily job triggers this)
visitorsRouter.post('/purge-expired-photos', (_req: Request, res: Response) => {
  const now = Date.now();
  let purgedCount = 0;
  for (const visitor of mockVisitors) {
    if (new Date(visitor.photoRetainUntil).getTime() < now && visitor.visitorPhotoKey) {
      delete visitor.visitorPhotoKey;
      purgedCount++;
    }
  }

  res.status(200).json({
    message: 'DPDP 90-day retention purge completed',
    purgedPhotosCount: purgedCount,
    complianceStatus: 'DPDP_ACT_2023_COMPLIANT',
  });
});
