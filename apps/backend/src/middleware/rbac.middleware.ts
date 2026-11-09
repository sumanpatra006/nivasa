import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@nivasa/shared';

export function rbacMiddleware(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required for this operation',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Role ${req.user.role} does not have permission to access this resource`,
      });
      return;
    }

    next();
  };
}

