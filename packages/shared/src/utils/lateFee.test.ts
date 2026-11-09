import { describe, it, expect } from 'vitest';
import { calculateLateFeePaise, DEFAULT_DEMO_LATE_FEE_POLICY } from './lateFee.js';

describe('Late Fee Calculation', () => {
  it('returns 0 paise when days overdue is 0 or negative', () => {
    expect(calculateLateFeePaise(0)).toBe(0);
    expect(calculateLateFeePaise(-5)).toBe(0);
  });

  it('returns 0 paise within the 10-day grace period', () => {
    expect(calculateLateFeePaise(5)).toBe(0);
    expect(calculateLateFeePaise(10)).toBe(0);
  });

  it('calculates flat fee plus daily penalty after grace period', () => {
    // 11 days: 1 day past grace -> 25000 + 1 * 1000 = 26000 paise (₹260)
    expect(calculateLateFeePaise(11)).toBe(26000);

    // 18 days (Aamir Shaikh T21-1601 overdue 18 days):
    // 8 days past grace -> 25000 + 8 * 1000 = 33000 paise (₹330)
    expect(calculateLateFeePaise(18)).toBe(33000);

    // 47 days (Swati Joshi T12-0408 overdue 47 days):
    // 37 days past grace -> 25000 + 37 * 1000 = 62000 paise (₹620)
    expect(calculateLateFeePaise(47)).toBe(62000);
  });

  it('respects the maximum late fee cap', () => {
    // 150 days: 140 days past grace -> 25000 + 140000 = 165000, capped at 100000 paise
    expect(calculateLateFeePaise(150)).toBe(DEFAULT_DEMO_LATE_FEE_POLICY.maxLateFeePaise);
  });

  it('supports custom late fee policies', () => {
    const customPolicy = {
      gracePeriodDays: 5,
      flatFeePaise: 10000, // ₹100
      dailyPenaltyPaise: 500, // ₹5/day
      maxLateFeePaise: 50000, // ₹500
    };

    expect(calculateLateFeePaise(5, customPolicy)).toBe(0);
    expect(calculateLateFeePaise(7, customPolicy)).toBe(11000); // 10000 + 2 * 500
  });
});

