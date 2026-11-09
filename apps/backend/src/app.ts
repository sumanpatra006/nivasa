import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { env } from './config/env.js';

import { healthRouter } from './modules/health/health.router.js';
import { authRouter } from './modules/auth/auth.router.js';
import { flatsRouter } from './modules/flats/flats.router.js';
import { billingRouter } from './modules/billing/billing.router.js';
import { paymentsRouter } from './modules/payments/payments.router.js';
import { ledgerRouter } from './modules/ledger/ledger.router.js';
import { reconciliationRouter } from './modules/reconciliation/reconciliation.router.js';
import { complaintsRouter } from './modules/complaints/complaints.router.js';
import { assignmentsRouter } from './modules/assignments/assignments.router.js';
import { dashboardRouter } from './modules/dashboard/dashboard.router.js';
import { noticesRouter } from './modules/notices/notices.router.js';
import { visitorsRouter } from './modules/visitors/visitors.router.js';
import { amenitiesRouter } from './modules/amenities/amenities.router.js';
import { aiRouter } from './modules/ai/ai.router.js';
import { auditRouter } from './modules/audit/audit.router.js';

export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );

  app.use(express.json());

  // Base API v1 router per ARCHITECTURE.md
  const apiRouter = express.Router();

  // Wire all 13 core domain modules + health
  apiRouter.use('/health', healthRouter);
  apiRouter.use('/auth', authRouter);
  apiRouter.use('/flats', flatsRouter);
  apiRouter.use('/bills', billingRouter);
  apiRouter.use('/payments', paymentsRouter);
  apiRouter.use('/ledger', ledgerRouter);
  apiRouter.use('/reconciliation', reconciliationRouter);
  apiRouter.use('/complaints', complaintsRouter);
  apiRouter.use('/assignments', assignmentsRouter);
  apiRouter.use('/dashboard', dashboardRouter);
  apiRouter.use('/notices', noticesRouter);
  apiRouter.use('/visitors', visitorsRouter);
  apiRouter.use('/amenities', amenitiesRouter);
  apiRouter.use('/ai', aiRouter);
  apiRouter.use('/audit', auditRouter);

  app.use('/api/v1', apiRouter);

  // 404 Handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested API endpoint does not exist',
    });
  });

  // Global Error Handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: env.NODE_ENV === 'production' ? 'An unexpected error occurred' : String(err),
    });
  });

  return app;
}
