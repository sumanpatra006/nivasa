import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchRequest } from './testHelper.js';
import { societyStore, getInitialSeedState } from '../modules/billing/societyStore.js';
import fs from 'fs';
import path from 'path';

describe('Financial Persistence Across Reloads', () => {
  let swatiToken: string;

  beforeEach(async () => {
    societyStore.reset();

    const loginRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9820000002', otp: '123456' }, // Swati Joshi
    });
    swatiToken = loginRes.body.token;
  });

  it('persists payment, receipt, and ledger entry to disk across process restarts', async () => {
    const invoiceId = 'inv-t12-0408-202611';
    const amountPaise = 699000;
    const idempotencyKey = `persist-test-${Date.now()}`;

    // 1. Initiate and complete payment
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
    expect(verifyRes.status).toBe(200);
    const receiptNumber = verifyRes.body.receipt.receiptNumber;

    // 2. Read directly from the persistent disk file: data/society_state.json
    const stateFilePath = path.resolve(process.cwd(), 'data', 'society_state.json');
    expect(fs.existsSync(stateFilePath)).toBe(true);

    const diskState = JSON.parse(fs.readFileSync(stateFilePath, 'utf-8'));

    // Check invoice on disk
    const diskInvoice = diskState.invoices.find((i: any) => i.id === invoiceId);
    expect(diskInvoice).toBeDefined();
    expect(diskInvoice.paidAmountPaise).toBe(amountPaise);
    expect(diskInvoice.remainingBalancePaise).toBe(0);
    expect(diskInvoice.status).toBe('PAID');

    // Check receipt on disk
    const diskReceipt = diskState.receipts.find((r: any) => r.receiptNumber === receiptNumber);
    expect(diskReceipt).toBeDefined();
    expect(diskReceipt.amountPaise).toBe(amountPaise);
    expect(diskReceipt.flatIdentifier).toBe('T12-0408');

    // Check ledger on disk
    const diskLedgerEntries = diskState.ledger.filter((e: any) => e.flatId === 'flat-t12-0408');
    const paymentEntry = diskLedgerEntries.find((e: any) => e.entryType === 'PAYMENT');
    expect(paymentEntry).toBeDefined();
    expect(paymentEntry.amountPaise).toBe(amountPaise);

    // 3. Simulate page reload by querying API endpoints fresh
    const reloadedBills = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/bills',
      token: swatiToken,
    });
    expect(reloadedBills.body.invoices[0].status).toBe('PAID');
    expect(reloadedBills.body.invoices[0].remainingBalancePaise).toBe(0);

    const reloadedLedger = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/ledger/flat-t12-0408',
      token: swatiToken,
    });
    expect(reloadedLedger.body.closingBalancePaise).toBe(0);
  });
});
