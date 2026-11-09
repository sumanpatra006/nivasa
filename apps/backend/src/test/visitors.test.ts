import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchRequest } from './testHelper.js';
import { societyStore } from '../modules/billing/societyStore.js';
import fs from 'fs';
import path from 'path';

describe('Visitor Management & Guard Tablet API', () => {
  let residentToken: string;
  let guardToken: string;
  let otherResidentToken: string;

  beforeEach(async () => {
    societyStore.reset();

    // Resident 1 (Neeraj Kulkarni, flat-t07-1203)
    const resAuth = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9820000001', otp: '123456' },
    });
    residentToken = resAuth.body.token;

    // Resident 2 (Swati Joshi, flat-t12-0408)
    const otherResAuth = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9820000002', otp: '123456' },
    });
    otherResidentToken = otherResAuth.body.token;

    // Guard (Security Gate Guard)
    const guardAuth = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9876543213', otp: '123456' },
    });
    guardToken = guardAuth.body.token;
  });

  it('enforces flat boundary: residents only see visitors for their authorized flat', async () => {
    const res = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/visitors',
      token: residentToken,
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.visitors)).toBe(true);
    // All returned visitors must belong to flat-t07-1203
    for (const v of res.body.visitors) {
      expect(v.flatId).toBe('flat-t07-1203');
    }
  });

  it('allows guard to view all society gate visitor entries', async () => {
    const res = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/visitors',
      token: guardToken,
    });

    expect(res.status).toBe(200);
    expect(res.body.visitors.length).toBeGreaterThanOrEqual(3);
  });

  it('allows guard to register a visitor with vehicle number and purpose', async () => {
    const res = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/visitors',
      token: guardToken,
      body: {
        flatId: 'flat-t07-1203',
        visitorName: 'Urban Company Plumber',
        visitorPhone: '9820009944',
        purpose: 'Kitchen sink repair',
        vehicleNumber: 'MH03-AB-1234',
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.visitor).toHaveProperty('id');
    expect(res.body.visitor.visitorName).toBe('Urban Company Plumber');
    expect(res.body.visitor.entryStatus).toBe('CHECKED_IN');
    expect(res.body.visitor.approvalStatus).toBe('PENDING');
  });

  it('allows resident to approve or deny arriving visitor for their flat', async () => {
    // Register pending visitor for flat-t07-1203
    const regRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/visitors',
      token: guardToken,
      body: {
        flatId: 'flat-t07-1203',
        visitorName: 'Swiggy Delivery Agent',
        purpose: 'Food delivery',
      },
    });
    const visitorId = regRes.body.visitor.id;

    // Other resident attempts to approve -> 403 Forbidden
    const unauthApprove = await dispatchRequest({
      method: 'PATCH',
      url: `/api/v1/visitors/${visitorId}/approval`,
      token: otherResidentToken,
      body: { status: 'APPROVED' },
    });
    expect(unauthApprove.status).toBe(403);

    // Authorized resident approves
    const authApprove = await dispatchRequest({
      method: 'PATCH',
      url: `/api/v1/visitors/${visitorId}/approval`,
      token: residentToken,
      body: { status: 'APPROVED' },
    });
    expect(authApprove.status).toBe(200);
    expect(authApprove.body.visitor.approvalStatus).toBe('APPROVED');
  });

  it('records visitor entry and exit timestamps', async () => {
    const regRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/visitors',
      token: guardToken,
      body: {
        flatId: 'flat-t07-1203',
        visitorName: 'Courier Agent',
        purpose: 'Document pickup',
      },
    });
    const visitorId = regRes.body.visitor.id;

    // Record check out / exit
    const exitRes = await dispatchRequest({
      method: 'PATCH',
      url: `/api/v1/visitors/${visitorId}/exit`,
      token: guardToken,
    });
    expect(exitRes.status).toBe(200);
    expect(exitRes.body.visitor.entryStatus).toBe('CHECKED_OUT');
    expect(exitRes.body.visitor.departedAt).toBeDefined();
  });

  it('allows resident to generate 6-digit pre-approved guest PIN and guard to validate it', async () => {
    // Resident generates code
    const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const createCodeRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/visitors/guest-codes',
      token: residentToken,
      body: {
        flatId: 'flat-t07-1203',
        guestName: 'Anand Kulkarni',
        purpose: 'Family Dinner',
        validUntil,
        usageLimit: 1,
      },
    });

    expect(createCodeRes.status).toBe(201);
    const pin = createCodeRes.body.guestCode.codePlain;
    expect(pin).toHaveLength(6);

    // Guard keypad validates the PIN
    const validateRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/visitors/guest-codes/validate',
      token: guardToken,
      body: { code: pin },
    });

    expect(validateRes.status).toBe(200);
    expect(validateRes.body.isValid).toBe(true);
    expect(validateRes.body.visitor.visitorName).toBe('Anand Kulkarni');
    expect(validateRes.body.visitor.entryStatus).toBe('CHECKED_IN');
    expect(validateRes.body.visitor.approvalStatus).toBe('APPROVED');

    // Second validation attempt should fail since usageLimit is 1
    const secondValidation = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/visitors/guest-codes/validate',
      token: guardToken,
      body: { code: pin },
    });
    expect(secondValidation.status).toBe(400);
    expect(secondValidation.body.isValid).toBe(false);
  });

  it('handles offline batch sync idempotently using clientUuid and preserves recordedAt', async () => {
    const offlineTimestamp = '2026-11-09T08:30:00.000Z';
    const clientUuid = 'd8f438a2-7212-4f32-8438-e6b35d648171';

    const batchRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/visitors/sync-batch',
      token: guardToken,
      body: {
        visitors: [
          {
            clientUuid,
            flatId: 'flat-t07-1203',
            visitorName: 'Offline Milk Delivery',
            purpose: 'Daily Milk Delivery',
            recordedAt: offlineTimestamp,
          },
        ],
      },
    });

    expect(batchRes.status).toBe(200);
    expect(batchRes.body.syncedCount).toBe(1);
    expect(batchRes.body.visitors[0].recordedAt).toBe(offlineTimestamp);

    // Re-syncing the exact same batch should not create duplicate entries
    const duplicateBatchRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/visitors/sync-batch',
      token: guardToken,
      body: {
        visitors: [
          {
            clientUuid,
            flatId: 'flat-t07-1203',
            visitorName: 'Offline Milk Delivery',
            purpose: 'Daily Milk Delivery',
            recordedAt: offlineTimestamp,
          },
        ],
      },
    });

    expect(duplicateBatchRes.status).toBe(200);
    // Should return existing record with matching ID
    expect(duplicateBatchRes.body.visitors[0].id).toBe(batchRes.body.visitors[0].id);
  });

  it('deletes physical photo files from disk after 90 days according to DPDP retention policy', async () => {
    const photosDir = path.resolve(process.cwd(), 'data', 'photos', 'visitors');
    if (!fs.existsSync(photosDir)) {
      fs.mkdirSync(photosDir, { recursive: true });
    }

    const testExpiredPhotoFile = 'expired_test_photo.jpg';
    const filePath = path.join(photosDir, testExpiredPhotoFile);
    fs.writeFileSync(filePath, 'EXPIRED_SIMULATED_PHOTO_DATA');

    // Add a visitor with photoRetainUntil in the past
    societyStore.addVisitor({
      flatId: 'flat-t07-1203',
      visitorName: 'Historical Expired Visitor',
      purpose: 'Old inspection',
      visitorPhotoKey: testExpiredPhotoFile,
    });

    // Manually set its retention date to past
    const visitors = societyStore.getVisitors();
    const target = visitors.find((v) => v.visitorName === 'Historical Expired Visitor');
    if (target) {
      target.photoRetainUntil = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    }

    expect(fs.existsSync(filePath)).toBe(true);

    // Trigger scheduled purge endpoint
    const purgeRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/visitors/purge-expired-photos',
      token: guardToken,
    });

    expect(purgeRes.status).toBe(200);
    expect(purgeRes.body.complianceStatus).toBe('DPDP_ACT_2023_COMPLIANT');
    expect(purgeRes.body.purgedPhotosCount).toBeGreaterThanOrEqual(1);

    // Verify physical file was unlinked from disk
    expect(fs.existsSync(filePath)).toBe(false);
  });
});

