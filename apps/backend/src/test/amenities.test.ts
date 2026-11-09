import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchRequest } from './testHelper.js';
import { societyStore } from '../modules/billing/societyStore.js';

describe('Amenity Booking & Conflict API', () => {
  let residentToken: string;
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
  });

  it('retrieves active amenities with demo fees and rules', async () => {
    const res = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/amenities',
      token: residentToken,
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.amenities)).toBe(true);
    expect(res.body.amenities.length).toBeGreaterThanOrEqual(4);

    const tennisCourt = res.body.amenities.find((a: any) => a.id === 'amen-2');
    expect(tennisCourt).toBeDefined();
    expect(tennisCourt.feePaise).toBe(20000); // ₹200 demo fee
    expect(tennisCourt.rules).toContain('Non-marking');
  });

  it('retrieves time slot availability for a specified date', async () => {
    const res = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/amenities/amen-2/slots?date=2026-11-10',
      token: residentToken,
    });

    expect(res.status).toBe(200);
    expect(res.body.amenityId).toBe('amen-2');
    expect(Array.isArray(res.body.slots)).toBe(true);
    // Seed booking exists from 07:00 to 08:00 on 2026-11-10
    const bookedSlot = res.body.slots.find((s: any) => s.startAt.includes('07:00'));
    expect(bookedSlot).toBeDefined();
    expect(bookedSlot.isAvailable).toBe(false);

    const availableSlot = res.body.slots.find((s: any) => s.startAt.includes('09:00'));
    expect(availableSlot).toBeDefined();
    expect(availableSlot.isAvailable).toBe(true);
  });

  it('books an available amenity slot and calculates demo fee in integer paise', async () => {
    const res = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/amenities/amen-2/book',
      token: residentToken,
      body: {
        flatId: 'flat-t07-1203',
        startAt: '2026-11-10T09:00:00.000Z',
        endAt: '2026-11-10T10:00:00.000Z',
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.booking).toHaveProperty('id');
    expect(res.body.booking.status).toBe('CONFIRMED');
    expect(res.body.booking.feePaise).toBe(20000); // 20000 paise
    expect(res.body.booking.flatIdentifier).toBe('T07-1203');
  });

  it('prevents overlapping active bookings and returns 409 Conflict', async () => {
    // Resident 1 books Badminton Court from 17:00 to 18:00
    const bookRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/amenities/amen-3/book',
      token: residentToken,
      body: {
        flatId: 'flat-t07-1203',
        startAt: '2026-11-10T17:00:00.000Z',
        endAt: '2026-11-10T18:00:00.000Z',
      },
    });
    expect(bookRes.status).toBe(201);

    // Resident 2 attempts to book overlapping window 17:30 to 18:30 on same court
    const conflictRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/amenities/amen-3/book',
      token: otherResidentToken,
      body: {
        flatId: 'flat-t12-0408',
        startAt: '2026-11-10T17:30:00.000Z',
        endAt: '2026-11-10T18:30:00.000Z',
      },
    });

    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body).toHaveProperty('error', 'Conflict');
    expect(conflictRes.body.message).toContain('already booked');
  });

  it('allows resident to cancel their booking, which frees the slot for another resident', async () => {
    // Resident 1 books Badminton Court from 18:00 to 19:00
    const bookRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/amenities/amen-3/book',
      token: residentToken,
      body: {
        flatId: 'flat-t07-1203',
        startAt: '2026-11-10T18:00:00.000Z',
        endAt: '2026-11-10T19:00:00.000Z',
      },
    });
    const bookingId = bookRes.body.booking.id;

    // Resident 2 cannot cancel Resident 1's booking
    const unauthCancel = await dispatchRequest({
      method: 'POST',
      url: `/api/v1/amenities/bookings/${bookingId}/cancel`,
      token: otherResidentToken,
    });
    expect(unauthCancel.status).toBe(403);

    // Resident 1 cancels their own booking
    const cancelRes = await dispatchRequest({
      method: 'POST',
      url: `/api/v1/amenities/bookings/${bookingId}/cancel`,
      token: residentToken,
    });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.booking.status).toBe('CANCELLED');

    // Slot is now freed up: Resident 2 can now successfully book the same slot
    const rebookRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/amenities/amen-3/book',
      token: otherResidentToken,
      body: {
        flatId: 'flat-t12-0408',
        startAt: '2026-11-10T18:00:00.000Z',
        endAt: '2026-11-10T19:00:00.000Z',
      },
    });
    expect(rebookRes.status).toBe(201);
    expect(rebookRes.body.booking.status).toBe('CONFIRMED');
  });
});

