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
    } catch {}
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
}
