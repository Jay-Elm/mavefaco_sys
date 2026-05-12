# Development Status — CoopMarket Capstone

_Last updated: 2026-05-12 (session 3)_

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

---

## Architecture

Single Next.js app (`/proj/client/`) — API routes and frontend pages colocated under `src/app/`.

**Roles:** `admin` → `manager` → `farmer` → `customer`

**Auth flow:** Login → JWT stored in localStorage → `AuthContext` provides `user`, `token`, `loading` → API routes extract token via `getActiveAuthUser()` (async, checks DB for `suspended` flag) → `authorize(user, roles[])` enforces role access.

**Cart:** Scoped per user via `cart_${user.id}` in localStorage. Guests see an empty cart. Switching users loads the correct cart automatically. Multi-farmer carts blocked at both client (conflict dialog) and server (400 on checkout).

**Post-login redirects:** admin/manager → `/dashboard`, farmer → `/farmer`, customer → `/products`.

---

## Database Schema (Prisma)

- `User` — id, name, email, password, role, **suspended**, **verified**, **idImageUrl**, createdAt, updatedAt
- `Category` — id, name (unique), createdAt
- `Product` — id, name, description, price (Float), stock, imageUrl, farmerId, categoryId, **approved**
- `Order` — id, totalAmount, status, **paymentMethod**, **deliveryMethod**, createdAt, customerId
- `OrderItem` — id, quantity, price, orderId, productId
- `AuditLog` — id, action, entityType, entityId, timestamp, userId

**Migrations applied:**
- `20260511155826_add_user_suspended`
- `20260512105820_add_product_approval`
- (verified, idImageUrl, paymentMethod, deliveryMethod added in same session)

---

## Completed Features

### Public Pages
- `/` — Hero, How It Works, Featured Products (approved only, last 6)
- `/products` — Product listing with category/search/price filters (Server Component, URL-based); only `approved: true` shown
- `/products/[id]` — Product detail; 404 if not approved; Add to Cart modal, Buy Now, Message Farmer (greyed out)
- `/login` — role-based redirect after login; suspension error on 403
- `/register` — role selector (Customer / Farmer); farmer sees ID verification notice

### Product Purchase Flow (Customer)
- **Add to Cart button** → quantity modal popup with subtotal; `−/+` capped at stock
- **Buy Now button** → same modal, redirects to `/cart` on confirm
- **Message Farmer** — greyed-out button, UI only (no logic yet)
- **Multi-farmer conflict** — if cart has items from farmer A and user adds from farmer B: amber inline conflict dialog → "Clear Cart & Add" or "Keep Current Cart"
- **Cart page** (`/cart`) — item list, qty controls, payment method selector, delivery method selector, Place Order → `POST /api/orders` → redirect to `/customer/orders`
- **Customer orders** (`/customer/orders`) — expandable rows; Cancel (pending only, restores stock); Confirm Received (shipped only)

### Admin Dashboard (`/dashboard/`) — admin + manager roles
- `layout.tsx` — dark sidebar, auth guard, isolated scroll (sidebar + content each scroll independently; body never scrolls)
- `page.tsx` — stat cards: Users, Products (approved · pending breakdown), Orders, Revenue (delivered only); Manager: Farmer Performance table (verified/suspended/productCount/approvedCount/pendingCount/orders/revenue)
- `users/` — icon-only action buttons with title tooltips (ShieldCheck/Ban/KeyRound/Trash); Reset PW in modal overlay; inline error rows; colSpan fixed
- `categories/` — list with product count; inline add form; delete (blocked if products exist)
- `products/` — all products (admin endpoint, no approval filter); Approve/Revoke/Edit/Delete; pending count badge
- `products/[id]/edit/` — admin edit form; PATCHes `/api/admin/products/[id]`
- `orders/` — expandable rows; Manager: state-machine action buttons; Admin: free status dropdown
- `audit-logs/` — last 100 entries; client-side search; action color badges

### Manager-Specific Behavior
- Order status follows state machine: `pending → confirmed/cancelled`, `confirmed → shipped/cancelled`, `shipped → delivered/cancelled`; enforced at both API and UI level
- Farmer Performance table on dashboard overview
- Cannot see Audit Logs (admin only)

