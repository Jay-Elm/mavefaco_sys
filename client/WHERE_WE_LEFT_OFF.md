# Where We Left Off

_Updated: 2026-09-23_

## Current state

Feature-complete for the capstone scope (all 8 original gap-analysis use cases, session 4, 2026-05-18) **and** through two full structured hardening passes since:

1. **Phase 1–3 security review** (completed 2026-09-08, see `SECURITY_REVIEW.md`) — cookie-based JWT auth replacing localStorage, structural admin-route guard (`src/proxy.ts`), private ID-image storage with signed URLs, Brevo-backed password reset, shared Zod validators, self-service account deletion, mandatory email verification, password-gated email changes, confirm dialogs on destructive actions.
2. **10-item follow-up gap list** (completed 2026-09-21) — Next.js CVE patches, `JWT_SECRET` strength validation, `Decimal` money fields, dropped an unused vulnerable dependency, verified Postgres connection pooling, Dependabot + CI dependency audit, extended shared validators to more routes, **mandatory TOTP/MFA for admin and manager roles**, scheduled auto-purge of verified ID images, and closed email enumeration on registration.
3. **Basic Vitest test suite added** (2026-09-23) — first automated tests in the project, covering auth/order validators and the security-critical `lib/` helpers (`getJwtSecret`, `verifyToken`, `authorize`, `isSafeUrl`).

Everything above is merged to `master` and deployed to production. Nothing is mid-flight.

---

## What's realistically left (not required for submission, but real gaps)

- **No test coverage for API routes or anything touching Prisma/the DB** — the new Vitest suite deliberately only covers pure logic (validators, JWT/role/URL helpers) to avoid the bigger decision of a test-DB strategy or mocking `@prisma/client`. Natural next step if more testing is wanted.
- **Dead legacy route** `src/app/api/admin/route.ts` — predates the cookie-based auth model (reads a bearer `Authorization` header instead of the session cookie), unreferenced anywhere in the app. Safe to delete, just never has been.
- **~30 simpler CRUD routes** (announcements, FAQs, categories, crop logs, reviews, messages, products) still validate inline rather than through `src/validators/` — deliberate scope cut, revisit only if their validation logic grows.
- Everything in `DEVELOPMENT_STATUS.md`'s "Not Yet Built / Out of Scope" list — real-time chat, push notifications, AI pest advisory, market price API, language toggle, print receipts, DB backup/restore — none required for capstone scope.

---

## File map (quick reference)

```
src/app/
  page.tsx                              ← home: hero + banners + announcements + featured products
  login/page.tsx                        ← handles MFA branching (mfaRequired / mfaSetupRequired)
  register/page.tsx
  verify-email/page.tsx                 ← confirms emailVerifiedAt via emailed link
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
    admin/audit-logs/route.ts
    admin/farmer-stats/route.ts
    admin/reports/route.ts
    admin/site-content/route.ts         ← GET + PUT (key-value CMS)
    admin/faqs/route.ts                 ← GET + POST
    admin/faqs/[id]/route.ts            ← DELETE
    admin/banners/route.ts              ← GET (all, for admin)
    admin/route.ts                      ← dead/legacy, unreferenced — see Known Technical Debt
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
  QuantityModal.tsx

src/contexts/
  AuthContext.tsx                       ← rehydrates via GET /api/users/me, no token in JS
  CartContext.tsx                       ← cart_${user.id} localStorage key

src/lib/
  auth.ts                               ← getJwtSecret, verifyToken
  authorize.ts
  session.ts                            ← issueSessionResponse (shared by login + MFA completion)
  getActiveAuthUser.ts                  ← JWT verify + DB suspended/tokenVersion check
  mfaToken.ts / totp.ts / totpCrypto.ts / backupCodes.ts
  deleteAccount.ts                      ← shared cascade-delete logic (self-delete + admin-delete)
  email.ts                              ← Brevo wrapper, fails soft
  imageSniff.ts                         ← magic-byte checks for uploads
  rateLimit.ts
  url.ts                                ← isSafeUrl XSS guard
  prisma.ts
  roles.ts

src/validators/                          ← shared Zod schemas (client + server)
  auth.ts, order.ts, profile.ts, adminUser.ts, banner.ts, siteContent.ts,
  category.ts, product.ts, review.ts, message.ts, faq.ts, crop.ts, mfa.ts, helpers.ts

prisma/
  schema.prisma                         ← 16 models; generated/prisma custom output
  migrations/ (19 applied — see DEVELOPMENT_STATUS.md for the full list)
```

---

## Critical reminders

- After any `npx prisma migrate dev`, always run `npx prisma generate` separately — the custom output path (`generated/prisma`) means the client never auto-updates. Use **Bash tool** (not PowerShell) for all Prisma CLI commands.
- `DIRECT_URL` must point at Supabase's **Session pooler**, not the true direct-connection endpoint (unreachable, IPv6-only) or the Transaction pooler `DATABASE_URL` uses (can't hold `prisma migrate deploy`'s advisory lock).
- `.github/dependabot.yml` has permanent `ignore` rules for major bumps of `otplib` (breaks the TOTP code) and `eslint` (crashes `eslint-config-next`'s bundled plugin) — don't lift without re-verifying upstream first.
- Trust this file and `SECURITY_REVIEW.md` over nothing else now — this file was itself stale from 2026-05-18 until this update; if it goes stale again, `git log` is the source of truth.
