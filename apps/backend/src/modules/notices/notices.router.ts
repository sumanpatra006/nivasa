import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import { USER_ROLES } from '@nivasa/shared';

export const noticesRouter = Router();

noticesRouter.use(authMiddleware);

const activeNotices = [
  {
    id: 'ntc-1',
    title: 'Water Tank Cleaning Schedule — Towers T01 to T14',
    body: 'Overhead water tank cleaning scheduled on Saturday 14th November from 10:00 AM to 4:00 PM. Water supply will be interrupted during this period.',
    publishedAt: '2026-11-05T09:00:00Z',
    author: 'Society Management Office',
  },
  {
    id: 'ntc-2',
    title: 'Annual General Meeting (AGM) Notice',
    body: 'The Annual General Body Meeting of the Nivasa Residents Federation will be convened in the Main Clubhouse on Sunday 29th November at 10:30 AM.',
    publishedAt: '2026-11-01T10:00:00Z',
    author: 'Dr. Vikram Deshmukh (Secretary)',
  },
];

noticesRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).json({ notices: activeNotices });
});

noticesRouter.post(
  '/',
  rbacMiddleware([USER_ROLES.COMMITTEE, USER_ROLES.HELPDESK]),
  (req: Request, res: Response) => {
    const { title, body } = req.body;
    const newNotice = {
      id: `ntc-${Date.now()}`,
      title,
      body,
      publishedAt: new Date().toISOString(),
      author: req.user!.name || 'Authorized Staff',
    };
    activeNotices.unshift(newNotice);
    res.status(201).json({ notice: newNotice });
  }
);

