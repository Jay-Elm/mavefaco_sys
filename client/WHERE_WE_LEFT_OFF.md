# Where We Left Off

_Updated: 2026-10-26_

## Current state

Feature-complete for the capstone scope and through three structured hardening passes. Everything is merged to `master` and deployed to production; nothing is mid-flight.

1. **Phase 1–3 security review** (completed 2026-09-08, `SECURITY_REVIEW.md`): cookie-based sessions, admin-route guard, private ID storage, password reset, shared validators, email verification.
2. **10-item gap list** (completed 2026-09-21): Next.js CVE patches, JWT secret validation, `Decimal` money, connection pooling, Dependabot + CI audit, mandatory TOTP MFA for staff, ID-image auto-purge, no email enumeration.
3. **Whole-project review and fixes** (2026-10-03 to 2026-10-05, `PROJECT_REVIEW.md`): every finding fixed except L4. Highlights:
   - **Integration tests** against a real Postgres database (`npm run test:integration`, 254 tests) covering orders, auth, MFA, products, reviews, messages, admin users, content, reports, cron, crop monitoring; 73 unit tests. Both suites run in CI. The tests found and drove fixes for 10+ real bugs (stock double-restock, MFA code reuse under concurrency, products with history undeletable, …).
   - **MFA encryption key** separated from `JWT_SECRET` (`TOTP_ENCRYPTION_KEY`); all staff migrated.
   - **Preview deployments** have their own Supabase database and keys; Preview builds migrate only that database (`PREVIEW_DATABASE_ISOLATED`).
   - **Product archiving** (and staff restore) instead of deleting products with history.
   - **Account deletion anonymizes** instead of erasing orders and audit history.
   - **Email changes** must be confirmed from the new address; old address notified.
   - **Email bodies HTML-escape** user values (`emailHtml`).
   - **Enforced nonce-based Content-Security-Policy** (`src/proxy.ts`, `src/lib/csp.ts`); every page renders per request.
   - Input length limits, audit logging of content changes with paging, report accuracy, 16 database indexes, single-use reset/verification links.
   - Rebranded to **Mayon Vegetable Farmers Agriculture Cooperative (MaVeFaCo)**; README rewritten at the repo root; brand colors across all portals; lint at 0 errors and 0 warnings.
4. **Changes 2026-10-14 to 2026-10-15** (all deployed):
   - Audit log is admin-only; messaging is customer↔farmer only (both enforced on the server).
   - **Listing suspension** replaces staff edit/revoke/delete: staff View, Approve, Suspend with reasons, and Delete only a suspended listing. The farmer gets a one-way notice in Messages and an email; editing resubmits; the daily cron removes listings not resubmitted within 7 days. Notices show their outcome once resolved.
   - **Only customers buy**: no cart or ordering for farmers and staff; staff don't see the storefront.
   - In-page dialogs replace every browser `confirm()`/`alert()`; red count badges on the farmer and staff sidebars; sidebars narrowed to 184px.
   - Message threads open at the first unread message (or the latest).
   - No signed-out flash on refresh: the session is read on the server and role redirects happen there.
