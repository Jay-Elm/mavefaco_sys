# Development Status — CoopMarket Capstone

_Last updated: 2026-05-12_

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

**Auth flow:** Login → JWT stored in localStorage → `AuthContext` provides `user`, `token`, `loading` → API routes extract token via `getAuthUser()` helper → `authorize(user, roles[])` enforces role access.

---

## Database Schema (Prisma)

- `User` — id, name, email, password, role, **suspended**, createdAt, updatedAt
- `Category` — id, name (unique), createdAt
- `Product` — id, name, description, price (Float), stock, imageUrl, farmerId, categoryId
- `Order` — id, totalAmount, status, createdAt, customerId
- `OrderItem` — id, quantity, price, orderId, productId
- `AuditLog` — id, action, entityType, entityId, timestamp, userId

Migration applied: `20260511155826_add_user_suspended`

---

## Completed Features

### Public Pages
- `/` — Hero, How It Works, Featured Products (last 6 from DB)
- `/products` — Product listing with category filter (Server Component, URL-based)
- `/products/[id]` — Product detail page
- `/login` — React Hook Form + Zod, suspension error shown on 403
- `/register` — React Hook Form + Zod

### Admin Dashboard (`/dashboard/`) — admin + manager roles
- `layout.tsx` — dark sidebar, auth guard, role check
- `page.tsx` — stats overview (users, products, orders, revenue, recent orders)
- `users/` — list all users; Suspend/Reactivate (yellow/green); Delete (admin-only, blocked if has orders/products in orders); inline error rows
- `categories/` — list with product count; inline add form; delete (blocked if products exist)
- `products/` — list all products; delete with inline error
- `orders/` — expandable rows; inline status select dropdown
- `audit-logs/` — last 100 entries; client-side search filter; action color badges

### Farmer Dashboard (`/farmer/`) — farmer role only
- `layout.tsx` — green-accent sidebar, auth guard (farmer only)
- `page.tsx` — overview: product count, order count, total revenue; quick-action buttons
- `products/` — my products table; Edit → edit page; Delete with inline error
- `products/new/` — create product form (name, description, price, stock, category, image URL)
- `products/[id]/edit/` — pre-filled edit form
- `orders/` — orders containing my products; expandable items; status select
- `profile/` — edit name/email; updates localStorage auth state in-place

### API Routes
| Method | Route | Auth |
|--------|-------|------|
| POST | `/api/auth/register` | public |
| POST | `/api/auth/login` | public (checks suspended) |
| GET | `/api/products` | public (`?categoryId=`, `?farmerId=`) |
| POST | `/api/products` | farmer/manager/admin |
| GET | `/api/products/[id]` | public |
| PATCH | `/api/products/[id]` | farmer (own) / admin / manager |
| DELETE | `/api/products/[id]` | farmer (own) / admin / manager |
| GET | `/api/categories` | public (includes `_count.products`) |
| POST | `/api/categories` | admin / manager |
| DELETE | `/api/categories/[id]` | admin / manager (blocked if products exist) |
| GET | `/api/admin/stats` | admin / manager |
| GET | `/api/admin/users` | admin / manager |
| PATCH | `/api/admin/users/[id]` | admin / manager (role hierarchy enforced) |
| DELETE | `/api/admin/users/[id]` | admin only (blocked if has orders) |
| GET | `/api/admin/orders` | admin / manager |
| PATCH | `/api/admin/orders/[id]` | admin / manager |
| GET | `/api/admin/audit-logs` | admin / manager |
| GET | `/api/farmer/orders` | farmer (own orders only) |
| PATCH | `/api/farmer/orders/[id]` | farmer (ownership verified) |
| GET | `/api/users/me` | any authenticated |
| PATCH | `/api/users/me` | any authenticated |

### Components
- `Navbar` — role-based links: admin/manager → `/dashboard`, farmer → `/farmer`
- `ProductCard` — next/image with unoptimized for user URLs; category badge; ₱ price
- `Providers` — thin client wrapper for `AuthProvider`

---

## Known Technical Debt

| Issue | Severity | Notes |
|-------|----------|-------|
| `Float` used for money fields | Medium | Should be `Decimal`; rounding errors possible |
| No input validation on some API routes | Medium | `products/[id] PATCH` trusts client-supplied types |
| Weak JWT secret likely in `.env` | High | Not committed but `.env.example` may expose structure |
| `console.error` left in products GET/GET[id] | Low | Should use structured logging |
| No order creation flow for customers | High | Customers can browse but cannot actually place orders |
| No cart / checkout | High | Not yet built |
| No image upload | Low | URL-only; deferred per scope doc |
| No password change | Low | Deferred per scope doc |

---

## Not Yet Built (Deferred)

Per the project scope document, these are explicitly deferred to later phases:

- **Customer cart + checkout + order placement**
- Crop monitoring (growth stages, planting dates, weather impact, pest/disease)
- Farmer ↔ customer/admin messaging
- Sales reports, earnings history
- Weather API + market price API integrations
- Pest advisory AI
- Coming-soon listings with harvest date
- Image upload (currently URL-only)
- Password reset / change
- Notifications
- Language toggle (EN/TL)
- Print receipts / download reports
