export interface LateFeePolicy {
  gracePeriodDays: number;
  flatFeePaise: number;
  dailyPenaltyPaise: number;
  maxLateFeePaise?: number;
}

/**
 * Authoritative demo late-fee policy.
 * 10-day grace period, ₹250 (25,000 paise) flat penalty + ₹10 (1,000 paise)/day overdue.
 * Capped at ₹1,000 (100,000 paise) for demo purposes.
 */
export const DEFAULT_DEMO_LATE_FEE_POLICY: LateFeePolicy = {
  gracePeriodDays: 10,
  flatFeePaise: 25000, // ₹250
  dailyPenaltyPaise: 1000, // ₹10/day
  maxLateFeePaise: 100000, // ₹1,000 cap
};

/**
 * Calculates late fee in integer paise based on days overdue.
 */
export function calculateLateFeePaise(
  daysOverdue: number,
  policy: LateFeePolicy = DEFAULT_DEMO_LATE_FEE_POLICY
): number {
  if (daysOverdue <= 0) return 0;
  if (daysOverdue <= policy.gracePeriodDays) return 0;

  const excessDays = daysOverdue - policy.gracePeriodDays;
  const calculatedFee = policy.flatFeePaise + excessDays * policy.dailyPenaltyPaise;

  if (policy.maxLateFeePaise !== undefined && calculatedFee > policy.maxLateFeePaise) {
    return policy.maxLateFeePaise;
  }

  return calculatedFee;
}
