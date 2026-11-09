import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { dispatchRequest } from './testHelper.js';
import { societyStore } from '../modules/billing/societyStore.js';
import { COMPLAINT_STATUS } from '@nivasa/shared';

describe('Committee Oversight Dashboard & Reporting', () => {
  let committeeToken: string; // Dr. Vikram Deshmukh (Secretary)
  let accountsToken: string; // Pooja Mehta (Accounts)
  let helpdeskToken: string; // Ramesh Sawant (Helpdesk)
  let residentToken: string; // Neeraj Kulkarni (Resident)

  beforeAll(async () => {
    // 1. Committee user
    const commRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9876543212', otp: '123456' },
    });
    committeeToken = commRes.body.token;

    // 2. Accounts user
    const accRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9876543211', otp: '123456' },
    });
    accountsToken = accRes.body.token;

    // 3. Helpdesk user
    const hdRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9876543210', otp: '123456' },
    });
    helpdeskToken = hdRes.body.token;

    // 4. Resident user
    const resRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9820000001', otp: '123456' },
    });
    residentToken = resRes.body.token;
  });

  beforeEach(() => {
    societyStore.reset();
  });

  it('Access Control: restricts committee reports to COMMITTEE and ACCOUNTS roles, rejecting HELPDESK and RESIDENT', async () => {
    // 1. Unauthenticated request -> 401
    const unauth = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/dashboard/committee',
    });
    expect(unauth.status).toBe(401);

    // 2. Helpdesk staff accessing committee dashboard -> 403 Forbidden
    const hdAccess = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/dashboard/committee',
      token: helpdeskToken,
    });
    expect(hdAccess.status).toBe(403);
    expect(hdAccess.body.error).toBe('Forbidden');

    // 3. Resident accessing committee dashboard -> 403 Forbidden
    const resAccess = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/dashboard/committee',
      token: residentToken,
    });
    expect(resAccess.status).toBe(403);

    // 4. Committee member accessing -> 200 OK
    const commAccess = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/dashboard/committee',
      token: committeeToken,
    });
    expect(commAccess.status).toBe(200);

    // 5. Accounts officer accessing -> 200 OK
    const accAccess = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/dashboard/committee',
      token: accountsToken,
    });
    expect(accAccess.status).toBe(200);
  });

  it('Collection Aggregation: accurately derives billed, collected, outstanding, and efficiency percentage from database invoices', async () => {
    const res = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/dashboard/committee',
      token: committeeToken,
    });
    expect(res.status).toBe(200);

    const invoices = societyStore.getInvoices();
    const expectedBilled = invoices.reduce((sum, i) => sum + i.totalAmountPaise, 0);
    const expectedCollected = invoices.reduce((sum, i) => sum + i.paidAmountPaise, 0);
    const expectedOutstanding = invoices.reduce((sum, i) => sum + i.remainingBalancePaise, 0);
    const expectedEfficiency = Math.round((expectedCollected / expectedBilled) * 1000) / 10;

    const { financialMetrics } = res.body;
    expect(financialMetrics.totalBilledPaise).toBe(expectedBilled);
    expect(financialMetrics.totalCollectedPaise).toBe(expectedCollected);
    expect(financialMetrics.outstandingBalancePaise).toBe(expectedOutstanding);
    expect(financialMetrics.collectionPercentage).toBe(expectedEfficiency);
    expect(financialMetrics.invoicesCount).toBe(invoices.length);

    // Verify mathematical integrity: billed - collected = outstanding
    expect(financialMetrics.totalBilledPaise - financialMetrics.totalCollectedPaise).toBe(
      financialMetrics.outstandingBalancePaise
    );
  });

  it('Dues Ageing: correctly categorizes outstanding dues into 5 configurable ageing buckets', async () => {
    const res = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/dashboard/committee',
      token: committeeToken,
    });
    expect(res.status).toBe(200);

    const { duesAgeing } = res.body;
    expect(duesAgeing.buckets).toHaveLength(5);

    const bucketKeys = duesAgeing.buckets.map((b: any) => b.key);
    expect(bucketKeys).toEqual(['CURRENT', 'DAYS_1_30', 'DAYS_31_60', 'DAYS_61_90', 'DAYS_90_PLUS']);

    // In initial seed state:
    // Flat T07-1203: 0 days overdue (Paid) -> Balance 0
    // Flat T21-1601: 18 days overdue -> DAYS_1_30 (Balance 599,000 paise)
    // Flat T12-0408: 47 days overdue -> DAYS_31_60 (Balance 699,000 paise)
    const b1To30 = duesAgeing.buckets.find((b: any) => b.key === 'DAYS_1_30');
    expect(b1To30.count).toBe(1);
    expect(b1To30.amountPaise).toBe(599000);

    const b31To60 = duesAgeing.buckets.find((b: any) => b.key === 'DAYS_31_60');
    expect(b31To60.count).toBe(1);
    expect(b31To60.amountPaise).toBe(699000);

    // Sum of all bucket amounts must equal totalOutstandingPaise
    const sumBuckets = duesAgeing.buckets.reduce((sum: number, b: any) => sum + b.amountPaise, 0);
    expect(sumBuckets).toBe(duesAgeing.totalOutstandingPaise);

    // Sum of percentages must equal 100% (within rounding)
    const sumPct = duesAgeing.buckets.reduce((sum: number, b: any) => sum + b.percentageOfOutstanding, 0);
    expect(Math.round(sumPct)).toBe(100);
  });

  it('Flat-Level Outstanding Accounts: provides accurate line-item details sorted by outstanding balance', async () => {
    const res = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/dashboard/committee',
      token: committeeToken,
    });
    expect(res.status).toBe(200);

    const { flatOutstandingAccounts } = res.body;
    expect(flatOutstandingAccounts.length).toBeGreaterThan(0);

    // Verify sorted descending by balance
    for (let i = 0; i < flatOutstandingAccounts.length - 1; i++) {
      expect(flatOutstandingAccounts[i].outstandingBalancePaise).toBeGreaterThanOrEqual(
        flatOutstandingAccounts[i + 1].outstandingBalancePaise
      );
    }

    const first = flatOutstandingAccounts[0];
    expect(first.flatId).toBeDefined();
    expect(first.tower).toBeDefined();
    expect(first.residentName).toBeDefined();
    expect(first.outstandingBalancePaise).toBeGreaterThan(0);
    expect(first.daysOverdue).toBeDefined();
    expect(first.ageingBucket).toBeDefined();
  });

  it('Complaint Metrics: accurately derives response time, resolution time, and reopened rate from persisted tickets', async () => {
    // Add a resolved ticket and a reopened ticket to test calculations
    const c1 = societyStore.addComplaint({
      id: `cmp-metric-1`,
      residentId: 'user-9820000001',
      residentName: 'Neeraj Kulkarni',
      flatId: 'flat-t07-1203',
      tower: 'T07',
      flatNumber: '1203',
      title: 'Hall fan regulator broken',
      description: 'Regulator knob fell off.',
      category: 'ELECTRICAL',
      urgency: 'NORMAL',
      status: COMPLAINT_STATUS.RESOLVED,
      assignedTo: 'Electrical Team',
      dutyManagerAlerted: false,
      isSafetyEscalation: false,
      isAiFallback: true,
      duplicateLinks: [],
      duplicateSuggestions: [],
      reopenCount: 1, // Reopened
      createdAt: '2026-11-01T10:00:00Z',
      updatedAt: '2026-11-01T14:00:00Z',
      resolvedAt: '2026-11-01T14:00:00Z', // 4 hours resolution
      timeline: [
        { id: 't1', message: 'Registered', actor: 'Neeraj Kulkarni', createdAt: '2026-11-01T10:00:00Z' },
        { id: 't2', message: 'Assigned to tech', actor: 'Ramesh Sawant', createdAt: '2026-11-01T10:30:00Z' }, // 30 mins response
      ],
    });

    const res = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/dashboard/committee',
      token: committeeToken,
    });
    expect(res.status).toBe(200);

    const { complaintMetrics } = res.body;
    expect(complaintMetrics.totalComplaints).toBeGreaterThanOrEqual(3);
    expect(complaintMetrics.resolvedComplaints).toBeGreaterThanOrEqual(1);
    expect(complaintMetrics.reopenedCount).toBeGreaterThanOrEqual(1);
    expect(complaintMetrics.reopenedRatePct).toBeGreaterThan(0);

    // Verify response time is a positive number and not derived from resolution time
    expect(complaintMetrics.averageResponseTimeMinutes).toBeGreaterThan(0);
    expect(complaintMetrics.averageResolutionTimeHours).toBeGreaterThan(0);

    // Verify calculation documentation is explicitly provided
    expect(complaintMetrics.calculationDocumentation.responseTimeFormula).toContain('timeline');
    expect(complaintMetrics.calculationDocumentation.disclaimer).toContain('Response time is never derived from resolution time');
  });

  it('Monthly Collection CSV Export: generates valid RFC CSV using actual database invoice data', async () => {
    const res = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/dashboard/reports/monthly-collection',
      token: committeeToken,
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');

    const csvText = typeof res.body === 'string' ? res.body : String(res.body);
    expect(csvText).toContain('Tower,Flat,Resident Name,Phone,Billing Period');
    expect(csvText).toContain('T07');
    expect(csvText).toContain('Neeraj Kulkarni');
    expect(csvText).toContain('T12');
    expect(csvText).toContain('Swati Joshi');
    expect(csvText).toContain('"TOTAL"');
  });

  it('Complaints CSV Export: generates valid RFC CSV using actual complaint records', async () => {
    const res = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/dashboard/reports/complaints',
      token: committeeToken,
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');

    const csvText = typeof res.body === 'string' ? res.body : String(res.body);
    expect(csvText).toContain('Ticket ID,Tower,Flat,Resident Name,Category,Urgency,Status');
    expect(csvText).toContain('cmp-01');
    expect(csvText).toContain('PLUMBING');
  });
});
