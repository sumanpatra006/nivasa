import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import { USER_ROLES } from '@nivasa/shared';

export const auditRouter = Router();

auditRouter.use(authMiddleware);
auditRouter.use(rbacMiddleware([USER_ROLES.COMMITTEE, USER_ROLES.ACCOUNTS]));

const mockAuditLogs = [
  {
    id: 'aud-1',
    actorId: 'user-9876543211',
    actorName: 'Pooja Mehta (Accounts Officer)',
    entityType: 'RECONCILIATION_MATCH',
    entityId: 'txn-bank-01',
    action: 'CONFIRM_AND_POST',
    metadata: { invoiceId: 'inv-t07-1203-202611', amountPaise: 747500 },
    createdAt: '2026-11-02T10:30:00Z',
  },
  {
    id: 'aud-2',
    actorId: 'user-9876543210',
    actorName: 'Ramesh Sawant (Helpdesk Duty)',
    entityType: 'COMPLAINT',
    entityId: 'cmp-01',
    action: 'REASSIGN_CATEGORY',
    metadata: { previousCategory: 'OTHER', newCategory: 'PLUMBING' },
    createdAt: '2026-11-01T09:10:00Z',
  },
];

auditRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).json({ logs: mockAuditLogs });
});

