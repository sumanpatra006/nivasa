import { CommitteeDashboardMetrics } from '@nivasa/shared';

export interface ApiInvoice {
  id: string;
  flatId: string;
  tower: string;
  flatNumber: string;
  residentName: string;
  residentPhone: string;
  billingPeriod: string;
  areaSqFt: number;
  ratePerSqFtPaise: number;
  baseAmountPaise: number;
  lateFeePaise: number;
  totalAmountPaise: number;
  paidAmountPaise: number;
  remainingBalancePaise: number;
  dueDate: string;
  status: 'PAID' | 'PARTIALLY_PAID' | 'ISSUED' | 'OVERDUE';
  daysOverdue: number;
}

export interface ApiPayment {
  id: string;
  invoiceId: string;
  flatId: string;
  amountPaise: number;
  idempotencyKey: string;
  provider: string;
  providerReference: string;
  status: 'INITIATED' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  failureReason?: string;
  createdAt: string;
  paidAt?: string | null;
  receiptId?: string | null;
}

export interface ApiReceipt {
  id: string;
  receiptNumber: string;
  paymentId: string;
  invoiceId: string;
  flatId: string;
  flatIdentifier: string;
  residentName: string;
  billingPeriod: string;
  amountPaise: number;
  paymentReference: string;
  date: string;
}

export interface ApiLedgerEntry {
  id: string;
  flatId: string;
  entryType: 'BILL' | 'PAYMENT' | 'LATE_FEE' | 'ADJUSTMENT' | 'REVERSAL';
  amountPaise: number;
  description: string;
  reference?: string;
  createdAt: string;
}

export interface ApiLedgerResponse {
  flatId: string;
  closingBalancePaise: number;
  entries: ApiLedgerEntry[];
}

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api/v1';

export class ApiClient {
  private static token: string | null = null;

  public static setToken(token: string) {
    this.token = token;
    try {
      localStorage.setItem('nivasa_auth_token', token);
    } catch {}
  }

  public static getToken(): string | null {
    if (!this.token) {
      try {
        this.token = localStorage.getItem('nivasa_auth_token');
      } catch {}
    }
    return this.token;
  }

  public static clearToken() {
    this.token = null;
    try {
      localStorage.removeItem('nivasa_auth_token');
      localStorage.removeItem('nivasa_user_profile');
    } catch {}
  }