5. **Changes 2026-10-26:**
   - Next.js 16.4.3 (critical advisory) and `npm audit fix`: `npm audit` reports 0 vulnerabilities.
   - Weather widget moved to Tabaco City.
   - **Crop monitoring redesign**: plantings are their own records (`Planting`, one per season) instead of fields on products; a staff-managed `CropType` list with approximate growing times drives computed growth stages and harvest windows; "Needs attention" view, record harvest (adds to the linked listing's stock), structured crop logs (pest from a list, severity, date seen); the advisory names crops, not listings; Dashboard → **Supply** shows expected kg per crop per week for 8 weeks with oversupply flags; Dashboard → **Crop Types**. Migration `add_plantings` carries existing crop data over. Then: the community advisory groups reports by crop and problem (`/farmer/advisory`), and out-of-stock listings with a growing linked planting show **Coming soon** with the expected harvest window to customers.
6. **Changes 2026-10-26 — stronger ID verification:** farmers choose one of 10 ID types and take the front, back and a selfie holding the ID with the in-app camera (ID-shaped frame, blur/lighting checks; upload only without a camera, tagged for staff); the ID number is kept as an HMAC fingerprint + last 4, and one ID can't verify two accounts; staff review the photos side by side and approve or reject with reasons (notice + email), or mark a farmer verified in person. New `IdSubmission` model (migration `add_id_submissions` moves existing uploads over). **Needs `ID_NUMBER_HASH_KEY` in Vercel** (Production and Preview, separate values).
7. **Scope** is documented item by item in `SCOPE_AND_DELIMITATIONS.md` (129 use-case items: 81 implemented, 20 partial, 28 not implemented).

---

## Open items

**Manual checks still to do** (all covered by automated tests; these confirm the screens and real email delivery with logged-in test accounts):

1. Change a test customer's email: notice at the old address, link at the new one, logged out after clicking, final notice to the old address (only test of real Brevo delivery).
2. Cancel an order as a farmer and as a manager: stock goes back up exactly once.
3. As staff, suspend a product with a past order, then delete it; find it under **Archived** on the dashboard Products page and restore it (it comes back as Pending).
4. Cart survives logout/login; profile page shows name and email.
5. On a phone-sized screen, menus close after tapping a link.
6. As admin, "Reset 2FA" appears on other admins and managers with 2FA enabled.
7. The farmer portal shows the brand colors (the manager dashboard was confirmed).
8. Suspend a listing as a manager: the farmer sees it under Messages → MaVeFaCo notices with an "Edit or delete this listing" button, receives the email (real Brevo delivery), and the listing shows as Suspended with its deadline.
9. As that farmer, save the listing without changes (stays suspended, with a message), then change the flagged detail and save (back to Pending).
10. As admin or manager, the navbar has no Products or Cart, and opening `/products` or `/cart` goes to the dashboard; as a farmer, there is no Cart and no Add to Cart on product pages.
11. As admin: the sidebar shows a count on Products and Users when something is waiting, and the dashboard overview counts suspended listings apart from pending ones.
12. Refresh a page as each role: no Login/Register flash, and `/` goes straight to the farmer or staff portal.

**Remaining debt** (see `DEVELOPMENT_STATUS.md` → Known Technical Debt): per-instance rate limiting (L4, needs Upstash Redis credentials from the project owner), Prisma 8 upgrade when released, no UI/end-to-end tests.

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
    users/page.tsx                      ← ID review panel, verified in person, suspend, reset, delete
    categories/page.tsx
    products/page.tsx                   ← approve/view/suspend/delete-suspended/restore + CSV export
    products/[id]/page.tsx              ← read-only listing view (staff don't edit)
    orders/page.tsx                     ← status management + CSV export
    audit-logs/page.tsx
    announcements/page.tsx
    reports/page.tsx                    ← sales/crop/user/farmer tabs + CSV + print
    crop-types/page.tsx                 ← crop list + approximate growing times
    supply/page.tsx                     ← upcoming supply by crop and week
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
    crops/page.tsx                      ← crop monitor: needs attention, growing, past seasons
    crops/new/page.tsx                  ← record a planting
    crops/[id]/page.tsx                 ← planting: timeline, harvest, details, crop log
    advisory/page.tsx                   ← community advisory, grouped by crop and problem
    messages/page.tsx                   ← farmer inbox
    messages/[userId]/page.tsx          ← message thread
    profile/page.tsx                    ← edit info + ID verification (camera flow) + password change

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
    users/me/id-submission/route.ts     ← POST (ID type, number, front/back/selfie), DELETE (withdraw)
    upload/route.ts                     ← shared image-upload endpoint
    orders/route.ts                     ← POST (place order)
    customer/orders/route.ts            ← GET
    customer/orders/[id]/route.ts       ← PATCH (cancel / confirm received)
    admin/stats/route.ts
    admin/users/route.ts
    admin/users/[id]/route.ts
    admin/users/[id]/id-submission/route.ts ← staff view: signed photo URLs, same-number accounts
    admin/id-submissions/[id]/review/route.ts ← approve / reject with reasons
    admin/orders/route.ts
    admin/orders/[id]/route.ts
    admin/products/route.ts
    admin/products/[id]/route.ts
    admin/products/[id]/restore/route.ts ← un-archive a product (staff)
    admin/products/[id]/suspend/route.ts ← suspend with reasons; notice + email to the farmer
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
    farmer/plantings/route.ts           ← GET own plantings, POST record one
    farmer/plantings/[id]/route.ts      ← GET, PATCH, DELETE
    farmer/plantings/[id]/harvest/route.ts ← record harvest (+ optional stock)
    farmer/plantings/[id]/logs/route.ts
    farmer/plantings/[id]/logs/[logId]/route.ts
    farmer/advisory/route.ts            ← pest/damage/weather reports from all farmers (30 days)
    crop-types/route.ts                 ← GET (farmer/staff), POST (staff)
    crop-types/[id]/route.ts            ← PUT, DELETE (staff)
    admin/supply/route.ts               ← expected supply by crop and week
    messages/route.ts                   ← conversation list with unread counts
    messages/[userId]/route.ts          ← GET thread (marks read) + POST send (customer↔farmer only)
    notices/route.ts, notices/read/route.ts ← the caller's system notices; mark read
    nav-badges/route.ts                 ← sidebar badge counts by role
    cron/purge-id-images/route.ts       ← CRON_SECRET-gated daily job
    cron/purge-suspended-products/route.ts ← removes listings suspended 7+ days

src/components/
  Navbar.tsx                            ← About link, Messages link (customer), cart badge
  ProductCard.tsx                       ← farmer name links to /sellers/[id]
  ReviewForm.tsx                        ← interactive star picker + comment textarea
  ReviewsSection.tsx                    ← avg rating + form + review cards
  WeatherWidget.tsx                     ← Open-Meteo, Tabaco City (lat=13.3594, lon=123.7331)
  MessageThread.tsx                     ← shared thread: opens at first unread, 8s polling
  AddToCartButton.tsx                   ← hidden for farmers and staff
  NavBadge.tsx                          ← useNavBadges(), NavBadge, refreshNavBadges()
  SuspendListingModal.tsx               ← staff pick suspension reasons
  MessageFarmerLink.tsx                 ← seller-page button, customers and guests only

src/contexts/
  AuthContext.tsx                       ← initialUser from the server (serverSession.ts), no token in JS
  CartContext.tsx                       ← cart_${user.id} localStorage key, customers only
  DialogContext.tsx                     ← useDialog(): in-page confirm/alert

src/lib/
  auth.ts                               ← getJwtSecret, verifyToken
  authorize.ts
  session.ts                            ← issueSessionResponse (shared by login + MFA completion)
  getActiveAuthUser.ts                  ← JWT verify + DB suspended/tokenVersion check
  serverSession.ts                      ← getSessionUser() for server-rendered pages, redirectRoles()
  productRemoval.ts                     ← removeListing(): delete or archive, resolves notices
  mfaToken.ts / totp.ts / totpCrypto.ts / backupCodes.ts
  deleteAccount.ts                      ← anonymizes accounts (self-delete + admin-delete), keeps order/audit history
  idImageStorage.ts                     ← upload, sign, confirmed deletes in the private ID bucket
  idVerification.ts                     ← ID types, number formats, rejection reasons
  idNumberHash.ts                       ← HMAC fingerprint of ID numbers (ID_NUMBER_HASH_KEY)
  photoQuality.ts                       ← blur / brightness checks for ID photos
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
  productSuspension.ts                  ← suspension reasons, SUSPENSION_DAYS, deadline

prisma/
  schema.prisma                         ← 18 models; generated/prisma custom output
  migrations/ (27 applied — see DEVELOPMENT_STATUS.md for the full list)

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
- Confirmations and alerts go through `useDialog()`, never the browser's `confirm()`/`alert()`.
- Role-based redirects belong on the server (`redirectRoles()`); client-side ones flash the wrong page first.
- Don't run `npx prisma format`; it reformats the whole schema. Use `npx prisma validate`.
- If this file goes stale, `git log` is the source of truth.
