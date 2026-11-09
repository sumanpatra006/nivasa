import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { RequestOtpSchema, VerifyOtpSchema, USER_ROLES, UserRole } from '@nivasa/shared';
import { env } from '../../config/env.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

export const authRouter = Router();

// In-memory demo OTP store (keyed by phone)
const otpStore = new Map<string, { code: string; expiresAt: number }>();

authRouter.post('/request-otp', (req: Request, res: Response) => {
  const parsed = RequestOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation Error', details: parsed.error.format() });
    return;
  }

  const { phone } = parsed.data;
  const code = env.DEV_OTP_ENABLED ? env.DEV_OTP_DEFAULT_CODE : Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min expiry

  otpStore.set(phone, { code, expiresAt });

  res.status(200).json({
    message: 'OTP sent successfully',
    phone,
    isDevMode: env.DEV_OTP_ENABLED,
  });
});

authRouter.post('/verify-otp', (req: Request, res: Response) => {
  const parsed = VerifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation Error', details: parsed.error.format() });
    return;
  }

  const { phone, otp } = parsed.data;
  const stored = otpStore.get(phone);

  const isValid =
    (env.DEV_OTP_ENABLED && otp === env.DEV_OTP_DEFAULT_CODE) ||
    (stored && stored.code === otp && stored.expiresAt > Date.now());

  if (!isValid) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired OTP' });
    return;
  }

  // Demo user assignment based on authoritative seed accounts
  let role: UserRole = USER_ROLES.RESIDENT;
  let flatIds: string[] = ['flat-t07-1203'];
  let name = 'Resident User';

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

  const token = jwt.sign(
    {
      id: `user-${phone}`,
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
