import { describe, it, expect } from 'vitest';
import { dispatchRequest } from './testHelper.js';

describe('Authentication & Session Flow', () => {
  it('requests OTP for a valid phone number', async () => {
    const res = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/request-otp',
      body: { phone: '9820000001' },
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'OTP sent successfully');
    expect(res.body).toHaveProperty('isDevMode', true);
  });

  it('rejects invalid phone number formats', async () => {
    const res = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/request-otp',
      body: { phone: '123' },
    });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation Error');
  });

  it('verifies development OTP "123456" and returns JWT and user claims', async () => {
    const res = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9820000001', otp: '123456' },
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toEqual({
      phone: '9820000001',
      role: 'RESIDENT',
      flatIds: ['flat-t07-1203'],
      name: 'Neeraj Kulkarni',
    });
  });

  it('rejects invalid OTP code', async () => {
    const res = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9820000001', otp: '000000' },
    });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message', 'Invalid or expired OTP');
  });

  it('returns current user details on GET /api/v1/auth/me with valid Bearer token', async () => {
    // 1. Login to get token
    const loginRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9820000001', otp: '123456' },
    });
    const token = loginRes.body.token;

    // 2. Fetch /me
    const meRes = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/auth/me',
      token,
    });

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.phone).toBe('9820000001');
    expect(meRes.body.user.name).toBe('Neeraj Kulkarni');
  });

  it('rejects unauthenticated requests to /api/v1/auth/me with 401', async () => {
    const res = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/auth/me',
    });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Unauthorized');
  });
});
