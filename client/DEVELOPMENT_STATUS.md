# Development Status — CoopMarket Capstone

_Last updated: 2026-09-23_

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.3.5 (App Router) |
| UI | React 19.3.0, Tailwind CSS v4 |
| Forms | React Hook Form + Zod v4 |
| Database | PostgreSQL via Prisma 7.10.0 (`@prisma/client` + `@prisma/adapter-pg`, kept version-locked) |
| Auth | JWT (jsonwebtoken) + bcrypt, in an `httpOnly` cookie — **not** localStorage; mandatory TOTP MFA for admin/manager |
| File storage | Supabase Storage (private bucket, signed URLs) for ID verification images |
| Email | Brevo transactional API (password reset, email verification) |
| Testing | Vitest (`npm test`) — validators + security-critical `lib/` helpers |
| Icons | lucide-react |
| Weather | Open-Meteo API (free, no key required) |

---

## Architecture

Single Next.js app (`/proj/client/`) — API routes and frontend pages colocated under `src/app/`.

**Roles:** `admin` → `manager` → `farmer` → `customer`

**Auth flow:**
- Login → JWT signed and set as an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production) → `AuthContext` rehydrates the user via `GET /api/users/me` on mount (never reads the token itself — it can't, it's httpOnly).
- Every API route resolves the caller via `getActiveAuthUser()`, which verifies the JWT, then checks the DB that the account isn't `suspended` and that `tokenVersion` still matches (revokes all outstanding sessions the moment it's bumped — on logout, password change, or email change).
- `src/proxy.ts` (Next 16 renamed Middleware → **Proxy**, runs on the Node.js runtime) guards every `/api/admin/*` request as a structural backstop — optimistic JWT+role check only, no DB call — in front of each route's own full `getActiveAuthUser` + `authorize()` check.
- **Admin/manager accounts require TOTP.** A correct password alone doesn't issue the real session cookie for those roles — `POST /api/auth/login` instead sets a short-lived, purpose-scoped "MFA pending" cookie and returns `mfaRequired` (has TOTP already) or `mfaSetupRequired` (first login, must enroll). `POST /api/auth/mfa/setup` issues a QR/secret, `POST /api/auth/mfa/confirm` verifies the first code and turns MFA on, `POST /api/auth/mfa/verify` completes login on subsequent visits. Ten single-use bcrypt-hashed backup codes are issued at enrollment. The TOTP secret itself is stored AES-256-GCM encrypted (`totpSecret`), keyed off `JWT_SECRET` — never in the clear.
- Registration requires clicking an emailed verification link (`EmailVerificationToken`, Brevo) before login is allowed; existing pre-feature accounts were backfilled so nobody already-registered got locked out.
- Password reset (`PasswordResetToken`) follows the same anti-enumeration pattern as registration: identical response whether or not the email is registered.
- ID verification is a real file upload (`POST /api/users/me/id-image`) into a **private** Supabase bucket, served to admins only via 5-minute signed URLs (`GET /api/admin/users/[id]/id-image`) — never a public link or pasted URL.
- `GET /api/cron/purge-id-images` (Vercel Cron, daily, `CRON_SECRET`-gated) auto-deletes a verified user's stored ID image 30 days after `verifiedAt`; pending/unreviewed submissions are never touched.

