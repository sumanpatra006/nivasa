import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { parseBankCsv, tokenizeCsvLine } from '../modules/reconciliation/csvParser.js';
import { matchTransaction, CandidateInvoice } from '../modules/reconciliation/reconciliationEngine.js';
import { dispatchRequest } from './testHelper.js';
import { societyStore } from '../modules/billing/societyStore.js';

describe('Bank Statement Reconciliation Engine & Workflows', () => {
  let accountsToken: string;

  const sampleCandidateInvoices: CandidateInvoice[] = [
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
      totalAmountPaise: 699000,
      paidAmountPaise: 0,
      balancePaise: 699000,
      dueDate: '2026-09-24T00:00:00Z',
      status: 'OVERDUE',
    },
    {
      id: 'inv-t21-1601-202611',
      flatId: 'flat-t21-1601',
      tower: 'T21',
      flatNumber: '1601',
      residentName: 'Aamir Shaikh',
      residentUpi: null,
      totalAmountPaise: 1099000,
      paidAmountPaise: 500000,
      balancePaise: 599000,
      dueDate: '2026-10-23T00:00:00Z',
      status: 'PARTIALLY_PAID',
    },
  ];

  beforeAll(async () => {
    const loginRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9876543211', otp: '123456' }, // Accounts Officer Pooja Mehta
    });
    accountsToken = loginRes.body.token;
  });

  beforeEach(() => {
    societyStore.reset();
  });

  // TEST 1: Exact reference and flat match
  it('identifies exact reference and flat code match with high confidence as SUGGESTED', () => {
    const txn = {
      id: 'txn-exact-1',
      rowNumber: 2,
      rawRow: '2026-11-02,7475.00,UPI-T07-1203-REF,neeraj@oksbi,Maintenance payment T07-1203 Neeraj Kulkarni',
      transactionDate: '2026-11-02T10:15:00.000Z',
      amountPaise: 747500,
      reference: 'UPI-T07-1203-REF',
      upiId: 'neeraj@oksbi',
      description: 'Maintenance payment T07-1203 Neeraj Kulkarni',
      isDuplicateInBatch: false,
    };

    const result = matchTransaction(txn, sampleCandidateInvoices);
    expect(result.status).toBe('SUGGESTED');
    expect(result.suggestedMatch?.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.suggestedMatch?.flatIdentifier).toBe('T07-1203');
    expect(result.suggestedMatch?.matchingReasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Exact flat code "T07-1203"'),
        expect.stringContaining('Exact amount match: ₹7475.00'),
        expect.stringContaining('Resident name "Neeraj Kulkarni"'),
      ])
    );
  });

  // TEST 2: UPI Match
  it('incorporates registered resident UPI match into confidence score', () => {
    const txn = {
      id: 'txn-upi-1',
      rowNumber: 2,
      rawRow: '2026-11-02,7475.00,UPI99401,neeraj@oksbi,Online Transfer',
      transactionDate: '2026-11-02T10:15:00.000Z',
      amountPaise: 747500,
      reference: 'UPI99401',
      upiId: 'neeraj@oksbi',
      description: 'Online Transfer',
      isDuplicateInBatch: false,
    };

    const result = matchTransaction(txn, sampleCandidateInvoices);
    const reasons = result.suggestedMatch?.matchingReasons || [];
    expect(reasons).toEqual(expect.arrayContaining([expect.stringContaining('Registered resident UPI ID match')]));
  });

  // TEST 3: Amount-only match (CRITICAL RULE: MUST NOT auto-match on amount alone!)
  it('does NOT suggest or match based on amount alone (confidence <= 0.25, UNMATCHED)', () => {
    const txn = {
      id: 'txn-amt-only',
      rowNumber: 3,
      rawRow: '2026-11-02,7475.00,IMPS-UNKNOWN,,Direct transfer',
      transactionDate: '2026-11-02T10:15:00.000Z',
      amountPaise: 747500,
      reference: 'IMPS-UNKNOWN',
      upiId: null,
      description: 'Direct deposit without flat or resident info',
      isDuplicateInBatch: false,
    };

    const result = matchTransaction(txn, sampleCandidateInvoices);
    // Amount match alone gives 25 points -> confidence 0.25 -> UNMATCHED!
    expect(result.status).toBe('UNMATCHED');
    expect(result.suggestedMatch?.confidence || 0).toBeLessThanOrEqual(0.3);
  });

  // TEST 4: Wrong amount
  it('flags missing amount match in missingEvidence when amount differs from balance', () => {
    const txn = {
      id: 'txn-wrong-amt',
      rowNumber: 4,
      rawRow: '2026-11-03,1000.00,UPI-T07-1203,neeraj@oksbi,Partial token',
      transactionDate: '2026-11-03T10:00:00.000Z',
      amountPaise: 100000, // ₹1,000 instead of ₹7,475
      reference: 'UPI-T07-1203',
      upiId: 'neeraj@oksbi',
      description: 'Partial token payment',
      isDuplicateInBatch: false,
    };

    const result = matchTransaction(txn, sampleCandidateInvoices);
    const missing = result.suggestedMatch?.missingEvidence || [];
    expect(missing).toEqual(
      expect.arrayContaining([expect.stringContaining('does not match balance')])
    );
  });

  // TEST 5: Partial payment
  it('handles partial payment against outstanding balance and routes to review if uncertain', () => {
    const txn = {
      id: 'txn-partial',
      rowNumber: 5,
      rawRow: '2026-11-03,3000.00,NEFT-SWATI,,Swati rent advance',
      transactionDate: '2026-11-03T10:00:00.000Z',
      amountPaise: 300000,
      reference: 'NEFT-SWATI',
      upiId: null,
      description: 'Swati rent advance',
      isDuplicateInBatch: false,
    };

    const result = matchTransaction(txn, sampleCandidateInvoices);
    // Matches Swati's name (+20 pts) but not amount or flat -> needs review / partial
    expect(['NEEDS_REVIEW', 'UNMATCHED']).toContain(result.status);
  });

  // TEST 6: Missing invoice (Unmatched)
  it('returns UNMATCHED when narration refers to a non-existent flat', () => {
    const txn = {
      id: 'txn-missing-inv',
      rowNumber: 6,
      rawRow: '2026-11-03,5000.00,IMPS-T99-9999,,Payment for Tower 99 Flat 9999',
      transactionDate: '2026-11-03T10:00:00.000Z',
      amountPaise: 500000,
      reference: 'IMPS-T99-9999',
      upiId: null,
      description: 'Payment for Tower 99 Flat 9999',
      isDuplicateInBatch: false,
    };

    const result = matchTransaction(txn, sampleCandidateInvoices);
    expect(result.status).toBe('UNMATCHED');
  });

  // TEST 7: Duplicate transaction within batch or system
  it('marks duplicate transaction reference as DUPLICATE', () => {
    const knownRefs = new Set(['DUPLICATE-UTR-001']);
    const txn = {
      id: 'txn-dup',
      rowNumber: 7,
      rawRow: '2026-11-04,7475.00,DUPLICATE-UTR-001,,Re-transmitted batch row',
      transactionDate: '2026-11-04T10:00:00.000Z',
      amountPaise: 747500,
      reference: 'DUPLICATE-UTR-001',
      upiId: null,
      description: 'Re-transmitted batch row',
      isDuplicateInBatch: true,
    };

    const result = matchTransaction(txn, sampleCandidateInvoices, knownRefs);
    expect(result.status).toBe('DUPLICATE');
    expect(result.suggestedMatch).toBeNull();
  });

  // TEST 8: Duplicate CSV import detection (SHA-256 hash collision)
  it('rejects duplicate file upload with 409 Conflict', async () => {
    const sampleCsv = `Date,Amount,Reference,UPI ID,Description\n2026-11-02,7475.00,UPI-UNIQUE-001,neeraj@oksbi,Maintenance payment for T07-1203 Neeraj Kulkarni`;

    // 1. Initial upload
    const uploadRes1 = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/reconciliation/upload',
      token: accountsToken,
      body: { csvContent: sampleCsv, filename: 'statement_nov.csv' },
    });
    expect(uploadRes1.status).toBe(201);

    // 2. Duplicate upload of identical file content
    const uploadRes2 = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/reconciliation/upload',
      token: accountsToken,
      body: { csvContent: sampleCsv, filename: 'statement_nov_copy.csv' },
    });
    expect(uploadRes2.status).toBe(409);
    expect(uploadRes2.body.error).toBe('Duplicate Import');
  });

  // TEST 9: Ambiguous candidate detection
  it('flags transaction matching multiple flats with identical score as NEEDS_REVIEW with isAmbiguous: true', () => {
    // Two flats with identical billing amount (e.g. ₹6,370)
    const competingInvoices: CandidateInvoice[] = [
      {
        id: 'inv-1',
        flatId: 'flat-1',
        tower: 'T01',
        flatNumber: '101',
        residentName: 'Sunil Sharma',
        totalAmountPaise: 637000,
        paidAmountPaise: 0,
        balancePaise: 637000,
        dueDate: '2026-11-10T00:00:00Z',
        status: 'ISSUED',
      },
      {
        id: 'inv-2',
        flatId: 'flat-2',
        tower: 'T02',
        flatNumber: '201',
        residentName: 'Anil Sharma',
        totalAmountPaise: 637000,
        paidAmountPaise: 0,
        balancePaise: 637000,
        dueDate: '2026-11-10T00:00:00Z',
        status: 'ISSUED',
      },
    ];

    const txn = {
      id: 'txn-ambiguous',
      rowNumber: 8,
      rawRow: '2026-11-02,6370.00,NEFT-SHARMA,,Sharma maintenance',
      transactionDate: '2026-11-02T10:00:00.000Z',
      amountPaise: 637000,
      reference: 'NEFT-SHARMA',
      upiId: null,
      description: 'Sharma maintenance', // Matches both Suni Sharma and Anil Sharma equally
      isDuplicateInBatch: false,
    };

    const result = matchTransaction(txn, competingInvoices);
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.isAmbiguous).toBe(true);
  });

  // TEST 10: Manual selection and confirmation
  it('allows accounts staff to manually select target invoice, confirm match, and update ledger', async () => {
    // 1. Upload statement with Swati's ambiguous row
    const csv = `Date,Amount,Reference,UPI ID,Description\n2026-11-03,6370.00,NEFT-MANUAL-01,,Transfer for rent/maint`;
    const uploadRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/reconciliation/upload',
      token: accountsToken,
      body: { csvContent: csv },
    });
    expect(uploadRes.status).toBe(201);
    const txn = uploadRes.body.reconciledQueue[0];

    // 2. Check initial ledger of Flat T12-0408
    const ledgerBefore = societyStore.getLedger('flat-t12-0408');
    const balanceBefore = ledgerBefore.reduce(
      (acc, c) => (c.entryType === 'BILL' || c.entryType === 'LATE_FEE' ? acc + c.amountPaise : acc - c.amountPaise),
      0
    );

    // 3. Confirm with explicit invoice selection (inv-t12-0408-202611)
    const encodedId = encodeURIComponent(txn.id);
    const confirmRes = await dispatchRequest({
      method: 'POST',
      url: `/api/v1/reconciliation/transactions/${encodedId}/confirm`,
      token: accountsToken,
      body: { invoiceId: 'inv-t12-0408-202611' },
    });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.transaction.status).toBe('POSTED');
    expect(confirmRes.body.receipt.receiptNumber).toMatch(/^REC-202611-\d{4}$/);

    // 4. Verify flat ledger was credited by 637,000 paise
    const ledgerAfter = societyStore.getLedger('flat-t12-0408');
    const balanceAfter = ledgerAfter.reduce(
      (acc, c) => (c.entryType === 'BILL' || c.entryType === 'LATE_FEE' ? acc + c.amountPaise : acc - c.amountPaise),
      0
    );
    expect(balanceAfter).toBe(balanceBefore - 637000);
  });

  // TEST 11: Rejected transaction
  it('allows accounts staff to reject a suggestion and records the rejection reason', async () => {
    const csv = `Date,Amount,Reference,UPI ID,Description\n2026-11-03,5000.00,IMPS-REJECT-01,,Deposit`;
    const uploadRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/reconciliation/upload',
      token: accountsToken,
      body: { csvContent: csv },
    });
    const txn = uploadRes.body.reconciledQueue[0];

    const rejectRes = await dispatchRequest({
      method: 'POST',
      url: `/api/v1/reconciliation/transactions/${encodeURIComponent(txn.id)}/reject`,
      token: accountsToken,
      body: { reason: 'Commercial shop deposit, not residential flat dues' },
    });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.transaction.status).toBe('REJECTED');
    expect(rejectRes.body.transaction.rejectionReason).toContain('Commercial shop deposit');
  });

  // TEST 12: Double posting prevention
  it('prevents posting the same transaction twice (Double Posting Error)', async () => {
    const csv = `Date,Amount,Reference,UPI ID,Description\n2026-11-03,6370.00,NEFT-DOUBLE-POST,,Swati Joshi`;
    const uploadRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/reconciliation/upload',
      token: accountsToken,
      body: { csvContent: csv },
    });
    const txn = uploadRes.body.reconciledQueue[0];

    // First confirm
    const confirm1 = await dispatchRequest({
      method: 'POST',
      url: `/api/v1/reconciliation/transactions/${encodeURIComponent(txn.id)}/confirm`,
      token: accountsToken,
      body: { invoiceId: 'inv-t12-0408-202611' },
    });
    expect(confirm1.status).toBe(200);

    // Second confirm attempt
    const confirm2 = await dispatchRequest({
      method: 'POST',
      url: `/api/v1/reconciliation/transactions/${encodeURIComponent(txn.id)}/confirm`,
      token: accountsToken,
      body: { invoiceId: 'inv-t12-0408-202611' },
    });
    expect(confirm2.status).toBe(400);
    expect(confirm2.body.error).toBe('Double Posting Error');
  });

  // TEST 13: Transaction rollback / validation error abort
  it('aborts posting and leaves ledger unchanged if target invoice is invalid', async () => {
    const csv = `Date,Amount,Reference,UPI ID,Description\n2026-11-03,6370.00,NEFT-ROLLBACK-01,,Deposit`;
    const uploadRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/reconciliation/upload',
      token: accountsToken,
      body: { csvContent: csv },
    });
    const txn = uploadRes.body.reconciledQueue[0];

    const initialLedgerCount = societyStore.getLedger('flat-t12-0408').length;

    const invalidConfirm = await dispatchRequest({
      method: 'POST',
      url: `/api/v1/reconciliation/transactions/${encodeURIComponent(txn.id)}/confirm`,
      token: accountsToken,
      body: { invoiceId: 'inv-nonexistent-999' },
    });

    expect(invalidConfirm.status).toBe(400);
    expect(societyStore.getLedger('flat-t12-0408').length).toBe(initialLedgerCount);
  });
});
