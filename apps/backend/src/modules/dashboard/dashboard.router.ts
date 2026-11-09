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
  (req: Request, res: Response) => {
    const period = typeof req.query.period === 'string' ? req.query.period : undefined;
    const metrics = CommitteeMetricsService.getMetrics(period);
    res.status(200).json(metrics);
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
  (req: Request, res: Response) => {
    const period = typeof req.query.period === 'string' ? req.query.period : undefined;
    const csvContent = CommitteeMetricsService.generateMonthlyCollectionCsv(period);

    const filename = `nivasa-monthly-collection-${period || 'all'}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
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
  (_req: Request, res: Response) => {
    const csvContent = CommitteeMetricsService.generateComplaintsCsv();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="nivasa-complaints-report.csv"');
    res.status(200).send(csvContent);
  }
);
