# Where We Left Off

_Updated: 2026-10-05_

## Current state

Feature-complete for the capstone scope and through three structured hardening passes. Everything is merged to `master` and deployed to production; nothing is mid-flight.

1. **Phase 1–3 security review** (completed 2026-09-08, `SECURITY_REVIEW.md`): cookie-based sessions, admin-route guard, private ID storage, password reset, shared validators, email verification.
2. **10-item gap list** (completed 2026-09-21): Next.js CVE patches, JWT secret validation, `Decimal` money, connection pooling, Dependabot + CI audit, mandatory TOTP MFA for staff, ID-image auto-purge, no email enumeration.
3. **Whole-project review and fixes** (2026-10-03 to 2026-10-05, `PROJECT_REVIEW.md`): every finding fixed except L4. Highlights:
   - **Integration tests** against a real Postgres database (`npm run test:integration`, 183 tests) covering orders, auth, MFA, products, reviews, messages, admin users, content, reports, cron; 54 unit tests. Both suites run in CI. The tests found and drove fixes for 10+ real bugs (stock double-restock, MFA code reuse under concurrency, products with history undeletable, …).
   - **MFA encryption key** separated from `JWT_SECRET` (`TOTP_ENCRYPTION_KEY`); all staff migrated.
   - **Preview deployments** have their own Supabase database and keys; Preview builds migrate only that database (`PREVIEW_DATABASE_ISOLATED`).
   - **Product archiving** (and staff restore) instead of deleting products with history.
   - **Account deletion anonymizes** instead of erasing orders and audit history.
   - **Email changes** must be confirmed from the new address; old address notified.
   - **Email bodies HTML-escape** user values (`emailHtml`).
   - **Enforced nonce-based Content-Security-Policy** (`src/proxy.ts`, `src/lib/csp.ts`); every page renders per request.
   - Input length limits, audit logging of content changes with paging, report accuracy, 16 database indexes, single-use reset/verification links.
   - Rebranded to **Mayon Vegetable Farmers Agriculture Cooperative (MaVeFaCo)**; README rewritten at the repo root; brand colors across all portals; lint at 0 errors and 0 warnings.
4. **Scope** is documented item by item in `SCOPE_AND_DELIMITATIONS.md` (129 use-case items: 80 implemented, 19 partial, 30 not implemented).

---

## Open items

**Manual checks still to do** (all covered by automated tests; these confirm the screens and real email delivery with logged-in test accounts):

1. Change a test customer's email: notice at the old address, link at the new one, logged out after clicking, final notice to the old address (only test of real Brevo delivery).
2. Cancel an order as a farmer and as a manager: stock goes back up exactly once.
3. Delete a product with a past order, find it under **Archived** on the dashboard Products page, restore it.
4. Cart survives logout/login; profile page shows name and email.
5. On a phone-sized screen, menus close after tapping a link.
6. As admin, "Reset 2FA" appears on other admins and managers with 2FA enabled.
7. The farmer portal shows the brand colors (the manager dashboard was confirmed).

**Remaining debt** (see `DEVELOPMENT_STATUS.md` → Known Technical Debt): per-instance rate limiting (L4, needs Upstash Redis credentials from the project owner), Prisma 8 upgrade when released (clears the last 4 `npm audit` findings), no UI/end-to-end tests.

**Optional:** staff can rename their authenticator entry from "CoopMarket" to "MaVeFaCo"; Vercel's Preview toolbar can be turned off if its CSP violations clutter the logs.

---

## File map (quick reference)

