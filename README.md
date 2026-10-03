# Next.js + NestJS + Prisma + Cloud Database Starter Boilerplate

A clean, minimalist, full-stack starter boilerplate featuring **Next.js (App Router)** on the frontend, **NestJS** on the backend, **Prisma ORM** connected to a **Cloud PostgreSQL Database**, and **Role-Based Access Control (RBAC)**.

---

## ⚡ The Stack (Mandatory & Modern)

| Layer        | Technology                   | Key Features                                                                  |
| ------------ | ---------------------------- | ----------------------------------------------------------------------------- |
| **Frontend** | **Next.js 14+ (App Router)** | React 18, Sleek Dark Glassmorphism, Auth Provider Context, Role-Guarded UI    |
| **Backend**  | **NestJS**                   | Modular Architecture, Passport JWT Authentication, RolesGuard, ValidationPipe |
| **ORM**      | **Prisma**                   | Type-safe queries, automatic migrations, seed scripts                         |
| **Database** | **Cloud PostgreSQL**         | Neon (Recommended) / Supabase / Railway / Render                              |

---

## 🚀 Key Features

- **Simple Authentication**:
  - `POST /auth/register` — Register user with email, password, and role (`USER` or `ADMIN`).
  - `POST /auth/login` — Authenticate and receive a JWT token.
  - `POST /auth/logout` — Instant session termination.
  - `GET /auth/me` — Protected endpoint returning the authenticated user profile.
- **Role-Based Access Control (RBAC)**:
  - Role enum: `USER` and `ADMIN`.
  - Protected endpoint `GET /auth/admin-only` demonstrates route guarding via `@Roles('ADMIN')`.
  - Frontend dashboard includes interactive test buttons to demonstrate permitted access for Admins and 403 Forbidden for standard users.
- **Cloud Database Ready**:
  - Configured for SSL-enabled cloud databases like Neon or Supabase out-of-the-box.
  - No local database installation required.
- **Company Billing**:
  - Confirmed billable orders can be included in one company invoice only.
  - Invoice totals use integer minor units and invoices can be marked paid.
  - An order on an unpaid invoice must be removed before financial changes; paid invoices are financially immutable.
- **Kitchen Settings**:
  - Admins can edit the kitchen timezone, cutoff time, cutoff working-day count, working weekdays, and holidays from `/dashboard/settings`.
  - Cutoff calculations read these persisted settings as their single source of truth.

---

## ☁️ Setting Up Your Free Cloud Database (Takes 1 Minute)

### Option 1: Neon Serverless Postgres (Recommended)

