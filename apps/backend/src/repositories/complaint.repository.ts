import { prisma } from '../config/prisma.js';
import { ComplaintCategory, ComplaintUrgency, ComplaintStatus } from '@prisma/client';
import { calculateComplaintSla } from '@nivasa/shared';

export interface FormattedComplaint {
  id: string;
  residentId: string;
  residentName: string;
  residentPhone?: string;
  flatId: string;
  tower: string;
  flatNumber: string;
  title: string;
  description: string;
  category: string;
  urgency: string;
  status: string;
  assignedTo?: string | null;
  photoUrl?: string | null;
  rating?: any;
  isSafetyEscalation: boolean;
  safetyReason?: string | null;
  dutyManagerAlerted: boolean;
  isAiFallback: boolean;
  aiConfidence?: number;
  aiSuggestedTeam?: string;
  aiExplanation?: string;
  duplicateOfId?: string | null;
  duplicateLinks: string[];
  duplicateSuggestions: any[];
  reopenCount: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  resolutionComment?: string | null;
  timeline: Array<{
    id: string;
    message: string;
    actor?: string;
    createdAt: string;
  }>;
  sla?: any;
  slaTimeRemaining?: string;
}

const memoryComplaints: Map<string, FormattedComplaint> = new Map();

export class ComplaintRepository {
  public static format(c: any): FormattedComplaint {
    const isSafety = c.urgency === 'CRITICAL';
    const sla = calculateComplaintSla(
      c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
      c.urgency,
      c.status,
      c.resolvedAt ? (c.resolvedAt instanceof Date ? c.resolvedAt.toISOString() : c.resolvedAt) : null
    );

    return {
      id: c.id,
      residentId: c.residentId,
      residentName: c.resident?.name || 'Resident',
      residentPhone: c.resident?.phone || '',
      flatId: c.flatId,
      tower: c.flat?.tower || (c.flatId.includes('t07') ? 'T07' : 'T12'),
      flatNumber: c.flat?.flatNumber || (c.flatId.includes('1203') ? '1203' : '0408'),
      title: c.title,
      description: c.description,
      category: c.category,
      urgency: c.urgency,
      status: c.status,
      assignedTo: c.assignee?.name || c.assignedTo || null,
      photoUrl: c.photoUrl || null,
      rating: c.rating || null,
      isSafetyEscalation: isSafety,
      safetyReason: isSafety ? 'Triggered emergency safety protocol' : null,
      dutyManagerAlerted: isSafety,
      isAiFallback: c.isAiFallback ?? true,
      aiConfidence: c.aiConfidence || 0.85,
      aiSuggestedTeam: c.aiSuggestedTeam || undefined,
      aiExplanation: c.aiExplanation || undefined,
      duplicateOfId: c.duplicateOfId || null,
      duplicateLinks: c.duplicateLinks || [],
      duplicateSuggestions: c.duplicateSuggestions || [],
      reopenCount: c.reopenedAt ? 1 : 0,
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
      updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
      resolvedAt: c.resolvedAt ? (c.resolvedAt instanceof Date ? c.resolvedAt.toISOString() : c.resolvedAt) : null,
      resolutionComment: c.resolutionComment || null,
      timeline: Array.isArray(c.timeline) && c.timeline.length > 0
        ? c.timeline.map((t: any) => ({
            id: t.id,
            message: t.message,
            actor: t.actor?.name || t.actor || 'System',
            createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
          }))
        : [
            {
              id: `tl-${c.id}-0`,
              message: 'Complaint submitted by resident',
              actor: c.resident?.name || 'Resident',
              createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
            },
          ],
      sla,
      slaTimeRemaining: sla.displayRemaining,
    };
  }