  public static async requestOtp(phone: string): Promise<{ message: string; phone: string; isDevMode: boolean }> {
    const res = await fetch(`${API_BASE_URL}/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || body.error || 'Failed to request OTP');
    }
    return body;
  }

  public static async verifyOtp(
    phone: string,
    otp: string
  ): Promise<{
    token: string;
    user: {
      id?: string;
      phone: string;
      role: string;
      name: string;
      flatIds: string[];
    };
  }> {
    const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Invalid or expired OTP');
    }

    this.setToken(data.token);
    try {
      localStorage.setItem('nivasa_user_profile', JSON.stringify(data.user));
    } catch {}

    return data;
  }

  public static getUser(): { id?: string; phone: string; role: string; name: string; flatIds: string[] } | null {
    try {
      const raw = localStorage.getItem('nivasa_user_profile');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public static async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch {}
    this.clearToken();
  }

  /**
   * Helper to ensure resident is logged in for the demo flat.
   */
  public static async authenticateResident(phone: string): Promise<string> {
    const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp: '123456' }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Authentication failed');
    }

    const data = await res.json();
    this.setToken(data.token);
    return data.token;
  }

  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = body.message || body.error || `HTTP error ${response.status}`;
      throw new Error(errorMsg);
    }

    return body as T;
  }

  public static async getBills(): Promise<{ invoices: ApiInvoice[] }> {
    return this.request<{ invoices: ApiInvoice[] }>('/bills');
  }

  public static async getBill(id: string): Promise<{ invoice: ApiInvoice }> {
    return this.request<{ invoice: ApiInvoice }>(`/bills/${id}`);
  }

  public static async getLedger(flatId: string): Promise<ApiLedgerResponse> {
    return this.request<ApiLedgerResponse>(`/ledger/${flatId}`);
  }

  public static async getReceipts(): Promise<{ receipts: ApiReceipt[] }> {
    return this.request<{ receipts: ApiReceipt[] }>('/payments/receipts');
  }

  public static async getReceipt(id: string): Promise<{ receipt: ApiReceipt }> {
    return this.request<{ receipt: ApiReceipt }>(`/payments/receipts/${id}`);
  }

  public static async initiatePayment(
    invoiceId: string,
    amountPaise: number,
    idempotencyKey: string
  ): Promise<{ payment: ApiPayment }> {
    return this.request<{ payment: ApiPayment }>('/payments/initiate', {
      method: 'POST',
      body: JSON.stringify({ invoiceId, amountPaise, idempotencyKey }),
    });
  }

  public static async verifyPayment(
    idempotencyKey: string,
    outcome: 'SUCCESS' | 'FAILED' = 'SUCCESS',
    simulateFailure = false
  ): Promise<{
    payment: ApiPayment;
    receipt?: ApiReceipt | null;
    invoice?: ApiInvoice;
    ledgerEntry?: ApiLedgerEntry;
    message?: string;
  }> {
    return this.request<{
      payment: ApiPayment;
      receipt?: ApiReceipt | null;
      invoice?: ApiInvoice;
      ledgerEntry?: ApiLedgerEntry;
      message?: string;
    }>('/payments/verify', {
      method: 'POST',
      body: JSON.stringify({ idempotencyKey, outcome, simulateFailure }),
    });
  }

  // Reconciliation API
  public static async authenticateAccountsStaff(): Promise<string> {
    return this.authenticateResident('9876543211'); // Accounts Officer Pooja Mehta
  }

  public static async getReconciliationQueue(status?: string): Promise<{ queue: ApiReconciledTransaction[] }> {
    const query = status && status !== 'ALL' ? `?status=${encodeURIComponent(status)}` : '';
    return this.request<{ queue: ApiReconciledTransaction[] }>(`/reconciliation/queue${query}`);
  }

  public static async getReconciliationBatches(): Promise<{ batches: ApiBatchSummary[] }> {
    return this.request<{ batches: ApiBatchSummary[] }>('/reconciliation/batches');
  }

  public static async searchCandidates(query?: string): Promise<{ candidates: any[] }> {
    const q = query ? `?q=${encodeURIComponent(query)}` : '';
    return this.request<{ candidates: any[] }>(`/reconciliation/candidates${q}`);
  }

  public static async uploadBankCsv(
    csvContent: string,
    filename: string = 'bank_statement.csv'
  ): Promise<{
    message: string;
    batch: ApiBatchSummary;
    reconciledQueue: ApiReconciledTransaction[];
    summary: {
      totalRows: number;
      validRows: number;
      duplicateRows: number;
      invalidRows: number;
      suggestedCount: number;
      needsReviewCount: number;
      unmatchedCount: number;
    };
  }> {
    return this.request('/reconciliation/upload', {
      method: 'POST',
      body: JSON.stringify({ csvContent, filename }),
    });
  }

  public static async confirmReconciliationMatch(txnId: string, invoiceId?: string): Promise<any> {
    return this.request(`/reconciliation/transactions/${encodeURIComponent(txnId)}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ invoiceId }),
    });
  }

  public static async rejectReconciliationMatch(txnId: string, reason?: string): Promise<any> {
    return this.request(`/reconciliation/transactions/${encodeURIComponent(txnId)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  public static async markReconciliationReview(txnId: string): Promise<any> {
    return this.request(`/reconciliation/transactions/${encodeURIComponent(txnId)}/review`, {
      method: 'POST',
    });
  }

  public static async authenticateStaff(phone: string = '9876543210'): Promise<string> {
    const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp: '123456' }),
    });
    if (!res.ok) throw new Error('Staff authentication failed');
    const data = await res.json();
    this.setToken(data.token);
    return data.token;
  }

  public static async getComplaints(filters?: {
    category?: string;
    urgency?: string;
    status?: string;
    search?: string;
  }): Promise<{ complaints: ApiComplaint[] }> {
    const params = new URLSearchParams();
    if (filters?.category && filters.category !== 'ALL') params.append('category', filters.category);
    if (filters?.urgency && filters.urgency !== 'ALL') params.append('urgency', filters.urgency);
    if (filters?.status && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ complaints: ApiComplaint[] }>(`/complaints${query}`);
  }

  public static async getComplaint(id: string): Promise<{ complaint: ApiComplaint }> {
    return this.request<{ complaint: ApiComplaint }>(`/complaints/${encodeURIComponent(id)}`);
  }

  public static async createComplaint(payload: {
    flatId: string;
    title: string;
    description: string;
    category?: string;
    photoUrl?: string;
  }): Promise<{ complaint: ApiComplaint }> {
    return this.request<{ complaint: ApiComplaint }>('/complaints', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public static async updateComplaintStatus(
    id: string,
    status: string,
    comment?: string
  ): Promise<{ complaint: ApiComplaint }> {
    return this.request<{ complaint: ApiComplaint }>(`/complaints/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, comment }),
    });
  }

  public static async assignComplaint(
    id: string,
    assignedTo: string,
    reason?: string
  ): Promise<{ complaint: ApiComplaint }> {
    return this.request<{ complaint: ApiComplaint }>(`/complaints/${encodeURIComponent(id)}/assignment`, {
      method: 'PATCH',
      body: JSON.stringify({ assignedTo, reason }),
    });
  }

  public static async correctComplaint(
    id: string,
    payload: { category?: string; urgency?: string; reason?: string }
  ): Promise<{ complaint: ApiComplaint }> {
    return this.request<{ complaint: ApiComplaint }>(`/complaints/${encodeURIComponent(id)}/correction`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  public static async rateComplaint(
    id: string,
    stars: number,
    feedback?: string
  ): Promise<{ complaint: ApiComplaint }> {
    return this.request<{ complaint: ApiComplaint }>(`/complaints/${encodeURIComponent(id)}/rate`, {
      method: 'POST',
      body: JSON.stringify({ stars, feedback }),
    });
  }

  public static async linkDuplicateComplaint(
    id: string,
    duplicateId: string
  ): Promise<{ message: string; primary: ApiComplaint; duplicate: ApiComplaint }> {
    return this.request(`/complaints/${encodeURIComponent(id)}/link-duplicate`, {
      method: 'POST',
      body: JSON.stringify({ duplicateId }),
    });
  }

  public static async rejectDuplicateComplaint(
    id: string,
    candidateId: string,
    reason?: string
  ): Promise<{ complaint: ApiComplaint }> {
    return this.request<{ complaint: ApiComplaint }>(`/complaints/${encodeURIComponent(id)}/reject-duplicate`, {
      method: 'POST',
      body: JSON.stringify({ candidateId, reason }),
    });
  }

  // Committee Oversight & Reporting API
  public static async authenticateCommittee(phone: string = '9876543212'): Promise<string> {
    const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp: '123456' }),
    });
    if (!res.ok) throw new Error('Committee authentication failed');
    const data = await res.json();
    this.setToken(data.token);
    return data.token;
  }

  public static async getCommitteeDashboard(period?: string): Promise<CommitteeDashboardMetrics> {
    const query = period && period !== 'ALL' ? `?period=${encodeURIComponent(period)}` : '';
    return this.request<CommitteeDashboardMetrics>(`/dashboard/committee${query}`);
  }

  public static async downloadMonthlyCollectionCsv(period?: string): Promise<string> {
    const token = this.getToken();
    const query = period && period !== 'ALL' ? `?period=${encodeURIComponent(period)}` : '';
    const res = await fetch(`${API_BASE_URL}/dashboard/reports/monthly-collection${query}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Download failed: ${res.statusText}`);
    return res.text();
  }

  // ==========================================
  // Visitor Management & Guard Tablet API
  // ==========================================
  public static async authenticateGuard(phone: string = '9876543213'): Promise<string> {
    const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp: '123456' }),
    });
    if (!res.ok) throw new Error('Guard authentication failed');
    const data = await res.json();
    this.setToken(data.token);
    return data.token;
  }

  public static async getVisitors(flatId?: string): Promise<{ visitors: ApiVisitor[] }> {
    const query = flatId ? `?flatId=${encodeURIComponent(flatId)}` : '';
    return this.request<{ visitors: ApiVisitor[] }>(`/visitors${query}`);
  }

  public static async registerVisitor(data: {
    clientUuid?: string;
    flatId: string;
    visitorName: string;
    visitorPhone?: string;
    purpose: string;
    vehicleNumber?: string;
    photoBase64?: string;
    visitorPhotoKey?: string;
    preApprovedCode?: string;
    recordedAt?: string;
  }): Promise<{ visitor: ApiVisitor }> {
    return this.request<{ visitor: ApiVisitor }>('/visitors', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async approveVisitor(
    id: string,
    status: 'APPROVED' | 'DENIED'
  ): Promise<{ visitor: ApiVisitor }> {
    return this.request<{ visitor: ApiVisitor }>(`/visitors/${encodeURIComponent(id)}/approval`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  public static async recordVisitorEntry(id: string): Promise<{ visitor: ApiVisitor }> {
    return this.request<{ visitor: ApiVisitor }>(`/visitors/${encodeURIComponent(id)}/entry`, {
      method: 'PATCH',
    });
  }

  public static async recordVisitorExit(id: string): Promise<{ visitor: ApiVisitor }> {
    return this.request<{ visitor: ApiVisitor }>(`/visitors/${encodeURIComponent(id)}/exit`, {
      method: 'PATCH',
    });
  }

  public static async syncVisitorBatch(
    visitors: Array<any>
  ): Promise<{ syncedCount: number; totalReceived: number; visitors: ApiVisitor[] }> {
    return this.request<{ syncedCount: number; totalReceived: number; visitors: ApiVisitor[] }>(
      '/visitors/sync-batch',
      {
        method: 'POST',
        body: JSON.stringify({ visitors }),
      }
    );
  }

  public static async purgeExpiredPhotos(): Promise<{
    message: string;
    purgedPhotosCount: number;
    purgedFiles: string[];
    complianceStatus: string;
  }> {
    return this.request<{
      message: string;
      purgedPhotosCount: number;
      purgedFiles: string[];
      complianceStatus: string;
    }>('/visitors/purge-expired-photos', {
      method: 'POST',
    });
  }

  public static async getGuestCodes(flatId?: string): Promise<{ guestCodes: ApiGuestCode[] }> {
    const query = flatId ? `?flatId=${encodeURIComponent(flatId)}` : '';
    return this.request<{ guestCodes: ApiGuestCode[] }>(`/visitors/guest-codes${query}`);
  }

  public static async createGuestCode(data: {
    flatId: string;
    guestName: string;
    purpose?: string;
    validFrom?: string;
    validUntil: string;
    usageLimit?: number;
  }): Promise<{ guestCode: ApiGuestCode }> {
    return this.request<{ guestCode: ApiGuestCode }>('/visitors/guest-codes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async validateGuestCode(code: string): Promise<{
    isValid: boolean;
    reason?: string;
    guestCode?: ApiGuestCode;
    visitor?: ApiVisitor;
    message?: string;
  }> {
    return this.request<{
      isValid: boolean;
      reason?: string;
      guestCode?: ApiGuestCode;
      visitor?: ApiVisitor;
      message?: string;
    }>('/visitors/guest-codes/validate', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  // ==========================================
  // Amenities API
  // ==========================================
  public static async getAmenities(): Promise<{
    amenities: ApiAmenity[];
    disclaimer: string;
  }> {
    return this.request<{ amenities: ApiAmenity[]; disclaimer: string }>('/amenities');
  }

  public static async getAmenitySlots(
    amenityId: string,
    date: string
  ): Promise<{
    amenityId: string;
    date: string;
    slots: ApiAmenitySlot[];
  }> {
    return this.request<{
      amenityId: string;
      date: string;
      slots: ApiAmenitySlot[];
    }>(`/amenities/${encodeURIComponent(amenityId)}/slots?date=${encodeURIComponent(date)}`);
  }

  public static async bookAmenity(
    amenityId: string,
    data: { flatId: string; startAt: string; endAt: string }
  ): Promise<{ booking: ApiAmenityBooking }> {
    return this.request<{ booking: ApiAmenityBooking }>(
      `/amenities/${encodeURIComponent(amenityId)}/book`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  public static async cancelAmenityBooking(
    bookingId: string
  ): Promise<{ message: string; booking: ApiAmenityBooking }> {
    return this.request<{ message: string; booking: ApiAmenityBooking }>(
      `/amenities/bookings/${encodeURIComponent(bookingId)}/cancel`,
      {
        method: 'POST',
      }
    );
  }

  public static async getAmenityBookings(
    flatId?: string
  ): Promise<{ bookings: ApiAmenityBooking[] }> {
    const query = flatId ? `?flatId=${encodeURIComponent(flatId)}` : '';
    return this.request<{ bookings: ApiAmenityBooking[] }>(`/amenities/bookings${query}`);
  }
}


export interface ApiReconciledTransaction {
  id: string;
  transaction: {
    id: string;
    rowNumber: number;
    rawRow: string;
    transactionDate: string;
    amountPaise: number;
    reference: string;
    upiId: string | null;
    description: string;
    isDuplicateInBatch: boolean;
  };
  status: 'UNMATCHED' | 'SUGGESTED' | 'NEEDS_REVIEW' | 'MATCHED' | 'POSTED' | 'DUPLICATE' | 'REJECTED';
  suggestedMatch: {
    invoiceId: string;
    flatIdentifier: string;
    candidateInvoice: any;
    candidateFlat: {
      flatId: string;
      tower: string;
      flatNumber: string;
      residentName: string;
    };
    confidence: number;
    matchingReasons: string[];
    missingEvidence: string[];
  } | null;
  alternativeMatches: any[];
  isAmbiguous: boolean;
  selectedInvoiceId?: string | null;
  postedPaymentId?: string | null;
  postedAt?: string | null;
  rejectionReason?: string | null;
}

export interface ApiBatchSummary {
  id: string;
  filename: string;
  fileHash: string;
  uploadedAt: string;
  totalRows: number;
  processedRows: number;
  duplicateRows: number;
  invalidRows: number;
  rowErrors: Array<{ line: number; message: string; rawRow: string }>;
}

export interface ApiComplaint {
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
  rating?: {
    stars: number;
    feedback?: string;
    ratedAt: string;
  } | null;
  isSafetyEscalation: boolean;
  safetyReason?: string | null;
  dutyManagerAlerted: boolean;
  isAiFallback: boolean;
  aiConfidence?: number;
  aiSuggestedTeam?: string;
  aiExplanation?: string;
  duplicateOfId?: string | null;
  duplicateLinks: string[];
  duplicateSuggestions: Array<{
    candidateId: string;
    candidateTitle: string;
    candidateFlat: string;
    candidateStatus: string;
    confidence: number;
    matchingFactors: string[];
  }>;
  reopenCount: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  resolutionComment?: string | null;
  sla?: {
    elapsedMinutes: number;
    responseTargetMinutes: number;
    resolutionTargetMinutes: number;
    isBreached: boolean;
    isEscalated: boolean;
    slaStatus: string;
    remainingMinutes: number;
    displayRemaining: string;
  };
  slaTimeRemaining?: string;
  timeline: Array<{
    id: string;
    message: string;
    actor?: string;
    createdAt: string;
  }>;
}

export interface ApiVisitor {
  id: string;
  clientUuid?: string;
  flatId: string;
  tower: string;
  flatNumber: string;
  residentName?: string;
  visitorName: string;
  visitorPhone?: string;
  visitorPhotoKey?: string | null;
  purpose: string;
  vehicleNumber?: string;
  arrivedAt?: string | null;
  departedAt?: string | null;
  approvalStatus: 'PENDING' | 'APPROVED' | 'DENIED' | 'NOT_REQUIRED';
  entryStatus: 'EXPECTED' | 'CHECKED_IN' | 'CHECKED_OUT';
  photoRetainUntil?: string | null;
  recordedAt: string;
  createdAt: string;
}

export interface ApiGuestCode {
  id: string;
  flatId: string;
  tower: string;
  flatNumber: string;
  guestName: string;
  purpose?: string;
  codeHash: string;
  codeMasked: string;
  codePlain?: string;
  validFrom: string;
  validUntil: string;
  usageLimit: number;
  usageCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface ApiAmenity {
  id: string;
  name: string;
  description: string;
  rules: string;
  feePaise: number;
  capacity: number;
  openTime: string;
  closeTime: string;
  slotDurationMinutes: number;
  isActive: boolean;
  isDemoFee: boolean;
}

export interface ApiAmenitySlot {
  id: string;
  amenityId: string;
  date: string;
  startAt: string;
  endAt: string;
  label: string;
  isAvailable: boolean;
  feePaise: number;
  bookedByFlat?: string;
}

export interface ApiAmenityBooking {
  id: string;
  amenityId: string;
  amenityName: string;
  flatId: string;
  flatIdentifier: string;
  residentId: string;
  residentName: string;
  startAt: string;
  endAt: string;
  feePaise: number;
  status: 'CONFIRMED' | 'CANCELLED';
  cancelledAt?: string | null;
  createdAt: string;
}


