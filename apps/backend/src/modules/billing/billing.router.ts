import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import { USER_ROLES, calculateMaintenancePaise } from '@nivasa/shared';

export const billingRouter = Router();

billingRouter.use(authMiddleware);

billingRouter.get('/', (req: Request, res: Response) => {
  const user = req.user!;
  const sampleInvoices = [
    {
      id: 'inv-t07-1203-202611',
      flatId: 'flat-t07-1203',
      billingPeriod: '2026-11',
      areaSqFt: 1150,
      ratePerSqFt: 650,
      baseAmountPaise: calculateMaintenancePaise(1150, 650),
      lateFeePaise: 0,
      totalAmountPaise: 747500,
      paidAmountPaise: 747500,
      dueDate: '2026-11-10T00:00:00Z',
      status: 'PAID',
      daysOverdue: 0,
    },
    {
      id: 'inv-t12-0408-202611',
      flatId: 'flat-t12-0408',
      billingPeriod: '2026-11',
      areaSqFt: 980,
      ratePerSqFt: 650,
      baseAmountPaise: calculateMaintenancePaise(980, 650),
      lateFeePaise: 0,
      totalAmountPaise: 637000,
      paidAmountPaise: 0,
      dueDate: '2026-09-24T00:00:00Z',
      status: 'OVERDUE',
      daysOverdue: 47,
    },
    {
      id: 'inv-t21-1601-202611',
      flatId: 'flat-t21-1601',
      billingPeriod: '2026-11',
      areaSqFt: 1640,
      ratePerSqFt: 650,
      baseAmountPaise: calculateMaintenancePaise(1640, 650),
      lateFeePaise: 0,
      totalAmountPaise: 1066000,
      paidAmountPaise: 500000,
      dueDate: '2026-10-23T00:00:00Z',
      status: 'PARTIALLY_PAID',
      daysOverdue: 18,
    },
  ];

  if (user.role === USER_ROLES.RESIDENT) {
    const userInvoices = sampleInvoices.filter((inv) => user.flatIds.includes(inv.flatId));
    res.status(200).json({ invoices: userInvoices });
    return;
  }

  res.status(200).json({ invoices: sampleInvoices });
});

billingRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  res.status(200).json({
    invoice: {
      id,
      flatId: 'flat-t07-1203',
      billingPeriod: '2026-11',
      areaSqFt: 1150,
      ratePerSqFt: 650,
      baseAmountPaise: 747500,
      lateFeePaise: 0,
      totalAmountPaise: 747500,
      paidAmountPaise: 747500,
      status: 'PAID',
      dueDate: '2026-11-10T00:00:00Z',
    },
  });
});

billingRouter.post(
  '/generate',
  rbacMiddleware([USER_ROLES.ACCOUNTS, USER_ROLES.COMMITTEE]),
  (_req: Request, res: Response) => {
    res.status(201).json({
      message: 'Monthly billing cycle generated for 2,400 flats',
      billingPeriod: '2026-11',
      totalBilledPaise: 1800000000,
    });
  }
);