**Cart:** Scoped per user via `cart_${user.id}` in localStorage (cart contents themselves are fine client-side — only the auth token isn't). Guests see an empty cart. Switching users loads the correct cart automatically. Multi-farmer carts blocked at both client (conflict dialog) and server (400 on checkout).

**Post-login redirects:** admin/manager → `/dashboard`, farmer → `/farmer`, customer → `/products`.

**Validation:** shared Zod schemas in `src/validators/` for auth, profile, admin-user, order, banner, site-content, product, review, message, faq, category, crop, and MFA input — used by both the client form (`zodResolver`) and the server route so the two can't drift. The remaining simpler CRUD routes (announcements, some product/category edge cases) still use inline checks; not worth the mechanical sweep unless their validation grows more complex.

---

## Database Schema (Prisma)

16 models. `generated/prisma` is a custom client output path — **always run `npx prisma generate` after `npx prisma migrate dev`**, it does not auto-update. Use the Bash tool (not PowerShell) for Prisma CLI commands.

- `User` — id, name, email, password, role, suspended, `idImagePath` (private storage path, not a URL), `verified`, `verifiedAt` (drives ID-image auto-purge), `emailVerifiedAt`, `tokenVersion`, `totpSecret` (encrypted), `totpEnabled`, createdAt, updatedAt
- `EmailVerificationToken` / `PasswordResetToken` — id, `tokenHash` (SHA-256, never the raw token), expiresAt, usedAt, userId
- `TotpBackupCode` — id, `codeHash` (bcrypt — low-entropy human-typed codes need the slow hash), usedAt, userId
- `Category` — id, name (unique), createdAt
- `Product` — id, name, description, **price (`Decimal(10,2)`)**, stock (Float), unit, imageUrl, farmerId, categoryId, approved, plantingDate, expectedHarvestDate, growthStage, readyForHarvest
- `Order` — id, **totalAmount (`Decimal(10,2)`)**, status, paymentMethod, deliveryMethod, createdAt, customerId
- `OrderItem` — id, quantity (Float), **price (`Decimal(10,2)`)**, orderId, productId
- `AuditLog` — id, action, entityType, entityId, timestamp, userId
- `Announcement` — id, title, body, type (info/alert/advisory), createdAt, authorId
- `Banner` — id, title, subtitle, ctaText, ctaLink, color, active, displayOrder, createdAt
- `Faq` — id, question, answer, displayOrder, createdAt
- `SiteContent` — key (PK), value (key-value store for cooperative info)
- `Review` — id, rating (1–5), comment, createdAt, customerId, productId — `@@unique([customerId, productId])`
- `CropLog` — id, type (weather_impact/pest_disease/damage/note), note, createdAt, productId
- `Message` — id, content, read, createdAt, senderId, receiverId

**Migrations applied (19, in order):** `init` → `update_user_model` → `cooperative_marketplace_models` → `add_user_suspended` → `add_user_id_verification` → `add_order_payment_delivery` → `add_product_approval` → `add_announcements` → `add_site_content` → `add_reviews` → `add_crop_monitoring` → `add_messages` → `add_unit_float_stock_quantity` → `add_token_version` → `rename_id_image_url_to_path` → `add_password_reset_token` → `add_email_verification` → `price_and_total_amount_to_decimal` → `add_totp_mfa` → `add_id_image_verified_at`.

**Infra note:** `DIRECT_URL` cannot use Supabase's true direct-connection endpoint (`db.<ref>.supabase.co:5432`) — neither locally nor from Vercel's build infra can reach it (`P1001`), almost certainly Supabase's IPv6-only requirement for that endpoint. Fixed by pointing `DIRECT_URL` at the **Session pooler** instead (distinct from the Transaction pooler `DATABASE_URL` uses) — still holds `prisma migrate deploy`'s advisory lock, and is IPv4-compatible.

---

## Completed Features

### Public Pages
- `/` — Hero, active Banners, Announcements, How It Works, Featured Products (approved only, last 6)
- `/products` — Product listing with category/search/price filters (Server Component, URL-based); approved only
- `/products/[id]` — Product detail; 404 if not approved; Add to Cart; farmer name links to seller page; Reviews section
- `/sellers/[id]` — Public seller profile: name, verified badge, member since, avg rating, all approved products; "Message Farmer" button
- `/about` — Cooperative info page: name, about, mission/vision, FAQ accordion, contact details (all editable by admin)
- `/login` — role-based redirect after login; suspension error on 403; branches into MFA setup/verify for admin/manager
- `/register` — role selector (Customer / Farmer); registration blocked until email is verified
- `/verify-email`, `/forgot-password`, `/reset-password` — self-service email verification and password reset flows

### Product Purchase Flow (Customer)
- Add to Cart → quantity modal → cart badge count in navbar
- Multi-farmer conflict dialog (clear or keep cart)
- `/cart` — item list, qty controls, payment/delivery method, Place Order
- `/customer/orders` — order history, expandable items; **Cancel** (pending → cancelled, stock restored); **Confirm Received** (shipped → delivered)
- `/customer/profile` — edit name/email (email change requires re-entering current password, kills the session); change password; self-service account deletion (password-gated, blocked while an active order exists)
- `/customer/messages` — conversation inbox; `/customer/messages/[farmerId]` — message thread with farmer (polls every 8s)

### Ratings & Reviews
- Customers with a **delivered** order containing the product can leave one review (rating 1–5 + optional comment)
- `ReviewsSection` on product detail: star summary, submit form, review cards with delete
- Farmers and admins can delete any review; customers can delete their own
- Average rating shown on seller profile page

### Admin Dashboard (`/dashboard/`) — admin + manager roles
- `layout.tsx` — dark sidebar, auth guard, isolated scroll
- `page.tsx` — stat cards: Users, Products, Orders, Revenue; Manager: Farmer Performance table
- `users/` — suspend/verify (via signed-URL ID image view)/reset password/delete; inline modals
- `categories/` — list with product count; inline add/delete
- `products/` — all products; Approve/Revoke/Edit/Delete; sorting + filtering + CSV export
- `orders/` — all orders; expandable; status management; CSV export
- `audit-logs/` — last 100 entries; search + action/entity type filters; CSV export
- `announcements/` — post/delete announcements (info/alert/advisory types)
- `reports/` — Sales, Crop Demand, Users, Farmers tabs; CSS bar charts; per-section CSV + full report export; print button
- `site/` — **Admin only**: 3-tab CMS:
  - **Banners** — add/toggle/delete homepage banners (5 color themes, CTA link, display order)
  - **Cooperative Info** — edit name, about, mission, vision, contact email/phone/address, Facebook URL
  - **FAQs** — add/delete FAQ entries with display order

### Farmer Dashboard (`/farmer/`) — farmer role only
- `layout.tsx` — green-accent sidebar, auth guard, isolated scroll
- `page.tsx` — product count, orders, revenue; **stock alerts** (out of stock + low stock); **weather widget** (Legazpi City, Albay via Open-Meteo); **community advisory** (recent pest/disease/damage logs from all farmers, last 30 days)
- `products/` — table with stock badges (Out of Stock / Low / normal); alert banner listing specific problem products; Edit/Delete; CSV export
- `products/new/` — create product form; requires `verified: true`
- `products/[id]/edit/` — pre-filled edit form; content edits reset `approved: false`
- `orders/` — orders with farmer's products; Accept/Reject/Ship/Deliver state machine; CSV export
- `crops/` — Crop Monitor list: all products with growth stage, planting date, harvest date (red if overdue), log count, ready badge
- `crops/[id]/` — Crop detail: update planting/harvest dates, growth stage dropdown, ready-for-harvest toggle; crop log with type buttons (weather/pest/damage/note) + timestamped entries
- `messages/` — conversation inbox with unread counts; `/farmer/messages/[userId]` — message thread
- `profile/` — edit name/email; real ID-image file upload for verification; change password

### Customer Pages
- `/customer/orders` — full order lifecycle (cancel pending, confirm received)
- `/customer/profile` — edit name/email; change password; self-delete
- `/customer/messages` — inbox; `/customer/messages/[userId]` — thread with farmer

### Product Approval System
- All products created with `approved: false`; must be verified farmer to list
- Unapproved products hidden from public pages
- Farmer content edits reset `approved: false`; stock-only changes do not

### User Verification System
- Farmers submit a real ID image file (uploaded to a private Supabase bucket) via the profile page
- Admin verifies via dashboard users page, viewing the image through a short-lived signed URL
- Verified status required before farmer can list products
- Verified images are auto-purged 30 days after verification (`/api/cron/purge-id-images`)

---

## API Routes

| Method | Route | Auth | Notes |
|--------|-------|------|-------|
| POST | `/api/auth/register` | public | role: farmer or customer only; identical response for a duplicate email (anti-enumeration), sends verification email to that address |
| POST | `/api/auth/login` | public | checks suspended + email-verified; admin/manager branches into MFA (sets pending cookie, returns `mfaRequired`/`mfaSetupRequired`) instead of issuing the session cookie |
| POST | `/api/auth/logout` | authenticated | clears the session cookie, bumps `tokenVersion` |
| POST | `/api/auth/mfa/setup` | pending-MFA cookie | issues a TOTP secret + QR for first-time enrollment |
| POST | `/api/auth/mfa/confirm` | pending-MFA cookie | verifies the first code, enables TOTP, issues backup codes, completes login |
| POST | `/api/auth/mfa/verify` | pending-MFA cookie | verifies a TOTP code or backup code on subsequent logins, completes login |
| POST | `/api/auth/forgot-password` | public | rate-limited; identical generic response regardless of whether the email exists |
| POST | `/api/auth/reset-password` | public | validates hashed single-use token, bumps `tokenVersion` |
| GET | `/api/auth/verify-email` | public (token) | confirms `emailVerifiedAt` |
| POST | `/api/auth/resend-verification` | public | anti-enumeration, same pattern as forgot-password |
| GET | `/api/products` | public | `?categoryId=` `?farmerId=` `?search=` `?minPrice=` `?maxPrice=`; approved:true unless farmerId |
| POST | `/api/products` | farmer/admin/manager | farmer must be verified |
| GET | `/api/products/[id]` | public | unapproved: owner + admin/manager only |
| PATCH | `/api/products/[id]` | farmer(own)/admin/manager | farmer edits reset approval |
| DELETE | `/api/products/[id]` | farmer(own)/admin/manager | blocked if active orders |
| GET | `/api/products/[id]/reviews` | public | all reviews for product |
| POST | `/api/products/[id]/reviews` | customer | must have delivered order with product; one per customer |
| DELETE | `/api/products/[id]/reviews/[reviewId]` | customer(own)/admin/manager | |
| GET | `/api/categories` | public | includes `_count.products` |
| POST | `/api/categories` | admin/manager | |
| DELETE | `/api/categories/[id]` | admin/manager | blocked if products exist |
| GET | `/api/admin/stats` | admin/manager | |
| GET | `/api/admin/users` | admin/manager | |
| PATCH | `/api/admin/users/[id]` | admin/manager | suspend/verify/reset password |
| DELETE | `/api/admin/users/[id]` | admin only | blocked if active orders; also deletes their stored ID image |
| GET | `/api/admin/users/[id]/id-image` | admin/manager | mints a 5-minute signed URL for the private ID image |
| GET | `/api/admin/orders` | admin/manager | all orders |
| PATCH | `/api/admin/orders/[id]` | admin/manager | manager: state machine; admin: free override |
| GET | `/api/admin/products` | admin/manager | all products, no approval filter |
| PATCH | `/api/admin/products/[id]` | admin/manager | approve/reject/edit; audit logged |
| GET | `/api/admin/farmer-stats` | admin/manager | per-farmer metrics |
| GET | `/api/admin/audit-logs` | admin/manager | |
| GET | `/api/admin/reports` | admin/manager | aggregated sales/crop/user/farmer data |
| GET | `/api/admin/site-content` | admin | all key-value site content |
| PUT | `/api/admin/site-content` | admin | upsert multiple keys |
| GET | `/api/admin/faqs` | admin | all FAQs |
| POST | `/api/admin/faqs` | admin | create FAQ |
| DELETE | `/api/admin/faqs/[id]` | admin | |
| GET | `/api/admin/banners` | admin | all banners (active + inactive) |
| GET | `/api/banners` | public | active banners only, ordered by displayOrder |
| POST | `/api/banners` | admin | create banner |
| PUT | `/api/banners/[id]` | admin | toggle active, edit |
| DELETE | `/api/banners/[id]` | admin | |
| GET | `/api/site-content` | public | all SiteContent + FAQs |
| GET | `/api/announcements` | public | all announcements with author |
| POST | `/api/announcements` | admin/manager | create announcement |
| DELETE | `/api/announcements/[id]` | admin/manager | |
| POST | `/api/orders` | authenticated | validates stock, approved, same-farmer; `$transaction` |
| GET | `/api/customer/orders` | authenticated | caller's own orders |
| PATCH | `/api/customer/orders/[id]` | authenticated | pending→cancelled (stock restore); shipped→delivered |
| GET | `/api/farmer/orders` | farmer | orders with farmer's products |
| PATCH | `/api/farmer/orders/[id]` | farmer | state machine + stock restore on cancel |
| GET | `/api/farmer/crops` | farmer | list own products with monitoring fields |
| GET | `/api/farmer/crops/[id]` | farmer | product monitoring detail + crop logs |
| PATCH | `/api/farmer/crops/[id]` | farmer | update plantingDate/harvestDate/growthStage/readyForHarvest |
| POST | `/api/farmer/crops/[id]/logs` | farmer | add crop log entry |
| DELETE | `/api/farmer/crops/[id]/logs/[logId]` | farmer | |
| GET | `/api/farmer/advisory` | farmer | recent pest/disease/damage logs from all farmers (30 days) |
| GET | `/api/messages` | authenticated | conversation list with unread counts |
| GET | `/api/messages/[userId]` | authenticated | message thread; marks received as read |
| POST | `/api/messages/[userId]` | authenticated | send message |
| GET | `/api/users/me` | authenticated | |
| PATCH | `/api/users/me` | authenticated | name/email/password change; email change requires current password + kills session |
| DELETE | `/api/users/me` | authenticated (customer/farmer only) | self-service account deletion, password-gated, blocked while an active order exists |
| POST | `/api/users/me/id-image` | farmer | uploads ID image into private bucket; resets `verified` to false |
| DELETE | `/api/users/me/id-image` | farmer | removes the submitted ID image |
| POST | `/api/upload` | authenticated | shared image-upload endpoint (magic-byte sniffed, rate-limited) |
| GET | `/api/cron/purge-id-images` | `CRON_SECRET` header | daily Vercel Cron job; purges ID images 30 days post-verification |

**Note:** `src/app/api/admin/route.ts` is legacy/unused — it predates the cookie-based auth model and reads a bearer `Authorization` header directly instead of going through `getActiveAuthUser`. Nothing in the app calls it. Worth deleting in a future cleanup pass rather than leaving as dead code that looks like a real guarded route.

---

## Key Implementation Details

### `getActiveAuthUser` (async, `/lib/getActiveAuthUser.ts`)
Verifies the JWT (from the `httpOnly` cookie, via `getAuthUser`) then checks the DB for `suspended: true` and a stale `tokenVersion`. Returns `null` if suspended, revoked, or not found. Used in essentially every authenticated API route.

### Revenue counting
Only `status: 'delivered'` orders count as revenue — in stats API, farmer-stats API, and farmer overview page.

### Money as Decimal
`Product.price`, `Order.totalAmount`, and `OrderItem.price` are all `Decimal(10,2)` in Postgres (migrated from `Float` on 2026-09-14) — no floating-point rounding risk on money math.

### Stock management
- Decremented atomically in `POST /api/orders` transaction
- Restored in `$transaction` when any order is cancelled (customer, farmer, or admin)

### Prisma client regeneration
After every `prisma migrate dev`, run `prisma generate` separately. The generated client at `generated/prisma` is what the app imports — it does NOT auto-update from migrations alone.

### Messaging (polling, not WebSocket)
`MessageThread` component polls `/api/messages/[userId]` every 8 seconds via `setInterval`. Not real-time but functional for a capstone.

### Weather widget
`WeatherWidget` calls Open-Meteo API client-side for Legazpi City (lat=13.1391, lon=123.7438). No API key required. Shown on farmer overview page.

### Community advisory
`/api/farmer/advisory` returns the 50 most recent crop logs of type `pest_disease`, `weather_impact`, or `damage` from ALL farmers in the last 30 days. Shown (top 5) on farmer overview page.

### Cart isolation
`CartContext` uses `cart_${user.id}` as localStorage key. Waits for `authLoading` before loading cart to avoid guest-cart flash.

### Layout / scroll architecture
- Navbar: `sticky top-0 z-50 h-14`; gains `shadow-xl` on scroll
- Root layout: `body` is `h-full flex flex-col`; `main` is `flex-1 min-h-0 overflow-y-auto`
- Dashboard + Farmer layouts: `flex h-full overflow-hidden` — sidebar and content scroll independently

### Automated tests
Vitest (`npm test`, or `npm run test:watch`) covers `src/validators/` (auth/order/helpers schemas) and the security-critical parts of `src/lib/` (`getJwtSecret`/`verifyToken`, `authorize`, `isSafeUrl`). No DB- or route-handler-level tests yet — see Known Technical Debt.

---

## Known Technical Debt

| Issue | Severity | Notes |
|-------|----------|-------|
| No test coverage for API routes or Prisma-backed logic | Medium | Vitest suite (see above) only covers pure validator/lib logic so far; nothing exercises an actual route handler or hits the DB |
| Dead legacy route `src/app/api/admin/route.ts` | Low | Predates the cookie-based auth model, uses a bearer-token pattern nothing else in the app uses; unreferenced, safe to delete |
| ~30 simpler CRUD routes on inline validation | Low | announcements, faqs, categories, crop logs, reviews, messages, products not migrated to `src/validators/` — no client/server duplication to drift, so not urgent |
| No image upload for site banners/site-content | Low | Some fields still URL-only |
| Messaging is polling, not WebSocket | Low | 8s interval; acceptable for capstone |
| No push notifications | Low | All alerts are in-app only |

All items from the original review — weak/unrotated `JWT_SECRET`, `Float` money fields, missing route validation, pasted-URL ID verification, no MFA, no dependency hygiene process, no ID-image retention policy, email enumeration on registration — have been fixed; see `SECURITY_REVIEW.md` (Phase 1–3, through 2026-09-08) for the original findings and fixes, cross-checked against the more recent 10-item gap-list pass for anything after that date.

---

## Not Yet Built / Out of Scope

- Real-time WebSocket chat (replaced with polling)
- Weather alerts / push notifications
- AI pest advisory (replaced with community log aggregation)
- Market price API (Albay province)
- Coming-soon listings with harvest date countdown
- Language toggle (EN/TL)
- Print receipts
- Admin: backup/restore database
