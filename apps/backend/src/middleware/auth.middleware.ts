import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UserRole } from '@nivasa/shared';

export interface AuthUser {
  id: string;
  phone: string;
  role: UserRole;
  flatIds: string[];
  name?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token is missing or malformed',
    });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    req.user = payload;
    next();
  } catch (_error) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired session token',
    });
  }
}
