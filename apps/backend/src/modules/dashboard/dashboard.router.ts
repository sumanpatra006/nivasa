import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { rbacMiddleware } from '../../middleware/rbac.middleware.js';
import { USER_ROLES } from '@nivasa/shared';
import { CommitteeMetricsService } from './committeeMetrics.service.js';

export const dashboardRouter = Router();

dashboardRouter.use(authMiddleware);

/**
 * GET /api/v1/dashboard/committee
 * Restricted to COMMITTEE and ACCOUNTS roles.
 * Returns comprehensive financial, dues ageing, flat-level accounts, and complaint metrics
 * calculated strictly from actual database records.
 */
dashboardRouter.get(
  '/committee',
  rbacMiddleware([USER_ROLES.COMMITTEE, USER_ROLES.ACCOUNTS]),
  async (req: Request, res: Response) => {
    try {
      const period = typeof req.query.period === 'string' ? req.query.period : undefined;
      const metrics = await CommitteeMetricsService.getMetrics(period);
      res.status(200).json(metrics);
    } catch (err) {
      res.status(500).json({ error: 'Failed to compute committee metrics', details: String(err) });
    }
  }
);

/**
 * GET /api/v1/dashboard/reports/monthly-collection
 * Restricted to COMMITTEE and ACCOUNTS roles.
 * Generates and downloads a monthly collection CSV report using actual database records.
 */
dashboardRouter.get(
  '/reports/monthly-collection',
  rbacMiddleware([USER_ROLES.COMMITTEE, USER_ROLES.ACCOUNTS]),
  async (req: Request, res: Response) => {
    try {
      const period = typeof req.query.period === 'string' ? req.query.period : undefined;
      const csvContent = await CommitteeMetricsService.generateMonthlyCollectionCsv(period);

      const filename = `nivasa-monthly-collection-${period || 'all'}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvContent);
    } catch (err) {
      res.status(500).json({ error: 'Failed to generate collection CSV', details: String(err) });
    }
  }
);

/**
 * GET /api/v1/dashboard/reports/complaints
 * Restricted to COMMITTEE and ACCOUNTS roles.
 * Generates and downloads a complaint quality and response SLA CSV report.
 */
dashboardRouter.get(
  '/reports/complaints',
  rbacMiddleware([USER_ROLES.COMMITTEE, USER_ROLES.ACCOUNTS]),
  async (_req: Request, res: Response) => {
    try {
      const csvContent = await CommitteeMetricsService.generateComplaintsCsv();

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="nivasa-complaints-report.csv"');
      res.status(200).send(csvContent);
    } catch (err) {
      res.status(500).json({ error: 'Failed to generate complaints CSV', details: String(err) });
    }
  }
);
