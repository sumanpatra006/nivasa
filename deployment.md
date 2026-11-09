# Nivasa — Deployment & Local Setup Guide

> **GitHub Repository:** [https://github.com/sumanpatra006/nivasa.git](https://github.com/sumanpatra006/nivasa.git)  
> **Live Web Application:** _Deployable via Vercel (Frontend) & Render / Railway (Backend) with Neon PostgreSQL_

---

## 1. How to Run Locally (Step by Step)

### Prerequisites
- **Node.js**: v20.x or higher
- **npm**: v10.x or higher
- **PostgreSQL**: Neon DB cloud database or local PostgreSQL 15+

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/sumanpatra006/nivasa.git
cd nivasa
```

---

### Step 2: Install Dependencies
This project is configured as an npm workspaces monorepo (`@nivasa/shared`, `@nivasa/backend`, `@nivasa/frontend`):
```bash
npm install
```

---

### Step 3: Configure Environment Variables

#### Backend Configuration: `apps/backend/.env`
Create or edit `apps/backend/.env` with the following keys:
```env
# Database Connection (Neon PostgreSQL or local PostgreSQL)
DATABASE_URL="postgresql://<USER>:<PASSWORD>@<HOST>/<DB_NAME>?sslmode=require"

# Server Configuration
PORT=3001
NODE_ENV=development

# Authentication & Security
JWT_SECRET="your-secure-jwt-secret-key-at-least-32-chars"

# Optional: Telecom SMS OTP Delivery (Falls back to Console/Structured Log Gateway in Dev)
# FAST2SMS_API_KEY=""
# TWILIO_ACCOUNT_SID=""
# TWILIO_AUTH_TOKEN=""
# TWILIO_PHONE_NUMBER=""

# Optional: Google Gemini AI Adapter (Falls back to deterministic rule engine if omitted)
# GEMINI_API_KEY=""
```

#### Frontend Configuration: `apps/frontend/.env`
Create or edit `apps/frontend/.env`:
```env
VITE_API_BASE_URL="http://localhost:3001"
```

---

### Step 4: Synchronize Database Schema & Seed Data
Generate the Prisma Client and push schema directly to PostgreSQL:
```bash
# Push schema to PostgreSQL database
npm run db:push -w @nivasa/backend

# Seed database with realistic flats, accounts, residents, staff, and amenities
npm run db:seed -w @nivasa/backend
```

---

### Step 5: Start the Development Servers
Run the full monorepo concurrently:
```bash
npm run dev
```

The services will start at:
- **Frontend Web Application:** [http://localhost:5173](http://localhost:5173)
- **Backend API & Swagger/REST:** [http://localhost:3001/api/v1](http://localhost:3001/api/v1)
- **Health Check Endpoint:** [http://localhost:3001/api/v1/health](http://localhost:3001/api/v1/health)

---

## 2. Reviewer Demo Login Credentials

The application provides a 1-click **"Quick Demo Login"** on the login screen (`/login`), as well as real SMS OTP authentication.

| Role | Name | Phone Number | Unit / Scope | Default Dev OTP | Permissions & Capabilities |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Resident** | Neeraj Kulkarni | `9820000001` | Flat T07-1203 | `123456` | Maintenance billing, test payment flow, official receipts, flat ledger, raise complaints, generate visitor guest passes, book amenities. |
| **Resident** | Swati Joshi | `9820000002` | Flat T12-0408 | `123456` | Multi-flat resident view, outstanding dues tracking, dispute complaints. |
| **Accounts** | Priya Sundaram | `9820000010` | Finance Office | `123456` | Bank CSV statement upload, 7-tier deterministic matching queue, candidate invoices, ledger posting, dues ageing analysis. |
| **Help Desk** | Ramesh Patil | `9820000020` | Facilities Support | `123456` | Ticket triage, AI classification review, duplicate complaint linking, technician assignment, status transition SLA tracking. |
| **Committee**| Sunita Rao | `9820000030` | Management Board | `123456` | High-level financial KPIs, collection percentage, dues ageing buckets, complaint SLA resolution metrics, monthly CSV reporting. |
| **Gate Guard**| Vikram Singh | `9820000040` | Main Gate Tablet | `123456` | Touchscreen 6-digit keypad, visitor registration, webcam/photo capture, offline sync queue, check-in / check-out logging. |

> **OTP Behavior:**
> When logging in via phone, if an SMS gateway (`FAST2SMS_API_KEY` or `TWILIO_*`) is configured, a real SMS is dispatched to the phone. In local/development mode, the generated 6-digit code is securely output to the backend console log, and `123456` is accepted for quick automated testing.

---

## 3. How the Application is Deployed

The application is architected for zero-downtime, cloud-native hosting across modern platforms:

```
                  ┌────────────────────────────────────────┐
                  │          Vercel / Netlify              │
                  │   (Vite SPA Client - Edge CDN)         │
                  └──────────────────┬─────────────────────┘
                                     │ HTTPS / REST
                                     ▼
                  ┌────────────────────────────────────────┐
                  │      Render / Railway / Fly.io         │
                  │   (Node.js + Express API Backend)      │
                  └──────────────────┬─────────────────────┘
                                     │ Connection Pool (SSL)
                                     ▼
                  ┌────────────────────────────────────────┐
                  │          Neon PostgreSQL               │
                  │      (Serverless PostgreSQL 16)        │
                  └────────────────────────────────────────┘
```

### Production Environment Variables (Names Only)

#### Backend (`Render` / `Railway` / `Docker`)
- `DATABASE_URL` *(Connection pooling URL from Neon with `sslmode=require`)*
- `DIRECT_URL` *(Direct connection URL for database migrations)*
- `PORT`
- `NODE_ENV`
- `JWT_SECRET`
- `FAST2SMS_API_KEY` *(Optional)*
- `TWILIO_ACCOUNT_SID` *(Optional)*
- `TWILIO_AUTH_TOKEN` *(Optional)*
- `TWILIO_PHONE_NUMBER` *(Optional)*
- `GEMINI_API_KEY` *(Optional)*

#### Frontend (`Vercel` / `Netlify`)
- `VITE_API_BASE_URL` *(Points to production backend URL, e.g., `https://nivasa-api.onrender.com`)*

---

## 4. Step-by-Step Production Deployment Guide

### Option A: Database on Neon (PostgreSQL)
1. Sign up at [neon.tech](https://neon.tech) and create a project named `nivasa`.
2. Copy the **Pooled Connection String** from the Neon dashboard.
3. Keep this connection string ready for your backend environment.

---

### Option B: Backend Deployment on Render / Railway

#### Using Render:
1. Create a free account on [render.com](https://render.com).
2. Click **New +** → **Web Service** and connect the GitHub repository `https://github.com/sumanpatra006/nivasa.git`.
3. Configure settings:
   - **Root Directory:** leave empty (monorepo root).
   - **Environment:** `Node`.
   - **Build Command:**
     ```bash
     npm install && npm run build -w @nivasa/shared && npm run build -w @nivasa/backend && npx prisma db push --schema=apps/backend/prisma/schema.prisma
     ```
   - **Start Command:**
     ```bash
     npm run start -w @nivasa/backend
     ```
4. Under **Environment Variables**, add:
   - `DATABASE_URL` = *(Your Neon database connection string)*
   - `NODE_ENV` = `production`
   - `PORT` = `10000`
   - `JWT_SECRET` = *(Generate a 32-character random string)*
5. Click **Create Web Service**. Once deployed, copy your backend URL (e.g. `https://nivasa-backend.onrender.com`).

---

### Option C: Frontend Deployment on Vercel

1. Create a free account on [vercel.com](https://vercel.com).
2. Click **Add New Project** and import `https://github.com/sumanpatra006/nivasa.git`.
3. Configure project settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** click Edit and select `apps/frontend`.
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
4. Under **Environment Variables**, add:
   - `VITE_API_BASE_URL` = *(Your backend production URL, e.g. `https://nivasa-backend.onrender.com`)*
5. Click **Deploy**. Vercel will build and assign a global CDN URL (e.g. `https://nivasa.vercel.app`).

---

## 5. Verification & Health Monitoring

Once deployed:
1. Open `https://<YOUR_BACKEND_DOMAIN>/api/v1/health` — it should return:
   ```json
   {
     "status": "ok",
     "service": "nivasa-backend",
     "database": "connected",
     "timestamp": "2026-11-09T18:00:00.000Z"
   }
   ```
2. Open `https://<YOUR_FRONTEND_DOMAIN>/login` and click **"Quick Demo Login"** as Resident or Committee Member.
3. Test a payment flow or gate visitor check-in to confirm end-to-end database writes.