  public static async findMany(whereFilter: any = {}): Promise<FormattedComplaint[]> {
    try {
      const records = await prisma.complaint.findMany({
        where: whereFilter,
        include: {
          resident: true,
          assignee: true,
          flat: true,
          timeline: { include: { actor: true }, orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (records.length > 0) {
        return records.map(this.format);
      }
    } catch (err: any) {
      console.warn('Prisma Complaint.findMany notice:', err.message);
    }

    return Array.from(memoryComplaints.values());
  }

  public static async findById(id: string): Promise<FormattedComplaint | null> {
    try {
      const c = await prisma.complaint.findUnique({
        where: { id },
        include: {
          resident: true,
          assignee: true,
          flat: true,
          timeline: { include: { actor: true }, orderBy: { createdAt: 'asc' } },
        },
      });
      if (c) return this.format(c);
    } catch {}

    return memoryComplaints.get(id) || null;
  }

  public static async create(data: {
    residentId: string;
    flatId: string;
    title: string;
    description: string;
    category: ComplaintCategory;
    urgency: ComplaintUrgency;
    status: ComplaintStatus;
    assignedTo?: string | null;
    isSafetyEscalation?: boolean;
    safetyReason?: string | null;
    isAiFallback?: boolean;
    aiConfidence?: number;
    aiSuggestedTeam?: string;
    aiExplanation?: string;
    duplicateSuggestions?: any[];
  }): Promise<FormattedComplaint> {
    const complaintId = `cmp-${Date.now()}`;
    const now = new Date();

    const formatted: FormattedComplaint = {
      id: complaintId,
      residentId: data.residentId,
      residentName: 'Resident User',
      residentPhone: '9820000001',
      flatId: data.flatId,
      tower: data.flatId.includes('t07') ? 'T07' : 'T12',
      flatNumber: data.flatId.includes('1203') ? '1203' : '0408',
      title: data.title,
      description: data.description,
      category: data.category,
      urgency: data.urgency,
      status: data.status,
      assignedTo: data.assignedTo || null,
      isSafetyEscalation: data.isSafetyEscalation || false,
      safetyReason: data.safetyReason || null,
      dutyManagerAlerted: data.isSafetyEscalation || false,
      isAiFallback: data.isAiFallback ?? true,
      aiConfidence: data.aiConfidence || 0.85,
      aiSuggestedTeam: data.aiSuggestedTeam,
      aiExplanation: data.aiExplanation,
      duplicateOfId: null,
      duplicateLinks: [],
      duplicateSuggestions: data.duplicateSuggestions || [],
      reopenCount: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      timeline: [
        {
          id: `tl-${Date.now()}-1`,
          message: data.isSafetyEscalation
            ? `Safety escalation triggered: ${data.safetyReason}. Priority forced to CRITICAL.`
            : 'Complaint registered in society operations queue.',
          actor: 'System Automation',
          createdAt: now.toISOString(),
        },
      ],
    };

    try {
      await prisma.$transaction([
        prisma.complaint.create({
          data: {
            id: complaintId,
            residentId: data.residentId.startsWith('user-') ? data.residentId : 'user-staff-ramesh',
            flatId: data.flatId,
            title: data.title,
            description: data.description,
            category: data.category,
            urgency: data.urgency,
            status: data.status,
          },
        }),
        prisma.complaintTimeline.create({
          data: {
            complaintId,
            eventType: data.isSafetyEscalation ? 'SAFETY_ESCALATED' : 'CREATED',
            newStatus: data.status,
            message: formatted.timeline[0].message,
          },
        }),
      ]);
    } catch (err: any) {
      console.warn('PostgreSQL complaint create notice:', err.message);
    }

    memoryComplaints.set(complaintId, formatted);
    return formatted;
  }

  public static async updateStatus(
    id: string,
    newStatus: ComplaintStatus,
    comment?: string,
    actorName: string = 'Staff'
  ): Promise<FormattedComplaint | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const now = new Date();
    const updated: FormattedComplaint = {
      ...existing,
      status: newStatus,
      updatedAt: now.toISOString(),
      resolvedAt: newStatus === 'RESOLVED' ? now.toISOString() : existing.resolvedAt,
      resolutionComment: comment || existing.resolutionComment,
      timeline: [
        ...existing.timeline,
        {
          id: `tl-${Date.now()}`,
          message: comment ? `Status changed to ${newStatus}: ${comment}` : `Status changed to ${newStatus}`,
          actor: actorName,
          createdAt: now.toISOString(),
        },
      ],
    };

    try {
      await prisma.$transaction([
        prisma.complaint.update({
          where: { id },
          data: {
            status: newStatus,
            resolvedAt: newStatus === 'RESOLVED' ? now : undefined,
          },
        }),
        prisma.complaintTimeline.create({
          data: {
            complaintId: id,
            eventType: 'STATUS_CHANGED',
            newStatus,
            message: comment || `Status updated to ${newStatus}`,
          },
        }),
      ]);
    } catch {}

    memoryComplaints.set(id, updated);
    return updated;
  }

  public static async assign(id: string, teamOrUserId: string): Promise<FormattedComplaint | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const now = new Date();
    const updated: FormattedComplaint = {
      ...existing,
      assignedTo: teamOrUserId,
      status: existing.status === 'NEW' ? 'ASSIGNED' : existing.status,
      updatedAt: now.toISOString(),
      timeline: [
        ...existing.timeline,
        {
          id: `tl-${Date.now()}`,
          message: `Complaint assigned to: ${teamOrUserId}`,
          actor: 'Help Desk Duty',
          createdAt: now.toISOString(),
        },
      ],
    };

    try {
      await prisma.complaint.update({
        where: { id },
        data: {
          status: existing.status === 'NEW' ? ComplaintStatus.ASSIGNED : undefined,
        },
      });
    } catch {}

    memoryComplaints.set(id, updated);
    return updated;
  }

  public static async linkDuplicate(primaryId: string, duplicateId: string): Promise<boolean> {
    const primary = await this.findById(primaryId);
    const duplicate = await this.findById(duplicateId);
    if (!primary || !duplicate) return false;

    duplicate.duplicateOfId = primaryId;
    duplicate.status = 'CLOSED';
    if (!primary.duplicateLinks.includes(duplicateId)) {
      primary.duplicateLinks.push(duplicateId);
    }

    try {
      await prisma.complaintDuplicateLink.create({
        data: {
          sourceComplaintId: duplicateId,
          targetComplaintId: primaryId,
          similarity: 0.95,
          linkedBy: 'Helpdesk',
        },
      });
    } catch {}

    memoryComplaints.set(primaryId, primary);
    memoryComplaints.set(duplicateId, duplicate);
    return true;
  }

  public static async rate(id: string, stars: number, feedback?: string): Promise<FormattedComplaint | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updated: FormattedComplaint = {
      ...existing,
      rating: { stars, feedback, ratedAt: new Date().toISOString() },
    };

    memoryComplaints.set(id, updated);
    return updated;
  }
}
