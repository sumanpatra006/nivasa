import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import { USER_ROLES } from '@nivasa/shared';
import { societyStore } from './societyStore.js';

export const billingRouter = Router();

billingRouter.use(authMiddleware);

// GET /api/v1/bills - Fetch invoices for authorized user/flats
billingRouter.get('/', (req: Request, res: Response) => {
  const user = req.user!;
  const allInvoices = societyStore.getInvoices();

  if (user.role === USER_ROLES.RESIDENT) {
    const userInvoices = allInvoices.filter((inv) => user.flatIds.includes(inv.flatId));
    res.status(200).json({ invoices: userInvoices });
    return;
  }

  // Staff and Committee see all society invoices
  res.status(200).json({ invoices: allInvoices });
});

// GET /api/v1/bills/:id - Fetch single invoice with horizontal flat isolation
billingRouter.get('/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = req.user!;
  const invoice = societyStore.getInvoiceById(id);

  if (!invoice) {
    res.status(404).json({ error: 'Not Found', message: `Invoice with ID ${id} not found.` });
    return;
  }

  // Enforce flat isolation: resident can only view invoices belonging to their authorized flats
  if (user.role === USER_ROLES.RESIDENT && !user.flatIds.includes(invoice.flatId)) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'You are not authorized to view this invoice.',
    });
    return;
  }

  res.status(200).json({ invoice });
});

// POST /api/v1/bills/generate - Committee/Accounts bulk billing cycle generation
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