1. Go to [https://neon.tech](https://neon.tech) and sign up (free, no credit card required).
2. Click **Create Project** (choose your nearest region).
3. Copy your Connection String (`postgresql://neondb_owner:***@ep-***.neon.tech/neondb?sslmode=require`).
4. Paste it into `backend/.env` as `DATABASE_URL`.

### Option 2: Supabase

1. Go to [https://supabase.com](https://supabase.com) and create a free project.
2. In Project Settings → Database, copy the URI connection string.
3. Paste it into `backend/.env` as `DATABASE_URL`.

---

## 🛠️ Quickstart (Running Locally)

### 1. Install Dependencies

In the root directory, run:

```bash
npm run install:all
```

_(Or install each folder: `npm install` in root, `backend/`, and `frontend/`)_

### 2. Configure Environment Variables

- In `backend/.env`:
  ```env
  PORT=3001
  FRONTEND_URL=http://localhost:3000
  JWT_SECRET=your_jwt_secret_key_12345
  DATABASE_URL="YOUR_CLOUD_POSTGRES_CONNECTION_URL"
  ```
- In `frontend/.env.local`:
  ```env
  NEXT_PUBLIC_API_URL=http://localhost:3001
  ```

### 3. Sync Database Schema & Seed Demo Users

Push your Prisma schema to your cloud database and run the seed script:

```bash
npm run db:push
npm run db:seed
```

### 4. Start the Application

Run both backend and frontend concurrently:

```bash
npm run dev
```

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:3001](http://localhost:3001)
- **Health Check**: [http://localhost:3001/health](http://localhost:3001/health)

---

## 🔑 Demo Test Accounts

The seed script creates two pre-configured accounts to test RBAC immediately:

| Role      | Email               | Password    | Allowed Endpoints                               |
| --------- | ------------------- | ----------- | ----------------------------------------------- |
| **ADMIN** | `admin@starter.dev` | `Admin123!` | `/auth/me`, `/auth/admin-only` (All)            |
| **USER**  | `user@starter.dev`  | `User123!`  | `/auth/me` (Restricted from `/auth/admin-only`) |

_Tip: On the `/login` page, you can use the **1-Click Demo Fill** buttons to test without typing._

---

## 🌐 Live Deployment Guide

### 1. Database (Cloud)

- Use **Neon** or **Supabase** (Already live from the steps above).

### 2. Backend Deployment (Render / Railway / Fly.io)

1. Push this repository to GitHub.
2. Create a new Web Service on [Render](https://render.com) or [Railway](https://railway.app).
3. Set **Root Directory** to `backend`.
4. Build Command: `npm install && npm run prisma:generate && npm run build`
5. Start Command: `npm run start:prod`
6. Add Environment Variables:
   - `DATABASE_URL`: Your cloud database URL.
   - `JWT_SECRET`: A secure random string.
   - `FRONTEND_URL`: Your deployed frontend domain (e.g. `https://your-frontend.vercel.app`).
   - `PORT`: `3001` (or let provider assign).

### 3. Frontend Deployment (Vercel)

1. Import your GitHub repository into [Vercel](https://vercel.com).
2. Set **Root Directory** to `frontend`.
3. Add Environment Variable:
   - `NEXT_PUBLIC_API_URL`: Your deployed backend URL (e.g. `https://your-backend.onrender.com`).
4. Click **Deploy**.

---

## 📁 Project Structure

```text
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Prisma User model & Role enum
│   │   └── seed.ts             # Pre-seeds Admin and User demo accounts
│   ├── src/
│   │   ├── auth/
│   │   │   ├── decorators/     # @Roles() decorator
│   │   │   ├── dto/            # RegisterDto, LoginDto (class-validator)
│   │   │   ├── guards/         # JwtAuthGuard, RolesGuard
│   │   │   ├── strategies/     # Passport JWT Strategy
│   │   │   ├── auth.controller.ts  # /auth/register, /auth/login, /auth/logout, /auth/me, /auth/admin-only
│   │   │   ├── auth.module.ts
│   │   │   └── auth.service.ts
│   │   ├── prisma/             # Global PrismaService & PrismaModule
│   │   ├── app.module.ts       # Health checks and root routes
│   │   └── main.ts             # CORS, global validation pipe, bootstrap
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── dashboard/page.tsx # Authenticated dashboard with live RBAC test
│   │   │   ├── login/page.tsx     # Sign in with 1-click test fill
│   │   │   ├── register/page.tsx  # Sign up with role selector
│   │   │   ├── globals.css        # Clean glassmorphic design system
│   │   │   ├── layout.tsx         # Navbar and AuthProvider wrapper
│   │   │   └── page.tsx           # Landing page with health monitor
│   │   ├── components/            # Navbar, UI elements
│   │   ├── context/               # AuthContext (JWT management)
│   │   ├── lib/                   # API client fetch wrapper
│   │   └── types/                 # User and Auth response definitions
│   └── .env.example
└── README.md
```

---

## 📝 API Endpoints Summary

| Method | Endpoint           | Description                               | Auth Required      |
| ------ | ------------------ | ----------------------------------------- | ------------------ |
| `GET`  | `/health`          | Server and Database connectivity check    | No                 |
| `POST` | `/auth/register`   | Register a new user                       | No                 |
| `POST` | `/auth/login`      | Login with email & password (returns JWT) | No                 |
| `POST` | `/auth/logout`     | Logout (clears session)                   | No                 |
| `GET`  | `/auth/me`         | Get current user profile                  | Yes (Bearer Token) |
| `GET`  | `/auth/admin-only` | Restricted to `ADMIN` role                | Yes (Admin Role)   |