### Farmer Dashboard (`/farmer/`) — farmer role only
- `layout.tsx` — green-accent sidebar, auth guard, isolated scroll
- `page.tsx` — product count, order count, revenue (delivered orders only, farmer's items only)
- `products/` — table with Approved/Pending status badges; Edit/Delete
- `products/new/` — create product form; requires `verified: true` to list
- `products/[id]/edit/` — pre-filled edit form; content edits reset `approved: false` for re-review
- `orders/` — orders containing farmer's products; expandable; inline error rows (no alert())
- `profile/` — edit name/email; ID image URL upload for verification; Change Password section

### Customer Pages
- `/customer/orders` — order history; expandable items; Cancel/Confirm Received actions
- `/customer/profile` — edit name/email; change password (verifies current password)

### Product Approval System
- All products created with `approved: false`
- Farmers cannot list products without `verified: true`
- Unapproved products hidden from `/products`, `/products/[id]` (404), and checkout
- Farmer content edits (name/description/price/category/image) reset `approved: false`; stock-only changes don't
- Admin/manager approve/reject via `/dashboard/products`

### User Verification System
- Farmers submit ID image URL via profile page
- Admin sees "Pending" badge with link to view ID; clicks ShieldCheck to verify/unverify
- Verified status required before farmer can list products

---

## API Routes

| Method | Route | Auth | Notes |
|--------|-------|------|-------|
| POST | `/api/auth/register` | public | role: farmer or customer only; server-side validation |
| POST | `/api/auth/login` | public | checks suspended |
| GET | `/api/products` | public | `?categoryId=` `?farmerId=`; `approved:true` unless farmerId set |
| POST | `/api/products` | farmer/manager/admin | farmer must be verified |
| GET | `/api/products/[id]` | public | unapproved: visible to owner + admin/manager only |
| PATCH | `/api/products/[id]` | farmer(own)/admin/manager | farmer edits reset approval |
| DELETE | `/api/products/[id]` | farmer(own)/admin/manager | blocked if active orders |
| GET | `/api/categories` | public | includes `_count.products` |
| POST | `/api/categories` | admin/manager | |
| DELETE | `/api/categories/[id]` | admin/manager | blocked if products exist |
| GET | `/api/admin/stats` | admin/manager | approvedProductCount + pendingProductCount; revenue = delivered only |
| GET | `/api/admin/users` | admin/manager | |
| PATCH | `/api/admin/users/[id]` | admin/manager | suspend/verify/reset password |
| DELETE | `/api/admin/users/[id]` | admin only | blocked if ACTIVE orders only (pending/confirmed/shipped) |
| GET | `/api/admin/orders` | admin/manager | all orders |
| PATCH | `/api/admin/orders/[id]` | admin/manager | manager: state machine; admin: free override |
| GET | `/api/admin/products` | admin/manager | all products, no approval filter |
| PATCH | `/api/admin/products/[id]` | admin/manager | approve/reject/edit; audit logged |
| GET | `/api/admin/farmer-stats` | admin/manager | per-farmer: productCount/approvedCount/pendingCount/totalOrderItems/totalRevenue(delivered) |
| GET | `/api/admin/audit-logs` | admin/manager | |
| POST | `/api/orders` | authenticated | validates: stock, approved, same-farmer; $transaction; restores stock on cancel |
| GET | `/api/customer/orders` | authenticated | caller's own orders |
| PATCH | `/api/customer/orders/[id]` | authenticated | pending→cancelled (stock restore); shipped→delivered |
| GET | `/api/farmer/orders` | farmer | orders with farmer's products |
| PATCH | `/api/farmer/orders/[id]` | farmer | state machine + stock restore on cancel |
| GET | `/api/users/me` | authenticated | |
| PATCH | `/api/users/me` | authenticated | name/email/idImageUrl/password change |

---

## Key Implementation Details (important for future sessions)

### `getActiveAuthUser` (async, in `/lib/getActiveAuthUser.ts`)
Replaces the old sync `getAuthUser`. Verifies JWT then checks DB for `suspended: true`. Returns `null` if suspended or not found. Used in ALL API routes.

### Revenue counting
Only `status: 'delivered'` orders count as revenue — in stats API, farmer-stats API, and farmer overview page.

### Stock management
- Decremented atomically in `POST /api/orders` transaction
- Restored in `$transaction` when any order is cancelled (customer, farmer, or admin)

### Cart isolation
`CartContext` uses `cart_${user.id}` as localStorage key. Reads `user` from `AuthContext` (which is a parent provider). Waits for `authLoading` to finish before loading cart to avoid guest-cart flash.

### Layout / scroll architecture
- Navbar: `sticky top-0 z-50 h-14`; gains `shadow-xl` on scroll (scroll listener in Navbar.tsx)
- Root layout: `body` is `h-full flex flex-col` (exactly 100vh); `main` is `flex-1 min-h-0 overflow-y-auto` — public pages scroll inside `main`
- Dashboard + Farmer layouts: `flex h-full overflow-hidden` — body never scrolls; sidebar (`overflow-y-auto`) and content (`overflow-y-auto`) scroll independently. No JS body lock needed.

### Prisma notes
- Custom output path means `npx prisma generate` must be run manually after `migrate dev`
- Use **Bash tool** (not PowerShell) for `npx prisma migrate dev` — PowerShell execution policy blocks it

---

## Known Technical Debt

| Issue | Severity | Notes |
|-------|----------|-------|
| `Float` used for money fields | Medium | Should be `Decimal`; rounding errors possible |
| No input validation on some API routes | Medium | `products/[id] PATCH` trusts client-supplied types |
| Weak JWT secret likely in `.env` | High | Not committed but structure may be exposed |
| `console.error` left in some routes | Low | Should use structured logging |
| No image upload | Low | URL-only; deferred per scope |
| Message Farmer button | Low | UI exists, greyed out — backend + UI not built |

---

## Not Yet Built (Deferred)

- **Farmer ↔ customer/admin messaging** — button exists in product detail page, greyed out
- Crop monitoring (growth stages, planting dates, weather impact, pest/disease)
- Sales reports, earnings history (downloadable)
- Weather API + market price API integrations
- Pest advisory AI
- Coming-soon listings with harvest date
- Image upload (currently URL-only)
- Notifications
- Language toggle (EN/TL)
- Print receipts / download reports