```
src/app/
  page.tsx                              ← home: hero + banners + announcements + featured products
  login/page.tsx                        ← handles MFA branching (mfaRequired / mfaSetupRequired)
  register/page.tsx
  verify-email/page.tsx                 ← confirms emailVerifiedAt via emailed link
  confirm-email-change/page.tsx         ← applies an email change from the link sent to the new address
  forgot-password/page.tsx
  reset-password/page.tsx
  about/page.tsx                        ← cooperative info, FAQ accordion, contact (public)
  products/page.tsx                     ← listing with category/search/price filters
  products/[id]/page.tsx                ← detail + Add to Cart + ReviewsSection
  sellers/[id]/page.tsx                 ← public seller profile

  dashboard/                            ← admin + manager
    layout.tsx
    page.tsx                            ← stat cards + farmer performance (manager)
    users/page.tsx                      ← includes signed-URL ID image view
    categories/page.tsx
    products/page.tsx                   ← approve/revoke/edit/delete + CSV export
    orders/page.tsx                     ← status management + CSV export
    audit-logs/page.tsx
    announcements/page.tsx
    reports/page.tsx                    ← sales/crop/user/farmer tabs + CSV + print
    site/page.tsx                       ← admin-only: banners / cooperative info / FAQs

  cart/page.tsx                         ← cart + checkout (payment/delivery method)

  customer/
    orders/page.tsx                     ← order history; Cancel (pending) + Confirm (shipped)
    profile/page.tsx                    ← edit name/email/password + self-delete
    messages/page.tsx                   ← inbox with unread counts
    messages/[userId]/page.tsx          ← message thread

  farmer/
    layout.tsx                          ← green sidebar
    page.tsx                            ← overview: stats + stock alerts + weather + advisory
    products/page.tsx                   ← table with StockBadge + alert banner
    products/new/page.tsx
    products/[id]/edit/page.tsx
    orders/page.tsx
    crops/page.tsx                      ← crop monitor table
    crops/[id]/page.tsx                 ← crop detail + log entries
    messages/page.tsx                   ← farmer inbox
    messages/[userId]/page.tsx          ← message thread
    profile/page.tsx                    ← edit info + real ID-image upload + password change

  api/
    auth/login/route.ts                 ← branches into MFA pending-cookie flow for admin/manager
    auth/logout/route.ts
    auth/register/route.ts              ← anti-enumeration, sends verification email
    auth/verify-email/route.ts
    auth/resend-verification/route.ts
    auth/forgot-password/route.ts
    auth/reset-password/route.ts
    auth/mfa/setup/route.ts
    auth/mfa/confirm/route.ts
    auth/mfa/verify/route.ts
    auth/confirm-email-change/route.ts  ← single-use token; switches email, logs out everywhere
    csp-report/route.ts                 ← logs CSP violation reports (rate-limited)
    products/route.ts
    products/[id]/route.ts
    products/[id]/reviews/route.ts      ← GET (public), POST (delivered customer)
    products/[id]/reviews/[reviewId]/route.ts  ← DELETE
    categories/route.ts
    categories/[id]/route.ts
    users/me/route.ts                   ← GET, PATCH, DELETE (self-service account deletion)
    users/me/id-image/route.ts          ← POST/DELETE, private bucket upload
    upload/route.ts                     ← shared image-upload endpoint
    orders/route.ts                     ← POST (place order)
    customer/orders/route.ts            ← GET
    customer/orders/[id]/route.ts       ← PATCH (cancel / confirm received)
    admin/stats/route.ts
    admin/users/route.ts
    admin/users/[id]/route.ts
    admin/users/[id]/id-image/route.ts  ← signed-URL view of a user's ID image
    admin/orders/route.ts
    admin/orders/[id]/route.ts
    admin/products/route.ts
    admin/products/[id]/route.ts
    admin/products/[id]/restore/route.ts ← un-archive a product (staff)
    admin/audit-logs/route.ts
    admin/farmer-stats/route.ts
    admin/reports/route.ts
    admin/site-content/route.ts         ← GET + PUT (key-value CMS)
    admin/faqs/route.ts                 ← GET + POST
    admin/faqs/[id]/route.ts            ← DELETE
    admin/banners/route.ts              ← GET (all, for admin)
    banners/route.ts                    ← GET (active only, public)
    banners/[id]/route.ts               ← PUT + DELETE
    site-content/route.ts               ← GET (public: SiteContent + FAQs)
    announcements/route.ts
    announcements/[id]/route.ts
    farmer/orders/route.ts
    farmer/orders/[id]/route.ts
    farmer/crops/route.ts
    farmer/crops/[id]/route.ts
    farmer/crops/[id]/logs/route.ts
    farmer/crops/[id]/logs/[logId]/route.ts
    farmer/advisory/route.ts            ← pest/damage/weather logs from all farmers (30 days)
    messages/route.ts                   ← conversation list with unread counts
    messages/[userId]/route.ts          ← GET thread (marks read) + POST send
    cron/purge-id-images/route.ts       ← CRON_SECRET-gated daily job

src/components/
  Navbar.tsx                            ← About link, Messages link (customer), cart badge
  ProductCard.tsx                       ← farmer name links to /sellers/[id]
  ReviewForm.tsx                        ← interactive star picker + comment textarea
  ReviewsSection.tsx                    ← avg rating + form + review cards
  WeatherWidget.tsx                     ← Open-Meteo, Legazpi City (lat=13.1391, lon=123.7438)
  MessageThread.tsx                     ← shared inbox/thread component (8s polling)
  AddToCartButton.tsx

src/contexts/
  AuthContext.tsx                       ← rehydrates via GET /api/users/me, no token in JS
  CartContext.tsx                       ← cart_${user.id} localStorage key

src/lib/
  auth.ts                               ← getJwtSecret, verifyToken
  authorize.ts
  session.ts                            ← issueSessionResponse (shared by login + MFA completion)
  getActiveAuthUser.ts                  ← JWT verify + DB suspended/tokenVersion check
  mfaToken.ts / totp.ts / totpCrypto.ts / backupCodes.ts
  deleteAccount.ts                      ← anonymizes accounts (self-delete + admin-delete), keeps order/audit history
  idImageStorage.ts                     ← deleteIdImage(): confirmed deletes from the private ID bucket
  audit.ts                              ← logAudit()
  csp.ts                                ← the Content-Security-Policy (nonce per request)
  email.ts                              ← Brevo wrapper (fails soft) + emailHtml escaping template
  imageSniff.ts                         ← magic-byte checks for uploads
  rateLimit.ts
  url.ts                                ← isSafeUrl XSS guard
  prisma.ts
  roles.ts

src/validators/                          ← shared Zod schemas (client + server)
  auth.ts, order.ts, profile.ts, adminUser.ts, banner.ts, siteContent.ts,
  category.ts, product.ts, review.ts, message.ts, faq.ts, crop.ts, mfa.ts, helpers.ts,
  limits.ts                             ← maximum lengths (MAX, tooLong)

prisma/
  schema.prisma                         ← 17 models; generated/prisma custom output
  migrations/ (25 applied — see DEVELOPMENT_STATUS.md for the full list)

src/proxy.ts                            ← per-request CSP nonce + /api/admin guard
src/test-utils/integration/             ← integration-test helpers (test DB guard, factories, withRowLocked, fakeStorage)
scripts/migrate.mjs                     ← build-time migrations (skipped on Preview unless isolated)
```

