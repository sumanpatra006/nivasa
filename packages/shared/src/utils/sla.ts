import { COMPLAINT_URGENCY, ComplaintUrgency, COMPLAINT_STATUS } from '../constants/index.js';

export interface SlaTarget {
  responseTargetMinutes: number;
  resolutionTargetMinutes: number;
}

/**
 * Demo Response & Resolution SLA targets by Urgency level.
 * NOTE: As noted in TDD.md A-14, actual society bye-laws/SLAs were not supplied.
 * This is a configurable demonstration SLA policy (non-contractual simulation).
 */
export const DEMO_SLA_CONFIG: Record<ComplaintUrgency, SlaTarget> = {
  [COMPLAINT_URGENCY.CRITICAL]: {
    responseTargetMinutes: 15,
    resolutionTargetMinutes: 120, // 2 hours
  },
  [COMPLAINT_URGENCY.HIGH]: {
    responseTargetMinutes: 60, // 1 hour
    resolutionTargetMinutes: 480, // 8 hours
  },
  [COMPLAINT_URGENCY.NORMAL]: {
    responseTargetMinutes: 240, // 4 hours
    resolutionTargetMinutes: 1440, // 24 hours
  },
  [COMPLAINT_URGENCY.LOW]: {
    responseTargetMinutes: 1440, // 24 hours
    resolutionTargetMinutes: 4320, // 72 hours
  },
};

export interface ComplaintSlaStatus {
  elapsedMinutes: number;
  responseTargetMinutes: number;
  resolutionTargetMinutes: number;
  isBreached: boolean;
  isEscalated: boolean;
  slaStatus: 'WITHIN_SLA' | 'BREACHED' | 'ESCALATED' | 'RESOLVED_ON_TIME' | 'RESOLVED_LATE';
  remainingMinutes: number;
  displayRemaining: string;
}

export function calculateComplaintSla(
  createdAtIso: string,
  urgency: ComplaintUrgency,
  status: string,
  resolvedAtIso?: string | null,
  nowIso: string = new Date().toISOString()
): ComplaintSlaStatus {
  const target = DEMO_SLA_CONFIG[urgency] || DEMO_SLA_CONFIG[COMPLAINT_URGENCY.NORMAL];
  const createdTime = new Date(createdAtIso).getTime();
  const currentTime = new Date(nowIso).getTime();
  const elapsedMinutes = Math.max(0, Math.floor((currentTime - createdTime) / (1000 * 60)));

  const isResolved = status === COMPLAINT_STATUS.RESOLVED || status === COMPLAINT_STATUS.CLOSED;

  if (isResolved && resolvedAtIso) {
    const resolvedTime = new Date(resolvedAtIso).getTime();
    const resolutionElapsed = Math.max(0, Math.floor((resolvedTime - createdTime) / (1000 * 60)));
    const onTime = resolutionElapsed <= target.resolutionTargetMinutes;
    return {
      elapsedMinutes: resolutionElapsed,
      responseTargetMinutes: target.responseTargetMinutes,
      resolutionTargetMinutes: target.resolutionTargetMinutes,
      isBreached: !onTime,
      isEscalated: false,
      slaStatus: onTime ? 'RESOLVED_ON_TIME' : 'RESOLVED_LATE',
      remainingMinutes: 0,
      displayRemaining: onTime ? 'Resolved on time' : `Resolved (${resolutionElapsed - target.resolutionTargetMinutes}m late)`,
    };
  }

  // Active complaint calculation based on response SLA for NEW tickets, and resolution SLA for ongoing
  const targetMinutes = status === COMPLAINT_STATUS.NEW ? target.responseTargetMinutes : target.resolutionTargetMinutes;
  const remainingMinutes = targetMinutes - elapsedMinutes;
  const isBreached = remainingMinutes < 0;
  const isEscalated = urgency === COMPLAINT_URGENCY.CRITICAL;

  let displayRemaining = '';
  if (isBreached) {
    const overdueMinutes = Math.abs(remainingMinutes);
    if (overdueMinutes >= 60) {
      displayRemaining = `Breached by ${Math.floor(overdueMinutes / 60)}h ${overdueMinutes % 60}m`;
    } else {
      displayRemaining = `Breached by ${overdueMinutes} mins`;
    }
  } else {
    if (remainingMinutes >= 60) {
      displayRemaining = `${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}m remaining`;
    } else {
      displayRemaining = `${remainingMinutes} mins remaining`;
    }
  }

  return {
    elapsedMinutes,
    responseTargetMinutes: target.responseTargetMinutes,
    resolutionTargetMinutes: target.resolutionTargetMinutes,
    isBreached,
    isEscalated,
    slaStatus: isEscalated ? 'ESCALATED' : isBreached ? 'BREACHED' : 'WITHIN_SLA',
    remainingMinutes,
    displayRemaining,
  };
}

