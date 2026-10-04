# MaVeFaCo Marketplace

**Mayon Vegetable Farmers Agriculture Cooperative (MaVeFaCo)** — an online marketplace that lets the cooperative's member farmers in Albay sell fresh produce directly to customers, while cooperative staff manage listings, orders, members, and content.

**Live:** https://mavefaco-sys.vercel.app

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Security](#security)
- [Deployment](#deployment)
- [Documentation](#documentation)

## Features

The app has four roles, from most to least privileged: **Admin**, **Manager**, **Farmer**, and **Customer**.

| Role | What they can do |
|---|---|
| **Customer** | Browse, search, and filter the shop; view farmer profiles; keep a cart; check out (choose cash on delivery, GCash, or bank transfer — payment is settled outside the app — and pickup or delivery); track, cancel, and confirm orders; review products from delivered orders; message farmers |
| **Farmer** | Submit their ID for verification; list products (each reviewed by staff before going live); manage stock and prices; fulfil orders; monitor crops (planting and harvest dates, growth stage, pest/weather/damage logs); see a shared pest and weather advisory and a local weather widget |
| **Manager** | Approve or reject listings and restore archived ones; move orders through their lifecycle; manage categories and announcements; verify farmer IDs; suspend customers and farmers; view reports and farmer performance |
| **Admin** | Everything a manager can do, plus deleting accounts, resetting passwords and two-factor authentication, overriding order status, the audit log, homepage banners, FAQs, and site content |

Admin and manager accounts must use an authenticator app (two-factor authentication) to sign in.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL via [Prisma 7](https://www.prisma.io) |
| Hosting | Vercel (app and daily cron job), Supabase (Postgres and file storage) |
| Email | Brevo |
| Validation | Zod, shared between forms and API routes |
| Testing | Vitest — unit tests, plus integration tests against a real Postgres database |

## Getting started

### Prerequisites

- **Node.js 24**
- **PostgreSQL** running locally (16 or newer)

### 1. Install

```bash
cd client
npm ci
```

### 2. Configure

Create `client/.env` (it is git-ignored). For local development both database URLs can point at the same local database:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/capstone_db"
DIRECT_URL="postgresql://USER:PASSWORD@localhost:5432/capstone_db"
JWT_SECRET="<at least 32 random characters>"
TOTP_ENCRYPTION_KEY="<at least 32 random characters>"

# Optional locally — the related features fail gracefully without them
BREVO_API_KEY=""              # emails (verification, password reset)
SUPABASE_URL=""               # image uploads and ID verification
SUPABASE_SERVICE_ROLE_KEY=""
CRON_SECRET=""                # the ID-image purge job
```

Generate random secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

See [`client/DEPLOYMENT.md`](client/DEPLOYMENT.md#environment-variables-reference) for what every variable does in production.

### 3. Set up the database

```bash
npx prisma migrate deploy
```

The generated Prisma client is committed in `client/generated/`; run `npx prisma generate` after changing `prisma/schema.prisma`.

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000.

### Creating the first admin

Sign-up only offers the customer and farmer roles, so staff accounts are promoted directly in the database:

1. Register normally at `/register`.
2. Without `BREVO_API_KEY` no verification email is sent, so mark the email verified yourself.
3. Promote the account:

```sql
UPDATE "User"
SET role = 'admin', "emailVerifiedAt" = NOW()
WHERE email = 'you@example.com';
```

On the next login you will be asked to set up two-factor authentication with an authenticator app, and shown one-time backup codes to keep safe.

## Testing

All commands run from `client/`.

| Command | What it runs |
|---|---|
| `npm test` | Unit tests — validators, authentication helpers, encryption. No database needed. |
| `npm run test:integration` | Integration tests that call the API route handlers against a real Postgres database |
| `npx eslint .` | Lint |
| `npx tsc --noEmit` | Type-check |

**Integration tests** use a separate database named after your dev database with a `_test` suffix (for example `capstone_db_test`), created and migrated automatically on first run and emptied before every test. They refuse to run against any database that isn't on `localhost` or whose name doesn't end in `_test`. Set `TEST_DATABASE_URL` to use a different one.

GitHub Actions runs both suites on every push and pull request (`.github/workflows/test.yml`), alongside a dependency audit.

## Project structure

```
.
├── .github/              CI workflows and Dependabot configuration
└── client/               The Next.js application
    ├── prisma/           Database schema and migrations
    ├── generated/        Generated Prisma client (committed)
    ├── scripts/          Build helpers (migrations on deploy)
    └── src/
        ├── app/          Pages and API routes (App Router)
        │   ├── api/      REST endpoints, grouped by area
        │   ├── dashboard/    Admin and manager console
        │   ├── farmer/       Farmer portal
        │   └── customer/     Customer orders, messages, profile
        ├── components/   Shared UI components
        ├── contexts/     Auth and cart state
        ├── lib/          Server utilities (auth, MFA, email, storage, rate limiting)
        ├── validators/   Zod schemas shared by forms and API routes
        ├── proxy.ts      Per-request CSP nonce; guard for /api/admin/*
        └── test-utils/   Integration-test helpers
```

## Security

- Sessions live in an `httpOnly`, `SameSite=Lax` cookie and can be revoked instantly (logout, password or email change, admin reset).
- Mandatory two-factor authentication for admins and managers; authenticator secrets are encrypted at rest and codes can't be reused.
- Login, registration, and password-reset responses don't reveal whether an account exists.
- An enforced Content-Security-Policy: scripts only run if they carry a per-request nonce, so injected scripts are blocked.
- Uploaded images are checked by their actual file contents; government IDs are kept in a private bucket, viewable only through 5-minute links, and deleted automatically 30 days after verification (Data Privacy Act, RA 10173).
- Stock and order-status changes are race-safe; products with sales history are archived rather than deleted.

Full history: [`client/SECURITY_REVIEW.md`](client/SECURITY_REVIEW.md) and [`client/PROJECT_REVIEW.md`](client/PROJECT_REVIEW.md).

## Deployment

The app deploys to Vercel from `master`. The build (`npm run build`) applies pending database migrations on Production deploys, then builds the app. Preview deployments use their own separate database. Step-by-step instructions and the full environment-variable reference are in [`client/DEPLOYMENT.md`](client/DEPLOYMENT.md).

## Documentation

| Document | Contents |
|---|---|
| [`client/SCOPE_AND_DELIMITATIONS.md`](client/SCOPE_AND_DELIMITATIONS.md) | What the system covers, item by item against the use cases, and the boundaries it stays within |
| [`client/DEVELOPMENT_STATUS.md`](client/DEVELOPMENT_STATUS.md) | Current features, API reference, data model, known technical debt |
| [`client/PROJECT_REVIEW.md`](client/PROJECT_REVIEW.md) | Whole-project review: findings and roadmap |
| [`client/SECURITY_REVIEW.md`](client/SECURITY_REVIEW.md) | Security review and fixes (through September 2026) |
| [`client/DEPLOYMENT.md`](client/DEPLOYMENT.md) | Deployment guide and environment variables |
| [`client/WHERE_WE_LEFT_OFF.md`](client/WHERE_WE_LEFT_OFF.md) | Recent work log |
| `client/*_USE_CASE.md` | Original use-case lists for each role ([Admin](client/ADMIN_USE_CASE.md), [Manager](client/MANAGER_USE_CASE.md), [Farmer](client/FARMER_USE_CASE.md), [Customer](client/CUSTOMER_USE_CASE.md)) |
