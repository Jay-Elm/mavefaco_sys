# Where We Left Off

_Updated: 2026-05-12 (session 2)_

## Last completed task

**Customer Use Case MVP** — fully built and complete.

- `CartContext` (localStorage-backed) + `CartProvider` wired into `Providers.tsx`
- `AddToCartButton` client component on `/products/[id]` — replaces the disabled "coming soon" button
- `/cart` page — item list with qty controls, order summary, Place Order button
- `POST /api/orders` — atomic transaction: validates stock, creates Order + OrderItems, decrements stock, audit logs
- `GET /api/customer/orders` — returns caller's own orders
- `/customer/orders` page — order history with expandable rows and status badges
- Navbar updated: cart icon with live badge count, "My Orders" link for customer role

---

## Immediate next candidates

1. **End-to-end smoke test** — no manual testing done yet. Run `npm run dev` and walk: register as farmer → add product → register as customer → add to cart → place order → check /customer/orders.

2. **Input validation hardening** — `PATCH /api/products/[id]` and `POST /api/products` accept fields without strict type/length checks. Add Zod schemas on the API layer.

3. **Money type fix** — `price` and `totalAmount` are `Float` in Prisma. Should migrate to `Decimal` before production to avoid rounding errors.

4. **Stock sync in cart** — cart items store `stock` at add-time; if another user buys the same product, cart's displayed max won't update until refresh. The API validates real stock at order time (safe), but the UI could get out of date.

---

## File map (quick reference)

```
src/app/
  page.tsx                        ← home (hero + featured products)
  login/page.tsx
  register/page.tsx
  products/page.tsx               ← public listing
  products/[id]/page.tsx          ← product detail

  dashboard/                      ← admin + manager
    layout.tsx
    page.tsx                      ← stats overview
    users/page.tsx
    categories/page.tsx
    products/page.tsx
    orders/page.tsx
    audit-logs/page.tsx

  cart/page.tsx                   ← cart + checkout

  customer/                       ← customer role
    orders/page.tsx               ← order history

  farmer/                         ← farmer role
    layout.tsx
    page.tsx                      ← overview stats
    products/page.tsx
    products/new/page.tsx
    products/[id]/edit/page.tsx
    orders/page.tsx
    profile/page.tsx

  api/
    auth/login/route.ts
    auth/register/route.ts
    products/route.ts             ← GET (?farmerId, ?categoryId), POST
    products/[id]/route.ts        ← GET, PATCH, DELETE
    categories/route.ts           ← GET (public), POST (admin/mgr)
    categories/[id]/route.ts      ← DELETE (admin/mgr)
    users/me/route.ts             ← GET, PATCH (self)
    admin/stats/route.ts
    admin/users/route.ts
    admin/users/[id]/route.ts     ← PATCH (suspend), DELETE
    admin/orders/route.ts
    admin/orders/[id]/route.ts    ← PATCH (status)
    admin/audit-logs/route.ts
    farmer/orders/route.ts        ← GET (farmer's orders)
    farmer/orders/[id]/route.ts   ← PATCH (status)
    orders/route.ts               ← POST (place order — any authenticated)
    customer/orders/route.ts      ← GET (caller's own orders)

src/contexts/AuthContext.tsx      ← JWT + localStorage auth state
src/contexts/CartContext.tsx      ← localStorage cart state
src/lib/
  auth.ts                         ← signToken, verifyToken
  authorize.ts                    ← authorize(user, roles[])
  getAuthUser.ts                  ← extracts JWT from Authorization header
  prisma.ts                       ← Prisma client singleton
  roles.ts                        ← ROLES constant

prisma/schema.prisma
```
