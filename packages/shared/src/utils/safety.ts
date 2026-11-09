import { SAFETY_ESCALATION_TERMS } from '../constants/index.js';

export interface SafetyEscalationResult {
  isSafetyEscalation: boolean;
  matchedTerms: string[];
  reason?: string;
}

/**
 * Deterministically checks if text (title or description) contains
 * any critical safety escalation terms.
 */
export function checkSafetyEscalation(
  title: string,
  description: string
): SafetyEscalationResult {
  const normalized = `${title} ${description}`.toLowerCase();
  const matchedTerms: string[] = [];

  for (const term of SAFETY_ESCALATION_TERMS) {
    if (normalized.includes(term.toLowerCase())) {
      matchedTerms.push(term);
    }
  }

  if (matchedTerms.length > 0) {
    return {
      isSafetyEscalation: true,
      matchedTerms,
      reason: `Automated safety override triggered due to matching safety indicators: [${matchedTerms.join(', ')}]`,
    };
  }

  return {
    isSafetyEscalation: false,
    matchedTerms: [],
  };
}

