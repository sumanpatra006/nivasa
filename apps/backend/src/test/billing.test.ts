import { describe, it, expect } from 'vitest';
import { calculateMaintenancePaise, calculateLateFeePaise } from '@nivasa/shared';
import { dispatchRequest } from './testHelper.js';

describe('Billing Calculations and Invoices', () => {
  it('calculates authoritative sample maintenance values in integer paise', () => {
    // T07-1203: 1,150 sq ft @ ₹6.50/sq ft = ₹7,475
    const bill1 = calculateMaintenancePaise(1150, 650);
    expect(bill1).toBe(747500);

    // T12-0408: 980 sq ft @ ₹6.50/sq ft = ₹6,370
    const bill2 = calculateMaintenancePaise(980, 650);
    expect(bill2).toBe(637000);

    // T21-1601: 1,640 sq ft @ ₹6.50/sq ft = ₹10,660
    const bill3 = calculateMaintenancePaise(1640, 650);
    expect(bill3).toBe(1066000);
  });

  it('calculates late fee accurately based on demo policy', () => {
    // Grace period (0 to 10 days) -> 0 paise
    expect(calculateLateFeePaise(0)).toBe(0);
    expect(calculateLateFeePaise(10)).toBe(0);

    // 18 days overdue (Aamir Shaikh) -> ₹250 flat + 8 * ₹10 = ₹330 (33,000 paise)
    expect(calculateLateFeePaise(18)).toBe(33000);

    // 47 days overdue (Swati Joshi) -> ₹250 flat + 37 * ₹10 = ₹620 (62,000 paise)
    expect(calculateLateFeePaise(47)).toBe(62000);
  });

  it('enforces flat isolation: resident only sees invoices for their registered flat', async () => {
    // 1. Login as Neeraj Kulkarni (Flat T07-1203)
    const loginRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9820000001', otp: '123456' },
    });
    const residentToken = loginRes.body.token;

    // 2. Fetch invoices as resident
    const invoicesRes = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/bills',
      token: residentToken,
    });

    expect(invoicesRes.status).toBe(200);
    expect(invoicesRes.body.invoices.length).toBe(1);
    expect(invoicesRes.body.invoices[0].flatId).toBe('flat-t07-1203');
    expect(invoicesRes.body.invoices[0].totalAmountPaise).toBe(747500);
  });

  it('allows accounts staff to view all society invoices', async () => {
    // 1. Login as Accounts Officer (Pooja Mehta)
    const loginRes = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      body: { phone: '9876543211', otp: '123456' },
    });
    const accountsToken = loginRes.body.token;

    // 2. Fetch all invoices
    const invoicesRes = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/bills',
      token: accountsToken,
    });

    expect(invoicesRes.status).toBe(200);
    expect(invoicesRes.body.invoices.length).toBeGreaterThanOrEqual(3);
  });
});

