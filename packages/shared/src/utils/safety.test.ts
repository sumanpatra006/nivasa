import { describe, it, expect } from 'vitest';
import { checkSafetyEscalation } from './safety.js';

describe('Safety Escalation Rules', () => {
  it('detects fire emergencies', () => {
    const res = checkSafetyEscalation('Smoke in corridor', 'There is a small fire near the meter box');
    expect(res.isSafetyEscalation).toBe(true);
    expect(res.matchedTerms).toContain('fire');
  });

  it('detects gas leaks', () => {
    const res = checkSafetyEscalation('Strange odor', 'Strong gas leak smell coming from flat 402');
    expect(res.isSafetyEscalation).toBe(true);
    expect(res.matchedTerms).toContain('gas leak');
  });

  it('detects lift stuck incidents', () => {
    const res = checkSafetyEscalation('Lift stuck on 8th floor', 'Elderly resident is inside');
    expect(res.isSafetyEscalation).toBe(true);
    expect(res.matchedTerms).toContain('lift stuck');
  });

  it('detects electric shocks', () => {
    const res = checkSafetyEscalation('Pool gate', 'Resident received an electric shock touching the gate');
    expect(res.isSafetyEscalation).toBe(true);
    expect(res.matchedTerms).toContain('electric shock');
  });

  it('does not trigger on ordinary complaints', () => {
    const res = checkSafetyEscalation('Water leak under sink', 'Kitchen sink has slow water dripping');
    expect(res.isSafetyEscalation).toBe(false);
    expect(res.matchedTerms).toHaveLength(0);
  });
});

