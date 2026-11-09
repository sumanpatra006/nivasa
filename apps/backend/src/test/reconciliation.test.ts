import { describe, it, expect } from 'vitest';
import { parseBankCsv, tokenizeCsvLine } from '../modules/reconciliation/csvParser.js';
import { matchTransaction, CandidateInvoice } from '../modules/reconciliation/reconciliationEngine.js';
import { dispatchRequest } from './testHelper.js';

describe('Bank Statement CSV & Reconciliation Engine', () => {
  const sampleInvoices: CandidateInvoice[] = [
    {
      id: 'inv-t07-1203-202611',
      flatId: 'flat-t07-1203',
      tower: 'T07',
      flatNumber: '1203',
      residentName: 'Neeraj Kulkarni',
      residentUpi: 'neeraj@oksbi',
      totalAmountPaise: 747500,
      paidAmountPaise: 0,
      balancePaise: 747500,
      dueDate: '2026-11-10T00:00:00Z',
      status: 'ISSUED',
    },
    {
      id: 'inv-t12-0408-202611',
      flatId: 'flat-t12-0408',
      tower: 'T12',
      flatNumber: '0408',
      residentName: 'Swati Joshi',
      residentUpi: null,
      totalAmountPaise: 637000,
      paidAmountPaise: 0,
      balancePaise: 637000,
      dueDate: '2026-09-24T00:00:00Z',
      status: 'OVERDUE',
    },
  ];

  it('tokenizes RFC 4180 CSV line with quotes and commas accurately', () => {
    const line = '2026-11-02,"7,475.00",UPI123,"neeraj@oksbi","Maintenance T07-1203, Neeraj"';
    const tokens = tokenizeCsvLine(line);
    expect(tokens.length).toBe(5);
    expect(tokens[1]).toBe('7,475.00');
    expect(tokens[4]).toBe('Maintenance T07-1203, Neeraj');
  });

  it('parses CSV and converts amounts into integer paise', () => {
    const csv = `Date,Amount,Reference,UPI ID,Description\n2026-11-02,7475.00,UPI20261102001,neeraj@oksbi,Maintenance payment for T07-1203\n2026-11-03,6370.00,NEFT002,,Swati Joshi rent`;
    const res = parseBankCsv(csv);

    expect(res.success).toBe(true);
    expect(res.transactions.length).toBe(2);
    expect(res.transactions[0].amountPaise).toBe(747500);
    expect(res.transactions[0].reference).toBe('UPI20261102001');
    expect(res.transactions[1].amountPaise).toBe(637000);
  });

  it('generates high confidence explainable match for unambiguous transaction', () => {
    const txn = {
      rowNumber: 2,
      rawRow: '...',
      transactionDate: '2026-11-02T10:00:00Z',
      amountPaise: 747500,
      reference: 'UPI/1203/NEERAJKULKARNI',
      upiId: 'neeraj@oksbi',
      description: 'Monthly Maintenance T07-1203',
      isDuplicateInBatch: false,
    };

    const result = matchTransaction(txn, sampleInvoices);
    expect(result.status).toBe('SUGGESTED');
    expect(result.isAmbiguous).toBe(false);
    expect(result.suggestedMatch).toBeDefined();
    expect(result.suggestedMatch!.flatIdentifier).toBe('T07-1203');
    expect(result.suggestedMatch!.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.suggestedMatch!.matchingReasons.length).toBeGreaterThanOrEqual(3);
  });

  it('flags ambiguous transaction as NEEDS_REVIEW instead of auto-matching', () => {
    const txn = {
      rowNumber: 3,
      rawRow: '...',
      transactionDate: '2026-11-03T10:00:00Z',
      amountPaise: 637000,
      reference: 'NEFT-TRANSFER-001',
      upiId: null,
      description: 'Transfer Swati payment', // Matches name and amount, but missing exact flat code
      isDuplicateInBatch: false,
    };

    const result = matchTransaction(txn, sampleInvoices);
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.isAmbiguous).toBe(true);
  });

  it('marks duplicate transaction reference as DUPLICATE', () => {
    const knownRefs = new Set(['UPI20261102001']);
    const txn = {
      rowNumber: 4,
      rawRow: '...',
      transactionDate: '2026-11-04T10:00:00Z',
      amountPaise: 747500,
      reference: 'UPI20261102001',
      upiId: null,
      description: 'Duplicate transmission',
      isDuplicateInBatch: false,
    };

    const result = matchTransaction(txn, sampleInvoices, knownRefs);
    expect(result.status).toBe('DUPLICATE');
    expect(result.suggestedMatch).toBeNull();
  });

  it('allows accounts officer to confirm and post transaction to flat ledger via API', async () => {
    // 1. Login as Accounts
    const loginRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9876543211', otp: '123456' },
    });
    const accountsToken = loginRes.body.token;

    // 2. Fetch active reconciliation queue
    const queueRes = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/reconciliation/queue',
      token: accountsToken,
    });
    expect(queueRes.status).toBe(200);
    const suggestedTxn = queueRes.body.queue.find((t: any) => t.status === 'SUGGESTED');
    expect(suggestedTxn).toBeDefined();

    // 3. Confirm and post
    const encodedRef = encodeURIComponent(suggestedTxn.transaction.reference);
    const confirmRes = await dispatchRequest({
      method: 'POST',
      url: `/api/v1/reconciliation/transactions/${encodedRef}/confirm`,
      token: accountsToken,
    });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.message).toContain('confirmed and posted');
    expect(confirmRes.body.reconciledTransaction.status).toBe('POSTED');
  });
});
