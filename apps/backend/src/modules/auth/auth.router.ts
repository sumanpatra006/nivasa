import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { RequestOtpSchema, VerifyOtpSchema, USER_ROLES, UserRole } from '@nivasa/shared';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { SmsService } from '../../services/sms.service.js';

export const authRouter = Router();

authRouter.post('/request-otp', async (req: Request, res: Response) => {
  const parsed = RequestOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation Error', details: parsed.error.format() });
    return;
  }

  const { phone } = parsed.data;
  const result = await SmsService.sendOtp(phone);

  res.status(200).json({
    message: 'OTP sent successfully to registered mobile number',
    phone,
    isDevMode: env.DEV_OTP_ENABLED,
    expiresAt: result.expiresAt,
    provider: result.provider,
  });
});

authRouter.post('/verify-otp', async (req: Request, res: Response) => {
  const parsed = VerifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation Error', details: parsed.error.format() });
    return;
  }

  const { phone, otp } = parsed.data;
  const verification = await SmsService.verifyOtp(phone, otp);

  if (!verification.isValid) {
    res.status(401).json({ error: 'Unauthorized', message: verification.reason || 'Invalid or expired OTP' });
    return;
  }

  // Look up user from Neon PostgreSQL Database first
  let role: UserRole = USER_ROLES.RESIDENT;
  let flatIds: string[] = ['flat-t07-1203'];
  let name = 'Resident User';
  let userId = `user-${phone}`;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { phone },
      include: {
        flatMemberships: {
          include: { flat: true },
        },
      },
    });

    if (dbUser) {
      userId = dbUser.id;
      name = dbUser.name;
      role = dbUser.role as UserRole;
      if (dbUser.flatMemberships && dbUser.flatMemberships.length > 0) {
        flatIds = dbUser.flatMemberships.map((m: any) => m.flatId);
      } else {
        flatIds = [];
      }
    } else {
      // Deterministic fallback assignment when user not found in DB
      if (phone === '9876543210') {
        role = USER_ROLES.HELPDESK;
        flatIds = [];
        name = 'Ramesh Sawant (Helpdesk Duty)';
      } else if (phone === '9876543211') {
        role = USER_ROLES.ACCOUNTS;
        flatIds = [];
        name = 'Pooja Mehta (Accounts Officer)';
      } else if (phone === '9876543212') {
        role = USER_ROLES.COMMITTEE;
        flatIds = [];
        name = 'Dr. Vikram Deshmukh (Secretary)';
      } else if (phone === '9876543213') {
        role = USER_ROLES.GUARD;
        flatIds = [];
        name = 'Security Guard (Gate 1)';
      } else if (phone === '9820000002') {
        role = USER_ROLES.RESIDENT;
        flatIds = ['flat-t12-0408'];
        name = 'Swati Joshi';
      } else if (phone === '9820000003') {
        role = USER_ROLES.RESIDENT;
        flatIds = ['flat-t21-1601'];
        name = 'Aamir Shaikh';
      } else {
        name = 'Neeraj Kulkarni';
      }
    }
  } catch {
    // Deterministic fallback assignment when database is unreachable / offline
    if (phone === '9876543210') {
      role = USER_ROLES.HELPDESK;
      flatIds = [];
      name = 'Ramesh Sawant (Helpdesk Duty)';
    } else if (phone === '9876543211') {
      role = USER_ROLES.ACCOUNTS;
      flatIds = [];
      name = 'Pooja Mehta (Accounts Officer)';
    } else if (phone === '9876543212') {
      role = USER_ROLES.COMMITTEE;
      flatIds = [];
      name = 'Dr. Vikram Deshmukh (Secretary)';
    } else if (phone === '9876543213') {
      role = USER_ROLES.GUARD;
      flatIds = [];
      name = 'Security Guard (Gate 1)';
    } else if (phone === '9820000002') {
      role = USER_ROLES.RESIDENT;
      flatIds = ['flat-t12-0408'];
      name = 'Swati Joshi';
    } else if (phone === '9820000003') {
      role = USER_ROLES.RESIDENT;
      flatIds = ['flat-t21-1601'];
      name = 'Aamir Shaikh';
    } else {
      name = 'Neeraj Kulkarni';
    }
  }

  const token = jwt.sign(
    {
      id: userId,
      phone,
      role,
      flatIds,
      name,
    },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.status(200).json({
    token,
    user: {
      phone,
      role,
      flatIds,
      name,
    },
  });
});

authRouter.get('/me', authMiddleware, (req: Request, res: Response) => {
  res.status(200).json({ user: req.user });
});

authRouter.post('/logout', authMiddleware, (_req: Request, res: Response) => {
  res.status(200).json({ message: 'Logged out successfully' });
});
