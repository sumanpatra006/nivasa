import { describe, it, expect, beforeAll } from 'vitest';
import { dispatchRequest } from './testHelper.js';

describe('Complaints & Safety Escalation', () => {
  let residentToken: string;
  let staffToken: string;

  beforeAll(async () => {
    const residentLogin = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9820000001', otp: '123456' },
    });
    residentToken = residentLogin.body.token;

    const staffLogin = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9876543210', otp: '123456' }, // Helpdesk
    });
    staffToken = staffLogin.body.token;
  });

  it('triggers automated safety escalation for gas leak or fire hazard', async () => {
    const res = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/complaints',
      token: residentToken,
      body: {
        flatId: 'flat-t07-1203',
        title: 'Emergency: LPG Gas Leak smell in kitchen corridor',
        description: 'Strong smell of gas leaking near the meter duct. High risk of fire.',
      },
    });

    expect(res.status).toBe(201);
    const complaint = res.body.complaint;
    expect(complaint.isSafetyEscalation).toBe(true);
    expect(complaint.urgency).toBe('CRITICAL');
    expect(complaint.safetyReason).toBeDefined();

    // Verify automated timeline entry
    const safetyTimeline = complaint.timeline.find((t: any) =>
      t.message.includes('AUTOMATED SAFETY ESCALATION TRIGGERED')
    );
    expect(safetyTimeline).toBeDefined();
    expect(safetyTimeline.actor).toBe('System Safety Monitor');
  });

  it('triggers automated safety escalation for passengers trapped in stuck lift', async () => {
    const res = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/complaints',
      token: residentToken,
      body: {
        flatId: 'flat-t07-1203',
        title: 'Tower 7 Lift stuck with passengers',
        description: 'Passenger elevator #2 stopped abruptly between 8th and 9th floors. Children inside.',
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.complaint.urgency).toBe('CRITICAL');
    expect(res.body.complaint.isSafetyEscalation).toBe(true);
  });

  it('classifies ordinary maintenance complaint with NORMAL urgency', async () => {
    const res = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/complaints',
      token: residentToken,
      body: {
        flatId: 'flat-t07-1203',
        title: 'Leaking bathroom tap',
        description: 'Slow continuous drip from washbasin tap in guest bathroom.',
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.complaint.urgency).toBe('NORMAL');
    expect(res.body.complaint.category).toBe('PLUMBING');
    expect(res.body.complaint.isSafetyEscalation).toBe(false);
  });

  it('tracks complaint lifecycle status transitions with audit timeline and reopen count', async () => {
    // 1. Create complaint
    const createRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/complaints',
      token: residentToken,
      body: {
        flatId: 'flat-t07-1203',
        title: 'Corridor light fixture flickering',
        description: 'Light outside flat 1203 is flickering continuously.',
      },
    });
    const id = createRes.body.complaint.id;

    // 2. Transition to ASSIGNED
    const assignRes = await dispatchRequest({
      method: 'PATCH',
      url: `/api/v1/complaints/${id}/status`,
      token: staffToken,
      body: { status: 'ASSIGNED', comment: 'Assigned to Electrical duty tech' },
    });
    expect(assignRes.status).toBe(200);
    expect(assignRes.body.complaint.status).toBe('ASSIGNED');

    // 3. Transition to RESOLVED
    const resolveRes = await dispatchRequest({
      method: 'PATCH',
      url: `/api/v1/complaints/${id}/status`,
      token: staffToken,
      body: { status: 'RESOLVED', comment: 'Choke and LED tube replaced' },
    });
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.complaint.status).toBe('RESOLVED');

    // 4. Resident reopens complaint
    const reopenRes = await dispatchRequest({
      method: 'PATCH',
      url: `/api/v1/complaints/${id}/status`,
      token: residentToken,
      body: { status: 'REOPENED', comment: 'Light fixture started buzzing and stopped working again' },
    });
    expect(reopenRes.status).toBe(200);
    expect(reopenRes.body.complaint.status).toBe('REOPENED');
    expect(reopenRes.body.complaint.reopenCount).toBe(1);
    expect(reopenRes.body.complaint.timeline.length).toBeGreaterThanOrEqual(4);
  });

  it('links duplicate complaints without silent deletion', async () => {
    // 1. Create primary
    const c1 = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/complaints',
      token: residentToken,
      body: { flatId: 'flat-t07-1203', title: 'Main gate barrier not opening', description: 'RFID reader sensor down' },
    });

    // 2. Create duplicate
    const c2 = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/complaints',
      token: residentToken,
      body: { flatId: 'flat-t07-1203', title: 'Gate barrier sensor stuck', description: 'RFID tag not scanning' },
    });

    // 3. Link duplicate
    const linkRes = await dispatchRequest({
      method: 'POST',
      url: `/api/v1/complaints/${c1.body.complaint.id}/link-duplicate`,
      token: staffToken,
      body: { duplicateId: c2.body.complaint.id },
    });

    expect(linkRes.status).toBe(200);
    expect(linkRes.body.primary.duplicateLinks).toContain(c2.body.complaint.id);
    expect(linkRes.body.duplicate.duplicateOfId).toBe(c1.body.complaint.id);
  });
});
