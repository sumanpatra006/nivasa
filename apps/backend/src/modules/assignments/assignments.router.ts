import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import { USER_ROLES } from '@nivasa/shared';

export const assignmentsRouter = Router();

assignmentsRouter.use(authMiddleware);
assignmentsRouter.use(rbacMiddleware([USER_ROLES.HELPDESK, USER_ROLES.COMMITTEE]));

const societyStaff = [
  { id: 'staff-1', name: 'Santosh Shinde', trade: 'Plumber', activeJobs: 2 },
  { id: 'staff-2', name: 'Mahesh Jadhav', trade: 'Electrician', activeJobs: 1 },
  { id: 'staff-3', name: 'Kisan Patil', trade: 'Lift Technician', activeJobs: 0 },
  { id: 'staff-4', name: 'Dilip Gaikwad', trade: 'Security Supervisor', activeJobs: 1 },
];

assignmentsRouter.get('/staff', (_req: Request, res: Response) => {
  res.status(200).json({ staff: societyStaff });
});

assignmentsRouter.post('/', (req: Request, res: Response) => {
  const { complaintId, assignedTo, reason } = req.body;
  res.status(200).json({
    message: 'Staff assignment recorded',
    assignment: {
      id: `asg-${Date.now()}`,
      complaintId,
      assignedTo,
      assignedBy: req.user!.id,
      assignedAt: new Date().toISOString(),
      reason,
    },
  });
});

