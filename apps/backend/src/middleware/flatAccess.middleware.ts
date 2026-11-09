import { Request, Response, NextFunction } from 'express';
import { USER_ROLES } from '@nivasa/shared';

/**
 * Ensures that a resident can only access data belonging to their authorized flats.
 * Staff roles (HELPDESK, ACCOUNTS, COMMITTEE) bypass flat-level ownership checks.
 */
export function flatAccessMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
    return;
  }

  // Staff roles have broad society access
  if (req.user.role !== USER_ROLES.RESIDENT) {
    return next();
  }

  const requestedFlatId = req.params.flatId || req.body?.flatId || req.query?.flatId;
  if (!requestedFlatId) {
    return next();
  }

  if (!req.user.flatIds.includes(String(requestedFlatId))) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'You are not authorized to access records for this flat',
    });
    return;
  }

  next();
}

