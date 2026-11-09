import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { dispatchRequest } from './testHelper.js';
import { societyStore } from '../modules/billing/societyStore.js';
import {
  COMPLAINT_CATEGORY,
  COMPLAINT_URGENCY,
  COMPLAINT_STATUS,
} from '@nivasa/shared';

describe('Complaints Management System', () => {
  let resident1Token: string; // T07-1203 (Neeraj)
  let resident2Token: string; // T12-0408 (Swati)
  let staffToken: string; // Helpdesk staff

  beforeAll(async () => {
    const res1 = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9820000001', otp: '123456' },
    });
    resident1Token = res1.body.token;

    const res2 = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9820000002', otp: '123456' },
    });
    resident2Token = res2.body.token;

    const staff = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9876543210', otp: '123456' }, // Helpdesk
    });
    staffToken = staff.body.token;
  });

  beforeEach(() => {
    societyStore.reset();
  });

  it('Feature 1: allows resident to create complaint with photo attachment and persists it', async () => {
    const res = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/complaints',
      token: resident1Token,
      body: {
        flatId: 'flat-t07-1203',
        title: 'Balcony door latch jammed',
        description: 'The sliding door latch in the master balcony is stuck and will not lock.',
        photoUrl: 'https://storage.example.com/photos/balcony_latch.jpg',
      },
    });

    expect(res.status).toBe(201);
    const complaint = res.body.complaint;
    expect(complaint.id).toBeDefined();
    expect(complaint.title).toBe('Balcony door latch jammed');
    expect(complaint.photoUrl).toBe('https://storage.example.com/photos/balcony_latch.jpg');
    expect(complaint.status).toBe(COMPLAINT_STATUS.NEW);
    expect(complaint.timeline.length).toBeGreaterThanOrEqual(1);

    // Verify persistence in society store
    const stored = societyStore.getComplaintById(complaint.id);
    expect(stored).toBeDefined();
    expect(stored?.title).toBe('Balcony door latch jammed');
  });

  it('Feature 2: performs AI classification with deterministic fallback when AI is unconfigured', async () => {
    const res = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/complaints',
      token: resident1Token,
      body: {
        flatId: 'flat-t07-1203',
        title: 'Water tap leaking heavily under kitchen sink',
        description: 'Persistent water leakage from the inlet pipe flooding kitchen floor.',
      },
    });

    expect(res.status).toBe(201);
    const c = res.body.complaint;
    expect(c.category).toBe(COMPLAINT_CATEGORY.PLUMBING);
    expect(c.isAiFallback).toBe(true);
    expect(c.aiConfidence).toBeGreaterThan(0.7);
    expect(c.aiSuggestedTeam).toContain('Plumbing');
    expect(c.aiExplanation).toContain('Deterministic rule-based classification');
  });

  it('Feature 3: deterministic safety escalation overrides AI, sets CRITICAL urgency, alerts manager, and cannot be auto-closed', async () => {
    // 1. Create safety emergency ticket
    const res = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/complaints',
      token: resident1Token,
      body: {
        flatId: 'flat-t07-1203',
        title: 'Urgent: Strong gas leak smell outside flat',
        description: 'Smell of cooking gas leakage in corridor near pipeline. Risk of explosion.',
      },
    });

    expect(res.status).toBe(201);
    const c = res.body.complaint;
    expect(c.isSafetyEscalation).toBe(true);
    expect(c.urgency).toBe(COMPLAINT_URGENCY.CRITICAL);
    expect(c.dutyManagerAlerted).toBe(true);

    const safetyEvent = c.timeline.find((t: any) => t.actor === 'System Safety Monitor');
    expect(safetyEvent).toBeDefined();
    expect(safetyEvent.message).toContain('AUTOMATED SAFETY ESCALATION TRIGGERED');

    // 2. Attempt to directly close without being marked resolved must fail
    const closeAttempt = await dispatchRequest({
      method: 'PATCH',
      url: `/api/v1/complaints/${c.id}/status`,
      token: staffToken,
      body: { status: 'CLOSED' },
    });
    expect(closeAttempt.status).toBe(400);
    expect(closeAttempt.body.error).toContain('Safety critical complaints cannot be closed');

    // 3. Attempt to downgrade urgency below CRITICAL must fail
    const downgradeAttempt = await dispatchRequest({
      method: 'PATCH',
      url: `/api/v1/complaints/${c.id}/correction`,
      token: staffToken,
      body: { urgency: 'LOW' },
    });
    expect(downgradeAttempt.status).toBe(400);
    expect(downgradeAttempt.body.error).toContain('cannot be downgraded');
  });

  it('Feature 4: suggests duplicate complaints, links duplicates without deleting, and supports rejecting suggestions', async () => {
    // 1. Create first ticket in Tower T12
    const c1 = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/complaints',
      token: resident2Token,
      body: {
        flatId: 'flat-t12-0408',
        title: 'Intercom phone not ringing',
        description: 'Main lobby security cannot ring flat intercom handset.',
      },
    });
    expect(c1.status).toBe(201);

    // 2. Create second similar ticket in Tower T12
    const c2 = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/complaints',
      token: resident2Token,
      body: {
        flatId: 'flat-t12-0408',
        title: 'Intercom phone dead',
        description: 'Lobby intercom is not ringing inside apartment.',
      },
    });
    expect(c2.status).toBe(201);

    // Verify c2 suggested c1 as candidate duplicate
    const suggestions = c2.body.complaint.duplicateSuggestions;
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].candidateId).toBe(c1.body.complaint.id);
    expect(suggestions[0].confidence).toBeGreaterThanOrEqual(0.5);

    // 3. Help desk confirms duplicate relationship
    const linkRes = await dispatchRequest({
      method: 'POST',
      url: `/api/v1/complaints/${c1.body.complaint.id}/link-duplicate`,
      token: staffToken,
      body: { duplicateId: c2.body.complaint.id },
    });
    expect(linkRes.status).toBe(200);
    expect(linkRes.body.primary.duplicateLinks).toContain(c2.body.complaint.id);
    expect(linkRes.body.duplicate.duplicateOfId).toBe(c1.body.complaint.id);

    // Both complaints still exist (neither was deleted)
    expect(societyStore.getComplaintById(c1.body.complaint.id)).toBeDefined();
    expect(societyStore.getComplaintById(c2.body.complaint.id)).toBeDefined();

    // 4. Reject duplicate suggestion test
    const c3 = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/complaints',
      token: resident2Token,
      body: {
        flatId: 'flat-t12-0408',
        title: 'Intercom volume button broken',
        description: 'Intercom handset speaker works but volume slider broke.',
      },
    });
    expect(c3.body.complaint.duplicateSuggestions.length).toBeGreaterThan(0);
    const candidateId = c3.body.complaint.duplicateSuggestions[0].candidateId;

    const rejectRes = await dispatchRequest({
      method: 'POST',
      url: `/api/v1/complaints/${c3.body.complaint.id}/reject-duplicate`,
      token: staffToken,
      body: { candidateId, reason: 'Different root cause (hardware physical damage)' },
    });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.complaint.duplicateSuggestions.find((s: any) => s.candidateId === candidateId)).toBeUndefined();
  });

  it('Feature 5: Help-desk queue filters, assignment, manual correction, resolution comment, and reopen counting', async () => {
    // 1. Create ticket
    const createRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/complaints',
      token: resident1Token,
      body: {
        flatId: 'flat-t07-1203',
        title: 'Basement parking light flickering',
        description: 'Tube light above parking bay B-14 is buzzing and flickering.',
      },
    });
    const id = createRes.body.complaint.id;

    // 2. Staff queue filtering
    const queueRes = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/complaints?status=NEW',
      token: staffToken,
    });
    expect(queueRes.status).toBe(200);
    expect(queueRes.body.complaints.some((c: any) => c.id === id)).toBe(true);

    // 3. Assign to technician
    const assignRes = await dispatchRequest({
      method: 'PATCH',
      url: `/api/v1/complaints/${id}/assignment`,
      token: staffToken,
      body: { assignedTo: 'Electrical Team (Mahesh Jadhav)', reason: 'Designated tower electrician' },
    });
    expect(assignRes.status).toBe(200);
    expect(assignRes.body.complaint.assignedTo).toBe('Electrical Team (Mahesh Jadhav)');
    expect(assignRes.body.complaint.status).toBe(COMPLAINT_STATUS.ASSIGNED);

    // 4. Help desk manual category & urgency correction
    const correctRes = await dispatchRequest({
      method: 'PATCH',
      url: `/api/v1/complaints/${id}/correction`,
      token: staffToken,
      body: {
        category: COMPLAINT_CATEGORY.ELECTRICAL,
        urgency: COMPLAINT_URGENCY.HIGH,
        reason: 'Parking bay lighting is a safety concern at night',
      },
    });
    expect(correctRes.status).toBe(200);
    expect(correctRes.body.complaint.category).toBe(COMPLAINT_CATEGORY.ELECTRICAL);
    expect(correctRes.body.complaint.urgency).toBe(COMPLAINT_URGENCY.HIGH);

    // 5. Work in progress -> Resolve with comments
    await dispatchRequest({
      method: 'PATCH',
      url: `/api/v1/complaints/${id}/status`,
      token: staffToken,
      body: { status: COMPLAINT_STATUS.IN_PROGRESS },
    });

    const resolveRes = await dispatchRequest({
      method: 'PATCH',
      url: `/api/v1/complaints/${id}/status`,
      token: staffToken,
      body: { status: COMPLAINT_STATUS.RESOLVED, comment: 'Replaced ballast and fitted 20W LED fixture' },
    });
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.complaint.status).toBe(COMPLAINT_STATUS.RESOLVED);
    expect(resolveRes.body.complaint.resolutionComment).toBe('Replaced ballast and fitted 20W LED fixture');
    expect(resolveRes.body.complaint.resolvedAt).toBeDefined();

    // 6. Resident reopens ticket -> reopenCount increments
    const reopenRes = await dispatchRequest({
      method: 'PATCH',
      url: `/api/v1/complaints/${id}/status`,
      token: resident1Token,
      body: { status: COMPLAINT_STATUS.REOPENED, comment: 'Light fixture tripped the MCB 2 hours later' },
    });
    expect(reopenRes.status).toBe(200);
    expect(reopenRes.body.complaint.status).toBe(COMPLAINT_STATUS.REOPENED);
    expect(reopenRes.body.complaint.reopenCount).toBe(1);
  });

  it('Feature 6: Response timer calculates SLA targets and statuses with clear demo labeling', async () => {
    const listRes = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/complaints',
      token: staffToken,
    });
    expect(listRes.status).toBe(200);

    const complaints = listRes.body.complaints;
    expect(complaints.length).toBeGreaterThan(0);

    const first = complaints[0];
    expect(first.sla).toBeDefined();
    expect(first.sla.responseTargetMinutes).toBeGreaterThan(0);
    expect(first.slaTimeRemaining).toBeDefined();
  });

  it('Feature 7: Resident ratings and authorization restrictions', async () => {
    // 1. Resident 1 cannot view or modify complaints belonging to Resident 2
    const foreignAccessRes = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/complaints/cmp-01', // Flat T12-0408 (Resident 2)
      token: resident1Token, // Resident 1 (Flat T07-1203)
    });
    expect(foreignAccessRes.status).toBe(403);

    // 2. Resident 1 cannot file a complaint for Resident 2's flat
    const foreignCreateRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/complaints',
      token: resident1Token,
      body: {
        flatId: 'flat-t12-0408',
        title: 'Unauthorized test',
        description: 'Should be rejected by server authorization',
      },
    });
    expect(foreignCreateRes.status).toBe(403);

    // 3. Resident 2 rates resolved complaint
    // First resolve cmp-01
    await dispatchRequest({
      method: 'PATCH',
      url: '/api/v1/complaints/cmp-01/status',
      token: staffToken,
      body: { status: COMPLAINT_STATUS.RESOLVED, comment: 'Fixed washer in washbasin' },
    });

    const rateRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/complaints/cmp-01/rate',
      token: resident2Token,
      body: { stars: 5, feedback: 'Plumber Santosh arrived quickly and fixed the leak cleanly!' },
    });
    expect(rateRes.status).toBe(200);
    expect(rateRes.body.complaint.rating.stars).toBe(5);
    expect(rateRes.body.complaint.rating.feedback).toContain('Plumber Santosh');

    // 4. Rating active (non-resolved) ticket must fail
    const activeTicket = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/complaints',
      token: resident2Token,
      body: {
        flatId: 'flat-t12-0408',
        title: 'Doorbell not working',
        description: 'Electronic chime stopped responding.',
      },
    });

    const invalidRateRes = await dispatchRequest({
      method: 'POST',
      url: `/api/v1/complaints/${activeTicket.body.complaint.id}/rate`,
      token: resident2Token,
      body: { stars: 4 },
    });
    expect(invalidRateRes.status).toBe(400);
    expect(invalidRateRes.body.error).toContain('Only resolved complaints can be rated');
  });
});
