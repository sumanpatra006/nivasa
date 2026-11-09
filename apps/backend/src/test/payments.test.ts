import { describe, it, expect, beforeAll } from 'vitest';
import { dispatchRequest } from './testHelper.js';

describe('Payment Processing & Ledger Updates', () => {
  let residentToken: string;

  beforeAll(async () => {
    const loginRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9820000001', otp: '123456' },
    });
    residentToken = loginRes.body.token;
  });

  it('initiates a payment and enforces idempotency', async () => {
    const idempotencyKey = `idemp-test-${Date.now()}`;

    // 1. Initial payment initiation
    const initRes1 = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      token: residentToken,
      body: {
        invoiceId: 'inv-t07-1203-202611',
        amountPaise: 747500,
        idempotencyKey,
      },
    });

    expect(initRes1.status).toBe(201);
    expect(initRes1.body.payment.idempotencyKey).toBe(idempotencyKey);
    expect(initRes1.body.payment.status).toBe('INITIATED');
    expect(initRes1.body.payment.amountPaise).toBe(747500);

    // 2. Replay with identical idempotencyKey
    const initRes2 = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      token: residentToken,
      body: {
        invoiceId: 'inv-t07-1203-202611',
        amountPaise: 747500,
        idempotencyKey,
      },
    });

    expect(initRes2.status).toBe(200);
    expect(initRes2.body.message).toContain('Idempotent replay');
    expect(initRes2.body.payment.id).toBe(initRes1.body.payment.id);
  });

  it('verifies payment, issues sequential receipt, and posts to flat ledger', async () => {
    const idempotencyKey = `idemp-verify-${Date.now()}`;

    // 1. Initiate
    await dispatchRequest({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      token: residentToken,
      body: {
        invoiceId: 'inv-t07-1203-202611',
        amountPaise: 747500,
        idempotencyKey,
      },
    });

    // 2. Check initial ledger balance
    const initialLedger = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/ledger/flat-t07-1203',
      token: residentToken,
    });
    const initialBalance = initialLedger.body.closingBalancePaise;

    // 3. Verify payment success
    const verifyRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/payments/verify',
      token: residentToken,
      body: {
        idempotencyKey,
        outcome: 'SUCCESS',
      },
    });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.payment.status).toBe('SUCCESS');
    expect(verifyRes.body.receipt).toHaveProperty('receiptNumber');
    expect(verifyRes.body.receipt.amountPaise).toBe(747500);

    // 4. Verify ledger now includes payment and closing balance decreased by 747500 paise
    const updatedLedger = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/ledger/flat-t07-1203',
      token: residentToken,
    });

    expect(updatedLedger.status).toBe(200);
    expect(updatedLedger.body.closingBalancePaise).toBe(initialBalance - 747500);
    const paymentEntry = updatedLedger.body.entries.find((e: any) => e.entryType === 'PAYMENT');
    expect(paymentEntry).toBeDefined();

    // 5. Re-verifying does NOT double-post to ledger
    const replayVerify = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/payments/verify',
      token: residentToken,
      body: {
        idempotencyKey,
        outcome: 'SUCCESS',
      },
    });
    expect(replayVerify.status).toBe(200);

    const recheckLedger = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/ledger/flat-t07-1203',
      token: residentToken,
    });
    expect(recheckLedger.body.closingBalancePaise).toBe(initialBalance - 747500);
  });
});
