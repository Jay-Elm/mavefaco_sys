# Project Review — Cooperative Agricultural Marketplace

| | |
|---|---|
| **Prepared** | 2026-10-03 |
| **Commit reviewed** | `aba62ce` (`master`, deployed to `https://mavefaco-sys.vercel.app`) |
| **Scope** | Full read of application code, database schema, configuration, CI, and documentation |
| **Method** | Manual code review of every API route, shared library, validator, and key page/component; schema and config inspection; live checks of lint, type-check, build, unit and integration tests |
| **Code changes made during review** | None. H1, M1 and M5 were fixed afterwards on 2026-10-03; see the status column in [§9](#9-recommended-roadmap). |

## Contents

1. [Executive summary](#1-executive-summary)
2. [Health scorecard](#2-health-scorecard)
3. [System overview](#3-system-overview)
4. [Strengths](#4-strengths)
5. [Findings](#5-findings)
6. [Scope vs. use-case documents](#6-scope-vs-use-case-documents)
7. [Testing](#7-testing)
8. [Documentation and operations](#8-documentation-and-operations)
9. [Recommended roadmap](#9-recommended-roadmap)

**Severity key:** **High** — can cause a lockout, data loss, or security breach under realistic conditions. **Medium** — real defect with limited blast radius or requiring an unusual precondition. **Low** — hardening, accuracy, or consistency issue.

---

## 1. Executive summary

The project is in **good shape for a capstone**: a complete, working, deployed four-role marketplace whose security posture is well above typical student work — httpOnly cookie sessions with instant revocation, mandatory TOTP MFA for staff, encrypted MFA secrets, anti-enumeration responses — backed by a 167-test suite (32 unit, 135 integration against a real Postgres database) and CI on every push. Lint, type-check, build, and all tests are currently clean.

The review found **no critical issues**, **one high-priority operational risk** (rotating `JWT_SECRET` would permanently lock out every admin and manager), **six medium issues** concentrated in data handling (account deletion, ID-image cleanup, email change, deployment pipeline), and twelve low-severity items. The largest non-code gap is **documentation**: the README is still the framework template and the deployment guide is out of date.

## 2. Health scorecard

| Area | Rating | Basis |
|---|---|---|
| Functionality | ● Strong | All core flows work end to end for four roles |
| Security | ● Strong | Layered auth, MFA, input validation; 1 high + 3 medium items below |
| Code quality | ● Strong | Strict TypeScript, shared Zod schemas, 0 lint errors or warnings |
| Testing | ◐ Good | 167 tests; roughly half the API surface still untested |
| Data integrity | ◐ Good | Decimal money, race-safe stock, product archiving; 2 deletion issues |
| Operations | ◐ Fair | CI and Vercel deploys work; deployment-pipeline and key-rotation risks |
| Documentation | ○ Weak | Template README, stale deployment guide |

## 3. System overview

| Layer | Technology |
|---|---|
| Framework | Next.js 16.3.8 (App Router), React 19.3, TypeScript, Tailwind CSS 4 |
| Data | PostgreSQL via Prisma 7.10; Supabase (database, private ID-image bucket, public product-image bucket) |
| Authentication | JWT in httpOnly cookie, `tokenVersion` revocation, TOTP MFA (`otplib`), bcrypt |
| Email | Brevo transactional API |
| Hosting | Vercel, with a daily cron job (`/api/cron/purge-id-images`) |
| Validation | Zod schemas shared between client forms and API routes |

**Size:** ~15.7k lines of source · 16 models · 22 migrations · 53 API routes · 35 pages · 81 commits.

**Roles:** Admin > Manager > Farmer > Customer. Backend authorization consistently pairs admin and manager checks. `src/proxy.ts` (Next 16's replacement for Middleware) structurally guards every `/api/admin/*` request in front of each route's own checks.

## 4. Strengths

- **Authentication.** Session token lives in an httpOnly, SameSite=Lax cookie; `tokenVersion` revokes all sessions on logout, password change, email change, or admin reset; `getJwtSecret()` refuses a missing or short secret at first use; login, registration, forgot-password, and resend-verification all give identical responses whether or not an account exists.
- **Multi-factor authentication.** Mandatory for admin and manager. Secrets encrypted at rest (AES-256-GCM); backup codes bcrypt-hashed and single-use; anti-replay on TOTP steps and backup codes, including under concurrent requests; the pre-MFA "pending" token is short-lived and scoped to its purpose; admin-assisted recovery resets MFA without touching the password, so it cannot be used for a takeover.
- **File handling.** Image type is detected from the file's bytes, not the client's claim; SVG is excluded. Government IDs go to a private bucket, are viewable only through 5-minute signed URLs, and are purged automatically 30 days after verification under the Data Privacy Act (RA 10173).
- **Money and inventory.** Prices stored as `Decimal(10,2)`; order items snapshot the price at checkout; stock is decremented with a conditional update so the last unit cannot be sold twice; order-status transitions are enforced consistently across customer, farmer, and staff routes, and are race-safe.
- **Data lifecycle.** Products with order history, reviews, or crop logs are archived rather than deleted — hidden from every live surface but preserved in order history and reports — and staff can restore them.
- **Engineering hygiene.** Shared validators, explanatory comments that record *why*, security response headers, Dependabot with documented exclusions, and CI running the dependency audit plus both test suites against a Postgres service container.

## 5. Findings

### High

**H1 — Rotating `JWT_SECRET` permanently locks out all admins and managers.**

- **Location:** `src/lib/totpCrypto.ts`, `src/app/api/auth/mfa/verify/route.ts`
- **Detail:** The MFA encryption key is derived from `JWT_SECRET`. After a rotation, every stored TOTP secret fails to decrypt. The verify route decrypts the secret *before* it checks backup codes, so it returns 500 for every staff login — backup codes included. No admin can log in to perform a reset; recovery requires editing the database directly. Rotating this secret is a routine security action and was performed once already (September gap-list item 2, before MFA existed).
- **Recommendation:** Use a dedicated `TOTP_ENCRYPTION_KEY` (or support a previous-key fallback during rotation), and evaluate backup codes before attempting decryption.

### Medium

| # | Finding | Location | Impact |
|---|---|---|---|
| M1 | **ID-image deletions fail silently.** `deleteObject` catches only network errors and never checks the HTTP status, yet the database path is cleared regardless. | `api/cron/purge-id-images`, `api/users/me/id-image`, `lib/deleteAccount.ts` | A failed storage delete leaves a government ID image in the bucket with no database reference, defeating the RA 10173 retention purge. |
| M2 | **Deleting a farmer rewrites other customers' order history.** `deleteUserAccount` removes every order item for the farmer's products. | `lib/deleteAccount.ts` | Customers' delivered orders lose their line items (totals remain). |
| M3 | **Deleting a user erases their audit trail.** `auditLog.deleteMany({ where: { userId } })`. | `lib/deleteAccount.ts` | All recorded actions taken by the deleted account disappear, including staff actions. |
| M4 | **Email change has no verification and no notice.** The new address is not confirmed and the old address is not notified. | `api/users/me` (PATCH) | Anyone holding a session and the password can silently move the account to an address they control. |
| M5 | **Preview deployments may migrate the production database.** `npm run build` runs `prisma migrate deploy`, and `DIRECT_URL` was added to Vercel's Preview environment in September. | `package.json`, Vercel project settings | If Preview points at production, any pushed branch containing a migration alters production before review, and preview deployments read and write real data. **Requires verification in the Vercel dashboard.** |
| M6 | **User-supplied names are inserted into email HTML unescaped.** | `api/auth/register` and other email templates | Registering a stranger's address with an HTML "name" delivers attacker-controlled content inside a genuine MaVeFaCo email (phishing vector). |

### Low

| # | Finding | Location |
|---|---|---|
| L1 | Password-reset and email-verification tokens are checked and then marked used in separate statements, so two simultaneous requests can both consume one link (same pattern fixed in MFA on 2026-10-03). | `api/auth/reset-password`, `api/auth/verify-email` |
| L2 | The Content-Security-Policy is Report-Only with no `report-uri`/`report-to`, so it collects nothing; enforcing it as written would block the weather widget (`connect-src 'self'` vs. `api.open-meteo.com`). | `next.config.ts` |
| L3 | No maximum length on free-text inputs (names, messages, reviews, descriptions, site content). | `src/validators/*` |
| L4 | Rate limiting is in-memory per serverless instance, so limits are not strict across instances (acknowledged in code). | `src/lib/rateLimit.ts` |
| L5 | Any authenticated user, including customers, can upload to the public product-image bucket; orphaned uploads are never cleaned up. | `api/upload` |
| L6 | Category, announcement, banner, FAQ, and site-content changes are not written to the audit log; the audit view returns only the latest 100 entries without paging or filtering. | Various admin routes; `api/admin/audit-logs` |
| L7 | Report accuracy: months are bucketed in UTC rather than Philippine time; "units sold" includes cancelled and pending orders; product counts include archived products. | `api/admin/reports` |
| L8 | No database indexes on foreign keys or common filters (`farmerId`, `customerId`, `status`, `approved`, …). Acceptable at current scale. | `prisma/schema.prisma` |
| L9 | Category deletion counts archived products, so it can refuse with "N products still use this category" when none are visible. | `api/categories/[id]` |
| L10 | The farmer advisory shows all farmers' pest/damage notes, including names of unapproved products. Anonymous, and possibly intended. | `api/farmer/advisory` |
| L11 | Inconsistent branding: **CoopMarket** in the UI, page title, and authenticator-app label (12 files) vs. **MaVeFaCo** in all emails (6 files). | Site-wide |
| L12 | A few storefront elements still use default Tailwind greens rather than the brand tokens (e.g., the cart page's login prompt). | `app/cart/page.tsx` |

## 6. Scope vs. use-case documents

The eight core use cases agreed earlier in the project are all implemented. The four `*_USE_CASE.md` files describe a broader vision; the principal items **not implemented** are:

| Role | Not implemented |
|---|---|
| Customer | Favorite sellers, reorder, invoice download, product comparison, "report a problem", in-app notifications |
| Farmer | Market prices and price trends, demand/supply alerts, AI-translated advisory (current advisory lists raw logs), spoilage and low-stock alerts |
| Manager | Supply forecasting, pricing guidance, harvest scheduling, meetings/trainings, farmer-membership approval (only admins verify farmer IDs) |
| Admin | Dispute and complaint handling, backup/restore, buyer-registration approval, suspicious-activity monitoring |
| Payments | GCash and bank transfer are selectable labels only — no payment-provider integration; every order is effectively cash on delivery |

It is worth stating this scope boundary explicitly in the capstone documentation and defense.

## 7. Testing

| Suite | Command | Tests | Coverage |
|---|---|---|---|
| Unit | `npm test` | 32 | Validators, JWT secret/verification, role authorization, safe-URL checks |
| Integration | `npm run test:integration` | 135 | Orders (checkout and status), admin user management, login/logout, full MFA flow, products (including archive and restore), reviews, messages |

Integration tests run against a dedicated `*_test` Postgres database, guarded against ever touching a non-local or non-test database. Race-condition tests force genuine overlap with a row lock (`withRowLocked`), and each was confirmed to fail without its fix. On 2026-10-03 the suite surfaced **10 real defects, all since fixed**.

**Not yet covered:** registration, email verification, forgot/reset password, categories, announcements, banners, FAQs, site content, stats and reports, audit logs, ID-image routes, the purge cron job, crop monitoring and advisory, order-list endpoints, and `users/me`. There are **no UI or end-to-end tests**.

## 8. Documentation and operations

| Item | Status |
|---|---|
| `README.md` | **Unmodified create-next-app template** — no project description, setup, environment variables, or architecture. |
| `DEPLOYMENT.md` | **Stale.** Still describes the JWT as stored in `localStorage`; documents only 2 of the 7 required environment variables (missing `DIRECT_URL`, `BREVO_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`). |
| `DEVELOPMENT_STATUS.md`, `WHERE_WE_LEFT_OFF.md` | Current. |
| `SECURITY_REVIEW.md` | Accurate through 2026-09-08; later work is recorded in `DEVELOPMENT_STATUS.md`. |
| Dependencies | `npm audit` reports 4 high findings, all inside Prisma's CLI tooling (`deepmerge-ts`, `mysql2`), unused at runtime. Resolved by Prisma 8, currently at release candidate (`8.0.0-rc.19`). Do not apply npm's suggested downgrade to Prisma 6. |
| Not verified | Supabase backup / point-in-time-recovery coverage on the current plan; whether Vercel Preview uses the production database (M5). |

## 9. Recommended roadmap

| Priority | Action | Effort |
|---|---|---|
| **1 — Immediate** | Fix H1: separate MFA encryption key from `JWT_SECRET`; check backup codes before decrypting | Small — **done**; requires setting `TOTP_ENCRYPTION_KEY` in Vercel |
| | Verify M5 in Vercel; give Preview its own database or skip migrations on Preview builds | Small — **migrations skipped on Preview**; Preview's `DATABASE_URL` still to verify |
| | Fix M1: check the storage response and clear the database path only on success | Small — **done** |
| **2 — Before defense** | Rewrite `README.md`; update `DEPLOYMENT.md` | Small |
| | Settle on one brand name (L11) | Small |
| | M2/M3: anonymize deleted users instead of deleting their history | Medium |
| | M4/M6: verify new email addresses, notify the old address, escape email HTML | Medium |
| **3 — Hardening** | L1 single-use tokens, L3 length limits, L6 audit coverage, L7 report accuracy | Small each |
| | Integration tests for the remaining public routes (registration, password reset) | Medium |
| | Enforce CSP with nonces and a reporting endpoint (L2) | Medium |
| **4 — Later** | Shared rate-limit store (e.g., Upstash Redis), database indexes, Prisma 8 upgrade, end-to-end UI tests | Medium |
