import { describe, it, expect } from 'vitest';
import {
  rupeesToPaise,
  paiseToRupees,
  calculateMaintenancePaise,
  formatPaiseToINR,
} from './money.js';

describe('Financial / Money Utilities', () => {
  it('converts rupees to integer paise accurately', () => {
    expect(rupeesToPaise(100)).toBe(10000);
    expect(rupeesToPaise(7475)).toBe(747500);
    expect(rupeesToPaise(6.5)).toBe(650);
    expect(rupeesToPaise(0.99)).toBe(99);
  });

  it('converts integer paise back to rupees', () => {
    expect(paiseToRupees(747500)).toBe(7475);
    expect(paiseToRupees(637000)).toBe(6370);
    expect(paiseToRupees(650)).toBe(6.5);
  });

  it('matches authoritative sample billing values from TDD Section 5', () => {
    // Flat T07-1203: Area 1,150 sq ft -> Monthly bill: ₹7,475 = 747,500 paise
    const bill1 = calculateMaintenancePaise(1150, 650);
    expect(bill1).toBe(747500);
    expect(paiseToRupees(bill1)).toBe(7475);

    // Flat T12-0408: Area 980 sq ft -> Monthly bill: ₹6,370 = 637,000 paise
    const bill2 = calculateMaintenancePaise(980, 650);
    expect(bill2).toBe(637000);
    expect(paiseToRupees(bill2)).toBe(6370);

    // Flat T21-1601: Area 1,640 sq ft -> Monthly bill: ₹10,660 = 1,066,000 paise
    const bill3 = calculateMaintenancePaise(1640, 650);
    expect(bill3).toBe(1066000);
    expect(paiseToRupees(bill3)).toBe(10660);
  });

  it('formats paise correctly into INR representation', () => {
    const formatted = formatPaiseToINR(747500);
    // Currency formatter in en-IN formats as ₹7,475
    expect(formatted).toContain('7,475');
  });

  it('throws error for negative area or negative rate', () => {
    expect(() => calculateMaintenancePaise(-100, 650)).toThrow();
    expect(() => calculateMaintenancePaise(1000, -650)).toThrow();
  });
});