---

## Critical reminders

- After any `npx prisma migrate dev`, always run `npx prisma generate` separately — the custom output path (`generated/prisma`) means the client never auto-updates. Use **Bash tool** (not PowerShell) for all Prisma CLI commands.
- `DIRECT_URL` must point at Supabase's **Session pooler**, not the true direct-connection endpoint (unreachable, IPv6-only) or the Transaction pooler `DATABASE_URL` uses (can't hold `prisma migrate deploy`'s advisory lock).
- `.github/dependabot.yml` has permanent `ignore` rules for major bumps of `otplib` (breaks the TOTP code) and `eslint` (crashes `eslint-config-next`'s bundled plugin) — don't lift without re-verifying upstream first.
- `.github/dependabot.yml` also ignores major bumps of `typescript` (TS 7 crashes typescript-eslint) and `@types/node` (keep it on the Node 24 runtime), and groups lockstep packages (prisma, react, next, tailwind) into single PRs.
- Every page renders per request because of the CSP nonce (root layout awaits `connection()`). A new third-party script needs the nonce from `(await headers()).get('x-nonce')`.
- Any new query listing live products must filter `archivedAt: null`; any new user listing must filter `deletedAt: null`.
- Build new email bodies with the `emailHtml` template so user values are escaped.
- Don't run `npx prisma format`; it reformats the whole schema. Use `npx prisma validate`.
- If this file goes stale, `git log` is the source of truth.
