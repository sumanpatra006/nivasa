import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { dispatchRequest } from './testHelper.js';
import { societyStore } from '../modules/billing/societyStore.js';

describe('Payment Processing & Ledger Updates', () => {
  let neerajToken: string; // Flat T07-1203
  let swatiToken: string;  // Flat T12-0408 (Tenant)
  let aamirToken: string;  // Flat T21-1601

  beforeAll(async () => {
    // Resident 1: Neeraj Kulkarni (Flat T07-1203)
    const r1 = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9820000001', otp: '123456' },
    });
    neerajToken = r1.body.token;

    // Resident 2: Swati Joshi (Flat T12-0408)
    const r2 = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9820000002', otp: '123456' },
    });
    swatiToken = r2.body.token;

    // Resident 3: Aamir Shaikh (Flat T21-1601)
    const r3 = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9820000003', otp: '123456' },
    });
    aamirToken = r3.body.token;
  });

  beforeEach(() => {
    // Reset store before each test to guarantee isolated test fixtures
    societyStore.reset();
  });

  // TEST 1: Full Payment Flow
  it('executes a full payment, sets invoice status to PAID, generates receipt, and updates ledger', async () => {
    // Swati Joshi (Flat T12-0408) has total due: 699,000 paise (₹6,370 base + ₹620 late fee)
    const invoiceId = 'inv-t12-0408-202611';
    const amountPaise = 699000;
    const idempotencyKey = `full-pay-${Date.now()}`;

    // 1. Initiate full payment
    const initRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      token: swatiToken,
      body: { invoiceId, amountPaise, idempotencyKey },
    });
    expect(initRes.status).toBe(201);
    expect(initRes.body.payment.status).toBe('INITIATED');

    // 2. Verify payment success
    const verifyRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/payments/verify',
      token: swatiToken,
      body: { idempotencyKey, outcome: 'SUCCESS' },
    });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.payment.status).toBe('SUCCESS');
    expect(verifyRes.body.receipt).toBeDefined();
    expect(verifyRes.body.receipt.receiptNumber).toMatch(/^REC-202611-\d{4}$/);
    expect(verifyRes.body.receipt.amountPaise).toBe(amountPaise);
    expect(verifyRes.body.receipt.flatIdentifier).toBe('T12-0408');

    // 3. Invoice balance updated
    expect(verifyRes.body.invoice.paidAmountPaise).toBe(amountPaise);
    expect(verifyRes.body.invoice.remainingBalancePaise).toBe(0);
    expect(verifyRes.body.invoice.status).toBe('PAID');

    // 4. Ledger reflects payment and closing balance becomes 0
    const ledgerRes = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/ledger/flat-t12-0408',
      token: swatiToken,
    });
    expect(ledgerRes.status).toBe(200);
    expect(ledgerRes.body.closingBalancePaise).toBe(0);
  });

  // TEST 2: Partial Payment Flow
  it('executes a partial payment, updates invoice to PARTIALLY_PAID with remaining balance', async () => {
    // Swati Joshi pays ₹3,000 (300,000 paise) against 699,000 paise
    const invoiceId = 'inv-t12-0408-202611';
    const amountPaise = 300000;
    const idempotencyKey = `partial-pay-${Date.now()}`;

    // 1. Initiate partial payment
    const initRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      token: swatiToken,
      body: { invoiceId, amountPaise, idempotencyKey },
    });
    expect(initRes.status).toBe(201);

    // 2. Verify payment
    const verifyRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/payments/verify',
      token: swatiToken,
      body: { idempotencyKey, outcome: 'SUCCESS' },
    });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.invoice.status).toBe('PARTIALLY_PAID');
    expect(verifyRes.body.invoice.paidAmountPaise).toBe(300000);
    expect(verifyRes.body.invoice.remainingBalancePaise).toBe(399000);

    // 3. Ledger closing balance reflects remaining 399,000 paise
    const ledgerRes = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/ledger/flat-t12-0408',
      token: swatiToken,
    });
    expect(ledgerRes.body.closingBalancePaise).toBe(399000);
  });

  // TEST 3: Failed Payment Flow
  it('handles deterministic gateway failure without modifying invoice balance or posting to ledger', async () => {
    const invoiceId = 'inv-t12-0408-202611';
    const amountPaise = 200000;
    const idempotencyKey = `fail-pay-${Date.now()}`;

    // 1. Initiate
    await dispatchRequest({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      token: swatiToken,
      body: { invoiceId, amountPaise, idempotencyKey },
    });

    // 2. Check initial ledger
    const ledgerBefore = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/ledger/flat-t12-0408',
      token: swatiToken,
    });
    const balanceBefore = ledgerBefore.body.closingBalancePaise;

    // 3. Simulate failure outcome
    const failRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/payments/verify',
      token: swatiToken,
      body: { idempotencyKey, outcome: 'FAILED' },
    });
    expect(failRes.status).toBe(200);
    expect(failRes.body.payment.status).toBe('FAILED');
    expect(failRes.body.receipt).toBeNull();

    // 4. Ledger and invoice balance remain unchanged
    const ledgerAfter = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/ledger/flat-t12-0408',
      token: swatiToken,
    });
    expect(ledgerAfter.body.closingBalancePaise).toBe(balanceBefore);

    const inv = societyStore.getInvoiceById(invoiceId);
    expect(inv?.paidAmountPaise).toBe(0);
  });

  // TEST 4: Duplicate Payment Request (Idempotency)
  it('enforces idempotency and prevents duplicate payments or duplicate ledger entries', async () => {
    const invoiceId = 'inv-t21-1601-202611';
    const amountPaise = 100000;
    const idempotencyKey = `dup-check-${Date.now()}`;

    // 1. Initial Initiate
    const init1 = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      token: aamirToken,
      body: { invoiceId, amountPaise, idempotencyKey },
    });
    expect(init1.status).toBe(201);

    // 2. Duplicate Initiate with same key
    const init2 = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      token: aamirToken,
      body: { invoiceId, amountPaise, idempotencyKey },
    });
    expect(init2.status).toBe(200);
    expect(init2.body.message).toContain('Idempotent replay');
    expect(init2.body.payment.id).toBe(init1.body.payment.id);

    // 3. Initial Verify
    const verify1 = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/payments/verify',
      token: aamirToken,
      body: { idempotencyKey, outcome: 'SUCCESS' },
    });
    expect(verify1.status).toBe(200);

    const ledgerAfterFirst = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/ledger/flat-t21-1601',
      token: aamirToken,
    });
    const balanceAfterFirst = ledgerAfterFirst.body.closingBalancePaise;

    // 4. Duplicate Verify with same key
    const verify2 = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/payments/verify',
      token: aamirToken,
      body: { idempotencyKey, outcome: 'SUCCESS' },
    });
    expect(verify2.status).toBe(200);
    expect(verify2.body.message).toContain('idempotent replay');
    expect(verify2.body.receipt.id).toBe(verify1.body.receipt.id);

    // Ledger balance must NOT decrease a second time
    const ledgerAfterSecond = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/ledger/flat-t21-1601',
      token: aamirToken,
    });
    expect(ledgerAfterSecond.body.closingBalancePaise).toBe(balanceAfterFirst);
  });

  // TEST 5: Unauthorized Flat Check
  it('rejects payment initiation for an unauthorized flat (403 Forbidden)', async () => {
    // Neeraj Kulkarni (Flat T07-1203) tries to initiate payment on Swati Joshi's invoice (Flat T12-0408)
    const res = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      token: neerajToken,
      body: {
        invoiceId: 'inv-t12-0408-202611',
        amountPaise: 100000,
        idempotencyKey: `unauth-test-${Date.now()}`,
      },
    });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Unauthorized');
  });

  // TEST 6: Invalid Invoice ID Check
  it('returns 404 Not Found for non-existent invoice ID', async () => {
    const res = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      token: neerajToken,
      body: {
        invoiceId: 'inv-nonexistent-999',
        amountPaise: 50000,
        idempotencyKey: `invalid-inv-${Date.now()}`,
      },
    });

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('not found');
  });

  // TEST 7: Incorrect Amount Validation
  it('rejects non-positive payment amounts (400 Bad Request)', async () => {
    const res = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      token: swatiToken,
      body: {
        invoiceId: 'inv-t12-0408-202611',
        amountPaise: 0,
        idempotencyKey: `zero-amt-${Date.now()}`,
      },
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('positive integer in paise');
  });

  it('rejects payment amount exceeding remaining invoice balance (400 Bad Request)', async () => {
    // Swati has 699,000 paise remaining; attempting to pay 1,000,000 paise
    const res = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      token: swatiToken,
      body: {
        invoiceId: 'inv-t12-0408-202611',
        amountPaise: 1000000,
        idempotencyKey: `excess-amt-${Date.now()}`,
      },
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('exceeds remaining invoice balance');
  });

  // TEST 8: Receipt Generation & Query
  it('generates a compliant official receipt with required fields and allows querying', async () => {
    const invoiceId = 'inv-t12-0408-202611';
    const amountPaise = 500000;
    const idempotencyKey = `rec-gen-${Date.now()}`;

    await dispatchRequest({
      method: 'POST',
      url: '/api/v1/payments/initiate',
      token: swatiToken,
      body: { invoiceId, amountPaise, idempotencyKey },
    });

    const verifyRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/payments/verify',
      token: swatiToken,
      body: { idempotencyKey, outcome: 'SUCCESS' },
    });

    const receipt = verifyRes.body.receipt;
    expect(receipt).toHaveProperty('receiptNumber');
    expect(receipt).toHaveProperty('flatIdentifier', 'T12-0408');
    expect(receipt).toHaveProperty('billingPeriod', 'November 2026');
    expect(receipt).toHaveProperty('amountPaise', 500000);
    expect(receipt).toHaveProperty('paymentReference');
    expect(receipt).toHaveProperty('date');

    // Query receipt by ID
    const queryRes = await dispatchRequest({
      method: 'GET',
      url: `/api/v1/payments/receipts/${receipt.id}`,
      token: swatiToken,
    });
    expect(queryRes.status).toBe(200);
    expect(queryRes.body.receipt.id).toBe(receipt.id);
  });
});
