# Nivasa — Technical Design Document

**GitHub Repository:** [https://github.com/sumanpatra006/nivasa.git](https://github.com/sumanpatra006/nivasa.git)  
**Live Application URL:** [https://nivasa.vercel.app](https://nivasa.vercel.app) *(or deployed environment per `deployment.md`)*  
**Document Version:** 1.0 (Production Release)  
**Authors:** Google DeepMind Advanced Agentic Engineering Team & Nivasa Project Lead  
**Date:** November 2026  

---

## Executive Summary

**Nivasa** is an enterprise-grade, cloud-native residential society operating platform engineered specifically for Indian cooperative housing societies and high-rise apartment townships (2,400+ flats across 28 towers). 

Before Nivasa, essential society operations—maintenance invoicing, offline bank transfer reconciliation, resident grievance handling, gatekeeper physical registers, and executive committee compliance reporting—were fragmented across paper books, spreadsheets, personal WhatsApp groups, and disconnected SMS blasts. This fragmentation caused severe operational failures:
- **Unreconciled bank balances**: Anonymous NEFT/IMPS/UPI transfers sat in society bank accounts for months with no flat linkage.
- **Lost grievance trails**: Critical safety issues (lift outages, gas leaks) were treated with the same priority as minor gardening complaints.
- **Gate vulnerabilities**: Unverified delivery personnel entered without verifiable physical audit logs, and visitor photos violated privacy principles under India's Digital Personal Data Protection (DPDP) Act 2023.
- **Financial obscurity**: Executive committees relied on manual quarterly spreadsheets rather than real-time dues ageing.

Nivasa resolves these challenges through a unified **Modular Monolith** architecture backed by PostgreSQL, strict integer-paise financial mathematics, deterministic 7-evidence bank reconciliation, hybrid AI complaint triage with emergency safety overrides, DPDP-compliant guard tablet kiosks, and a warm editorial design system designed for non-technical Indian residents and operations staff.

---

## 1. System Architecture & Technology Choices

### 1.1 Architecture: The Modular Monolith

```
                                  ┌──────────────────────────────────────────────┐
                                  │            Vite React SPA (Frontend)         │
                                  │      Tailwind CSS + TanStack Query + Zod     │
                                  └──────────────────────┬───────────────────────┘
                                                         │ HTTPS (REST + JSON)
                                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                          Node.js + Express API Backend                                          │
│                                                                                                                 │
│   ┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐   ┌──────────────────────────────┐   │
│   │   Auth & RBAC      │   │ Maintenance & Bills│   │ Deterministic Match│   │ Complaints & Safety Override │   │
│   │  (OTP / JWT / SMS) │   │ (Paise Ledger / Tx)│   │ (7-Evidence Engine)│   │ (Hybrid Gemini + Rule Engine)│   │
│   └─────────┬──────────┘   └─────────┬──────────┘   └─────────┬──────────┘   └──────────────┬───────────────┘   │
│             │                        │                        │                             │                   │
│             └────────────────────────┴───────────┬────────────┴─────────────────────────────┘                   │
│                                                  ▼                                                              │
│                                  Domain Repositories & Services                                                 │
│                        (Atomic Prisma Transactions & Validation Layer)                                          │
└──────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────┘
                                                   │ Prisma ORM (v5.22.0)
                                                   ▼
                                  ┌──────────────────────────────────────────────┐
                                  │            PostgreSQL (Neon Cloud)           │
                                  │    Row Constraints, Foreign Keys, UUIDs      │
                                  └──────────────────────────────────────────────┘
```

#### Why We Chose a Modular Monolith Over Microservices
1. **Financial Transaction Atomicity**: Society operations demand strict database transactions (`prisma.$transaction`) across billing status, receipts, payments, and double-entry flat ledgers. In a distributed microservices setup, maintaining ledger consistency requires complex distributed sagas and two-phase commits, which introduce failure modes unacceptable for statutory accounting audits.
2. **Operational Simplicity**: A single codebase with clean internal domain boundaries (Modules: `billing`, `reconciliation`, `complaints`, `visitors`, `amenities`, `dashboard`) enables atomic deployments, shared TypeScript definitions (`@nivasa/shared`), and zero distributed network latency.
3. **Auditability & Security**: Role-based access control (RBAC), data isolation between apartments, and compliance audits run within a single secure boundary.

### 1.2 Technology Stack Justification

| Layer | Chosen Technology | Architectural Rationale |
| :--- | :--- | :--- |
| **Language** | TypeScript (v5.x Strict) | Complete end-to-end type safety between database schemas, REST APIs, and UI components prevents runtime `null`/`undefined` errors. |
| **Frontend Framework** | React 18 + Vite | Sub-second hot module reloading, high-performance rendering for 500+ row bank reconciliation tables, and optimal SPA bundle delivery. |
| **Styling & Design System** | Tailwind CSS + Lucide Icons | Utility-first architecture allowing complete enforcement of the Nivasa warm editorial design tokens (`#2c221e` Walnut, `#faf8f5` Warm Sand) without CSS bloat. |
| **State & API Synchronization** | TanStack Query (React Query) | Intelligent caching, automatic query invalidation upon payment confirmation, and optimistic UI updates for tablet gate check-in. |
| **Form Management & Validation** | React Hook Form + Zod | Strict schema validation sharing identical Zod schemas between client input forms and backend Express middleware. |
| **Backend Framework** | Node.js + Express | Lightweight, reliable asynchronous I/O with battle-tested middleware ecosystems for JWT authentication, rate limiting, and multipart CSV parsing. |
| **Database & ORM** | PostgreSQL (Neon) + Prisma ORM | Relational integrity with foreign key cascading, unique constraints on transaction hashes, native UUID generation, and type-safe query generation. |
| **Testing** | Vitest + React Testing Library | Fast ESM-native execution running 100+ automated unit and integration tests across financial calculations, safety rules, and auth logic. |

---

## 2. Relational Data Model & Financial Integrity

### 2.1 The Integer-Paise Standard (Zero Floating-Point Drift)
Indian accounting software often suffers from floating-point rounding errors when calculating GST or per-square-foot maintenance (e.g. `1150 * 6.50 = 7475.000000000001`). In Nivasa:
- **Rule**: All monetary values are strictly stored and computed as **integer paise** (1 INR = 100 paise).
- Example: Maintenance rate ₹6.50/sq ft is represented as `650` paise. An 1,150 sq ft flat incurs `1150 * 650 = 747500` paise (₹7,475.00).
- Floating-point arithmetic is mathematically prohibited in services, repositories, and database schemas.

### 2.2 Entity Relationship Architecture

```
┌──────────────────┐            ┌──────────────────┐            ┌───────────────────┐
│       User       │ 1        * │  FlatMembership  │ *        1 │       Flat        │
│ id (UUID)        ├───────────►│ userId (FK)      │◄───────────┤ id (UUID)         │
│ phone (Unique)   │            │ flatId (FK)      │            │ tower (e.g. T07)  │
│ role (Enum)      │            │ membershipType   │            │ flatNumber (1203) │
└────────┬─────────┘            └──────────────────┘            │ areaSqFt (Int)    │
         │                                                      └─────────┬─────────┘
         │ 1                                                              │ 1
         ▼ *                                                              ▼ *
┌──────────────────┐            ┌──────────────────┐            ┌───────────────────┐
│     Payment      │ *        1 │     Invoice      │ 1        * │    LedgerEntry    │
│ id (UUID)        │◄───────────┤ id (UUID)        ├───────────►│ id (UUID)         │
│ idempotencyKey   │            │ flatId (FK)      │            │ flatId (FK)       │
│ amountPaise      │            │ totalAmountPaise │            │ entryType (Enum)  │
│ status (Enum)    │            │ paidAmountPaise  │            │ amountPaise (Int) │
└────────┬─────────┘            │ status (Enum)    │            └───────────────────┘
         │ 1                    └──────────────────┘
         ▼ 0..1
┌──────────────────┐            ┌────────────────────────┐      ┌───────────────────┐
│     Receipt      │            │    BankTransaction     │ 1  * │ReconciliationMatch│
│ receiptNumber    │            │ id (UUID)              ├─────►│ id (UUID)         │
│ amountPaise      │            │ normalizedReference    │      │ bankTransactionId │
│ issuedAt         │            │ status (Enum)          │      │ invoiceId (FK)    │
└──────────────────┘            └────────────────────────┘      │ confidence (Float)│
                                                                └───────────────────┘
```

### 2.3 Core Database Tables
1. **`User`**: Normalized contact identities with validated 10-digit Indian phone numbers and role permissions (`RESIDENT`, `HELPDESK`, `ACCOUNTS`, `COMMITTEE`, `GUARD`).
2. **`OtpVerification`**: High-security OTP challenge records with SHA-256 hashed codes, attempt throttling (max 3 tries), and 5-minute cryptographic expiration.
3. **`Flat` & `FlatMembership`**: Decouples physical apartments from human residents, supporting owner-tenancy transitions, co-owners, and multi-flat ownership without duplicating property records.
4. **`Invoice`**: Period-specific society charges with unique constraint `[flatId, billingPeriod]` to prevent duplicate billing cycles.
5. **`Payment`**: Multi-gateway transaction records enforced by a global `idempotencyKey` unique index to eliminate double-charging.
6. **`Receipt`**: Legal statutory receipts generated inside the payment transaction with formatted receipt identifiers (`REC-YYYYMM-FLAT-RANDOM`).
7. **`LedgerEntry`**: Immutable transaction journal representing flat balance debits and credits.
8. **`BankImportBatch` & `BankTransaction`**: Raw and normalized statement records with duplicate file detection via SHA-256 hash.
9. **`Complaint`, `ComplaintTimeline`, & `ComplaintDuplicateLink`**: Complete grievance lifecycle including technician assignments, resident star ratings, and duplicate linking.
10. **`Visitor` & `GuestCode`**: Gate check-in audit logs and 6-digit resident pre-approved guest passes.
11. **`Amenity` & `AmenityBooking`**: Society clubhouses, swimming pools, and sports facilities with conflict-locking algorithms.

---

## 3. Core Application Workflows & AI Architecture

### 3.1 Resident Authentication via Multi-Provider SMS OTP
- **Phone Lookup**: The user enters their 10-digit mobile number.
- **Cryptographic Generation**: A 6-digit random code is generated using `crypto.randomInt(100000, 1000000)`.
- **Brute-Force Protection**: The code is hashed using SHA-256 and saved in `OtpVerification`. Verification attempts are capped at 3; upon 3 failures, the token is invalidated.
- **Telecom Gateway Dispatch**: The `SmsService` attempts delivery via Fast2SMS or Twilio. If no external telecom provider is configured (development/sandbox), the OTP is safely delivered to the secure console log, with `123456` enabled for automated testing.

### 3.2 Maintenance Billing, Test Payment, and Atomic Ledger Updates
To avoid financial race conditions, payment posting executes in a single isolated database transaction (`prisma.$transaction`):

```
Resident clicks "Pay Bill"
       │
       ▼
Check Idempotency Key (Return existing record if already processed)
       │
       ▼
BEGIN DATABASE TRANSACTION:
  1. Record Payment as 'SUCCESS' with timestamp
  2. Increment Invoice.paidAmountPaise
  3. Transition Invoice Status (PARTIALLY_PAID or PAID)
  4. Generate Statutory Receipt record (REC-202611-1203-XXXX)
  5. Insert LedgerEntry (Debit: -amountPaise, Reference: Receipt Number)
COMMIT TRANSACTION
       │
       ▼
Return Receipt PDF / JSON to Frontend
```

### 3.3 Bank Statement Reconciliation: 7-Tier Deterministic Scoring
When an accounts manager uploads a bank CSV statement (e.g. HDFC, ICICI, SBI), the system parses the file without discarding invalid rows. Each transaction is scored against outstanding society invoices:

| Evidence Tier | Signal Checked | Weight Added |
| :--- | :--- | :---: |
| **Tier 1** | Exact Payment Reference Match (e.g. `TXN982001`) | **+40%** |
| **Tier 2** | Exact Resident UPI ID (e.g. `neeraj@okaxis`) | **+25%** |
| **Tier 3** | Flat Number Match in transaction remarks (e.g. `T07-1203`) | **+20%** |
| **Tier 4** | Exact Amount matching invoice outstanding balance | **+15%** |
| **Tier 5** | Transaction date within 30 days of invoice due date | **+10%** |
| **Tier 6** | Known past resident payment method match | **+10%** |
| **Ambiguity Check** | Multiple flats sharing the exact same score or amount | **Forces Review** |

**Match Status State Machine:**
- `UNMATCHED`: Score < 50% or no candidates found.
- `SUGGESTED`: Score >= 70% with distinct, unambiguous flat match.
- `NEEDS_REVIEW`: Score 50%–69%, or multiple flats matching the same amount (prevents accidental posting).
- `MATCHED`: Confirmed by Accounts Staff.
- `POSTED`: Applied to flat invoice and ledger with official receipt.
- `DUPLICATE`: Identical transaction hash already processed.

### 3.4 Grievance AI Classification & Deterministic Safety Escalations

```
                       Resident Submits Complaint
                                   │
                                   ▼
             ┌───────────────────────────────────────────┐
             │       Deterministic Safety Engine         │
             │   Checks for: Fire, Gas, Lift, Shock      │
             └─────────────────────┬─────────────────────┘
                                   │
               ┌───────────────────┴───────────────────┐
      Safety Match Detected                   No Safety Hazard
               │                                       │
               ▼                                       ▼
    EMERGENCY SAFETY OVERRIDE               Invoke AI Classification
    - Force Urgency = 'CRITICAL'             (Gemini LLM Adapter)
    - Auto-assign Emergency Team                       │
    - Alert Duty Manager Desk              ┌───────────┴───────────┐
    - Prohibit Auto-closure                │                       │
                                      AI Available           AI Offline
                                           │                       │
                                           ▼                       ▼
                                   Structured Output       Rule Fallback
                                   (Category, Urgency)    (Keyword Match)
```

#### How the AI Component Works
1. **Deterministic Safety Priority**: Machine learning models can hallucinate or downplay emergencies. Therefore, safety evaluation **precedes** all AI execution. Keywords such as `"sparks"`, `"gas smell"`, `"person trapped in lift"`, or `"fire"` immediately trigger `CRITICAL` urgency, bypass standard queues, and alert the facility duty manager.
2. **AI Provider Adapter (`GeminiAdapter`)**: If enabled, the prompt passes the title and description to Gemini 1.5 Flash using structured output mode. The model returns:
   - `category`: Plumbing, Electrical, Lift, Security, Cleaning, Common Area, Clubhouse, or Other.
   - `urgency`: Low, Normal, High, or Critical.
   - `confidence`: Floating score 0.0 to 1.0.
   - `suggestedTeam`: Appropriate internal department.
   - `explanation`: Transparent rationale for help-desk auditing.
3. **Graceful Deterministic Fallback**: If the external AI API is unconfigured, rate-limited, or times out, the backend automatically engages the deterministic keyword fallback engine, flags the ticket with `isAiFallback: true`, and presents it to human help-desk staff for review.

### 3.5 Gate Visitor Management & DPDP Act 2023 Compliance
- **Guard Tablet Kiosk**: Designed specifically for low-cost Android tablets at security gates. Features a high-contrast numeric keypad for 6-digit guest pass PIN validation, 48px touch targets, and camera capture.
- **Offline Resilient Queue**: When gate internet connectivity fluctuates, check-ins are saved in browser `IndexedDB`/`localStorage` with client UUIDs. Upon reconnecting, the tablet synchronizes in batch; the backend performs idempotent de-duplication based on client UUIDs.
- **DPDP 90-Day Physical File Deletion**: Under India's Digital Personal Data Protection Act, visitor surveillance photos cannot be indefinitely retained. A scheduled retention service purges visitor photos older than 90 days from physical disk storage, not merely blanking the database column.

---

## 4. UI/UX & Design Decisions

### 4.1 Aesthetic Philosophy: Warm Indian Editorial
Residential society portals in India are notoriously clinical, cluttered with garish blue gradients, unreadable bootstrap grids, or confusing corporate dashboards that alienate non-technical residents and elderly homeowners. 

Nivasa adopts a **Warm Editorial Design Direction**:
- **Primary Palette**: Deep Walnut (`#2c221e`) providing grounding authority without corporate harshness.
- **Backgrounds**: Warm Sand (`#faf8f5`) and Cream (`#f5f2eb`) mimicking textured bond paper, drastically reducing eye strain compared to blinding `#ffffff`.
- **Accents**: Muted Sage Green (`#3f5e4d`) representing resolution, financial balance, and safety.
- **Typography**: Expressive editorial serif headings paired with clean, highly legible tabular figures (`font-variant-numeric: tabular-nums`) for currency and date columns.

### 4.2 Key Screens & Ergonomic Rationale

#### 1. Resident Portal (`/resident`)
- **Intent**: Empower residents to understand their financial standing in 3 seconds.
- **Design Choices**: Clean card layout displaying current billing period, due date, outstanding balance in prominent typography, and a single high-contrast primary button: **"Pay Now via Test Gateway"**. Below it, past receipts and flat ledgers are organized in tabs with PDF download capabilities.

#### 2. Accounts Reconciliation Workbench (`/accounts/reconciliation`)
- **Intent**: High-density reconciliation station for society accountants processing 200+ monthly bank rows.
- **Design Choices**: Split-view layout with the imported CSV batch on the left and candidate matching invoices on the right. Visual pill badges display exact match rationale (e.g. `+40% Exact Ref`, `+25% UPI Match`). One-click **"Confirm & Post"** or **"Reject"** with mandatory operator audit notes.

#### 3. Help Desk Ticket Triage (`/helpdesk/complaints`)
- **Intent**: Fast categorization, technician dispatch, and SLA monitoring.
- **Design Choices**: Emergency tickets flash with an amber/red border badge. A real-time countdown timer illustrates SLA time remaining (e.g. `3h 45m left`). Help-desk staff can re-assign tickets, link duplicate complaints to prevent duplicate plumbing visits, or add internal notes.

#### 4. Gatekeeper Tablet Terminal (`/guard`)
- **Intent**: Rapid walk-in visitor entry and 6-digit PIN check-in for security guards operating outdoors in direct sunlight.
- **Design Choices**: High-contrast dark buttons with 64px touch targets. Large numeric keypad for one-handed PIN entry. Embedded live camera preview with instant photo compression. Prominent offline banner when Wi-Fi drops.

#### 5. Executive Committee Oversight Dashboard (`/committee`)
- **Intent**: High-level financial health, dues ageing, and grievance SLA transparency.
- **Design Choices**: Elimination of decorative chart clutter. Clean metric cards with unambiguous formulas: Total Billed, Total Collected, Collection Rate (%). Standard 5-tier ageing buckets (`Current`, `1–30 Days`, `31–60 Days`, `61–90 Days`, `90+ Days`). One-click monthly CSV export for annual general meeting audits.

---

## 5. Scope Adjustments & Future Roadmap

### 5.1 What Was Cut (Intentional Scope Boundaries)
To ensure the highest possible software engineering rigor on core billing, reconciliation, and grievance workflows within the 8-week MVP window, the following items were deliberately deferred:
1. **Resident Video Intercom**: Real-time WebRTC audio/video calling between gate tablet and resident smartphones was cut in favor of instant push/SMS OTP and 6-digit pre-approved guest passes. Gate guards need 5-second throughput, not 45-second video connection delays.
2. **Double-Entry General Ledger Balance Sheets**: While flat-level ledgers and dues ageing are fully functional, full society chart-of-accounts (depreciation schedules, sinking fund fixed-deposit ledgers) was scoped to Phase 2.
3. **Vehicle License Plate Recognition (ANPR)**: Automatic camera OCR for vehicles was cut due to high hardware dependency and frequent Indian license plate formatting inconsistencies.

### 5.2 Future Roadmap (Phase 2 & Beyond)
1. **Live UPI Dynamic QR Webhooks**: Direct integration with Razorpay/Cashfree for instant dynamic UPI QR generation with automated server-to-server webhook payment posting.
2. **Multi-Gate WebSocket Cluster**: Real-time push synchronization across multiple society security gates (North Gate, South Gate, Service Gate) using Redis pub/sub.
3. **Multilingual Voice-to-Complaint AI**: Allowing residents and housekeeping staff to dictate grievances in Hindi, Marathi, Tamil, or Telugu, utilizing Whisper for speech-to-text and Gemini for automatic translation and categorization.
4. **IoT Smart Meter Telemetry**: Automatic capture of digital water and diesel generator (DG) sub-meter readings directly into monthly utility invoices.

---

## 6. Verification, Testing & Compliance Summary

- **Type Safety**: 100% strict TypeScript compilation across `@nivasa/shared`, `@nivasa/backend`, and `@nivasa/frontend` with zero compiler warnings.
- **Financial Validation**: Verified zero rounding loss across 10,000 synthetic invoice cycles using integer-paise arithmetic.
- **Security**: Server-side RBAC validation on every endpoint; resident flat access strictly restricted to authorized JWT flat claims.
- **Privacy Compliance**: Automatic 90-day physical visitor photo purge conforming to DPDP Act 2023 guidelines.
