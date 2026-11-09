import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { flatAccessMiddleware } from '../../middleware/flatAccess.middleware.js';

export const ledgerRouter = Router();

ledgerRouter.use(authMiddleware);

ledgerRouter.get('/:flatId', flatAccessMiddleware, (req: Request, res: Response) => {
  const { flatId } = req.params;

  const entries = [
    {
      id: 'led-1',
      flatId,
      entryType: 'BILL',
      amountPaise: 747500,
      description: 'Monthly Maintenance November 2026',
      createdAt: '2026-11-01T00:00:00Z',
    },
    {
      id: 'led-2',
      flatId,
      entryType: 'PAYMENT',
      amountPaise: 747500,
      description: 'Online Payment via Mock Gateway',
      createdAt: '2026-11-02T14:30:00Z',
    },
  ];

  const closingBalancePaise = entries.reduce((acc, curr) => {
    return curr.entryType === 'BILL' || curr.entryType === 'LATE_FEE'
      ? acc + curr.amountPaise
      : acc - curr.amountPaise;
  }, 0);

  res.status(200).json({
    flatId,
    closingBalancePaise,
    entries,
  });
});

