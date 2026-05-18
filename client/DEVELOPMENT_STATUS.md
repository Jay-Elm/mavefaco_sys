# Development Status — CoopMarket Capstone

_Last updated: 2026-05-18 (session 4)_

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.6 (App Router) |
| UI | React 19.2.4, Tailwind CSS v4 |
| Forms | React Hook Form + Zod v4 |
| Database | PostgreSQL via Prisma 7.8.0 |
| Auth | JWT (jsonwebtoken) + bcrypt, stored in localStorage |
| Icons | lucide-react |
| Weather | Open-Meteo API (free, no key required) |

---

## Architecture

Single Next.js app (`/proj/client/`) — API routes and frontend pages colocated under `src/app/`.

**Roles:** `admin` → `manager` → `farmer` → `customer`

**Auth flow:** Login → JWT stored in localStorage → `AuthContext` provides `user`, `token`, `loading` → API routes extract token via `getActiveAuthUser()` (async, checks DB for `suspended` flag) → `authorize(user, roles[])` enforces role access.

**Cart:** Scoped per user via `cart_${user.id}` in localStorage. Guests see an empty cart. Switching users loads the correct cart automatically. Multi-farmer carts blocked at both client (conflict dialog) and server (400 on checkout).

**Post-login redirects:** admin/manager → `/dashboard`, farmer → `/farmer`, customer → `/products`.

---

## Database Schema (Prisma)

- `User` — id, name, email, password, role, suspended, verified, idImageUrl, createdAt, updatedAt
- `Category` — id, name (unique), createdAt
- `Product` — id, name, description, price (Float), stock, imageUrl, farmerId, categoryId, approved, **plantingDate**, **expectedHarvestDate**, **growthStage**, **readyForHarvest**
- `Order` — id, totalAmount, status, paymentMethod, deliveryMethod, createdAt, customerId
- `OrderItem` — id, quantity, price, orderId, productId
- `AuditLog` — id, action, entityType, entityId, timestamp, userId
- `Announcement` — id, title, body, type (info/alert/advisory), createdAt, authorId
- `Banner` — id, title, subtitle, ctaText, ctaLink, color, active, displayOrder, createdAt
- `Faq` — id, question, answer, displayOrder, createdAt
- `SiteContent` — key (PK), value (key-value store for cooperative info)
- `Review` — id, rating (1–5), comment, createdAt, customerId, productId — `@@unique([customerId, productId])`
- `CropLog` — id, type (weather_impact/pest_disease/damage/note), note, createdAt, productId
- `Message` — id, content, read, createdAt, senderId, receiverId

**Migrations applied (in order):**
- `20260511155826_add_user_suspended`
- `20260512105820_add_product_approval`
- `20260518052947_add_announcements`
- `20260518063921_add_site_content`
- `20260518075152_add_reviews`
- `20260518075751_add_crop_monitoring`
- `20260518080321_add_messages`

> **IMPORTANT:** Always run `npx prisma generate` after `npx prisma migrate dev`. The custom output path (`generated/prisma`) means the client does NOT auto-update. Use Bash tool (not PowerShell) for Prisma CLI commands.

---

## Completed Features

### Public Pages
- `/` — Hero, active Banners, Announcements, How It Works, Featured Products (approved only, last 6)
- `/products` — Product listing with category/search/price filters (Server Component, URL-based); approved only
- `/products/[id]` — Product detail; 404 if not approved; Add to Cart; farmer name links to seller page; Reviews section
- `/sellers/[id]` — Public seller profile: name, verified badge, member since, avg rating, all approved products; "Message Farmer" button
- `/about` — Cooperative info page: name, about, mission/vision, FAQ accordion, contact details (all editable by admin)
- `/login` — role-based redirect after login; suspension error on 403
- `/register` — role selector (Customer / Farmer)

### Product Purchase Flow (Customer)
- Add to Cart → quantity modal → cart badge count in navbar
- Multi-farmer conflict dialog (clear or keep cart)
- `/cart` — item list, qty controls, payment/delivery method, Place Order
- `/customer/orders` — order history, expandable items; **Cancel** (pending → cancelled, stock restored); **Confirm Received** (shipped → delivered)
- `/customer/profile` — edit name/email; change password
- `/customer/messages` — conversation inbox; `/customer/messages/[farmerId]` — message thread with farmer (polls every 8s)

### Ratings & Reviews
- Customers with a **delivered** order containing the product can leave one review (rating 1–5 + optional comment)
- `ReviewsSection` on product detail: star summary, submit form, review cards with delete
- Farmers and admins can delete any review; customers can delete their own
- Average rating shown on seller profile page

### Admin Dashboard (`/dashboard/`) — admin + manager roles
- `layout.tsx` — dark sidebar, auth guard, isolated scroll
- `page.tsx` — stat cards: Users, Products, Orders, Revenue; Manager: Farmer Performance table
- `users/` — suspend/verify/reset password/delete; inline modals
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
- `profile/` — edit name/email; ID image URL for verification; change password

### Customer Pages
- `/customer/orders` — full order lifecycle (cancel pending, confirm received)
- `/customer/profile` — edit name/email; change password
- `/customer/messages` — inbox; `/customer/messages/[userId]` — thread with farmer

### Product Approval System
- All products created with `approved: false`; must be verified farmer to list
- Unapproved products hidden from public pages
- Farmer content edits reset `approved: false`; stock-only changes do not

### User Verification System
- Farmers submit ID image URL via profile page
- Admin verifies via dashboard users page (ShieldCheck button)
- Verified status required before farmer can list products

---

## API Routes

| Method | Route | Auth | Notes |
|--------|-------|------|-------|
| POST | `/api/auth/register` | public | role: farmer or customer only |
| POST | `/api/auth/login` | public | checks suspended |
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
| DELETE | `/api/admin/users/[id]` | admin only | blocked if active orders |
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
| POST | `/api/orders` | authenticated | validates stock, approved, same-farmer; $transaction |
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
| PATCH | `/api/users/me` | authenticated | name/email/idImageUrl/password change |

---

## Key Implementation Details

### `getActiveAuthUser` (async, `/lib/getActiveAuthUser.ts`)
Verifies JWT then checks DB for `suspended: true`. Returns `null` if suspended or not found. Used in ALL API routes.

### Revenue counting
Only `status: 'delivered'` orders count as revenue — in stats API, farmer-stats API, and farmer overview page.

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

---

## Known Technical Debt

| Issue | Severity | Notes |
|-------|----------|-------|
| `Float` used for money fields | Medium | Should be `Decimal`; rounding errors possible |
| No input validation on some API routes | Medium | `products/[id] PATCH` trusts client-supplied types |
| Weak JWT secret likely in `.env` | High | Not committed but should be rotated before production |
| No image upload | Low | URL-only for product images and ID verification |
| Messaging is polling, not WebSocket | Low | 8s interval; acceptable for capstone |
| No push notifications | Low | All alerts are in-app only |

---

## Not Yet Built / Out of Scope

- Real-time WebSocket chat (replaced with polling)
- Weather alerts / push notifications
- AI pest advisory (replaced with community log aggregation)
- Market price API (Albay province)
- Coming-soon listings with harvest date countdown
- Language toggle (EN/TL)
- Print receipts
- Image file upload (URL-only currently)
- Admin: backup/restore database
