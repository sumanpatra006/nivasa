import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { flatAccessMiddleware } from '../../middleware/flatAccess.middleware.js';

export const flatsRouter = Router();

flatsRouter.use(authMiddleware);

flatsRouter.get('/my-flats', (req: Request, res: Response) => {
  const user = req.user!;
  res.status(200).json({
    flats: user.flatIds.map((id) => ({
      id,
      tower: id.includes('t07') ? 'T07' : id.includes('t12') ? 'T12' : 'T21',
      flatNumber: id.includes('1203') ? '1203' : id.includes('0408') ? '0408' : '1601',
      areaSqFt: id.includes('1203') ? 1150 : id.includes('0408') ? 980 : 1640,
      maintenanceRate: 650,
    })),
  });
});

flatsRouter.get('/:flatId', flatAccessMiddleware, (req: Request, res: Response) => {
  const { flatId } = req.params;
  res.status(200).json({
    flat: {
      id: flatId,
      tower: flatId.includes('t07') ? 'T07' : 'T12',
      flatNumber: flatId.includes('1203') ? '1203' : '0408',
      areaSqFt: flatId.includes('1203') ? 1150 : 980,
      maintenanceRate: 650,
      isActive: true,
    },
  });
});

