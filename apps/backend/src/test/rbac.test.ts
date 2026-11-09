import { describe, it, expect, beforeAll } from 'vitest';
import { dispatchRequest } from './testHelper.js';

describe('Server-Side Role-Based Authorization & Flat Isolation', () => {
  let residentToken: string;
  let helpdeskToken: string;
  let accountsToken: string;
  let committeeToken: string;

  beforeAll(async () => {
    // 1. Resident (Neeraj Kulkarni, flat-t07-1203)
    const r1 = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9820000001', otp: '123456' },
    });
    residentToken = r1.body.token;

    // 2. Helpdesk (Ramesh Sawant)
    const r2 = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9876543210', otp: '123456' },
    });
    helpdeskToken = r2.body.token;

    // 3. Accounts (Pooja Mehta)
    const r3 = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9876543211', otp: '123456' },
    });
    accountsToken = r3.body.token;

    // 4. Committee (Dr. Vikram Deshmukh)
    const r4 = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9876543212', otp: '123456' },
    });
    committeeToken = r4.body.token;
  });

  it('prohibits resident from accessing restricted committee dashboard (403 Forbidden)', async () => {
    const res = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/dashboard/committee',
      token: residentToken,
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('prohibits helpdesk user from accessing committee financial dashboard (403 Forbidden)', async () => {
    const res = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/dashboard/committee',
      token: helpdeskToken,
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('prohibits resident from accessing another flat ledger (flat isolation check)', async () => {
    // Resident belongs to flat-t07-1203, attempting to read flat-t12-0408
    const res = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/ledger/flat-t12-0408',
      token: residentToken,
    });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('not authorized to access records for this flat');
  });

  it('allows resident to access their own flat ledger', async () => {
    const res = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/ledger/flat-t07-1203',
      token: residentToken,
    });

    expect(res.status).toBe(200);
    expect(res.body.flatId).toBe('flat-t07-1203');
  });

  it('allows committee secretary to access committee dashboard metrics', async () => {
    const res = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/dashboard/committee',
      token: committeeToken,
    });

    expect(res.status).toBe(200);
    expect(res.body.summary.totalApartments).toBe(2400);
    expect(res.body.summary.totalBilledPaise).toBe(1800000000);
  });

  it('allows accounts officer to access reconciliation queue', async () => {
    const res = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/reconciliation/queue',
      token: accountsToken,
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('queue');
  });
});
