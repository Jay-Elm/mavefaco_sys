# Where We Left Off

_Updated: 2026-05-12_

## Last completed task

**Farmer Dashboard MVP** — fully built and complete.

All pages under `/farmer/` are done (layout, overview, products list, new product, edit product, orders, profile).
All supporting API routes are done (`/api/farmer/orders`, `/api/farmer/orders/[id]`, `/api/users/me`, PATCH on `/api/products/[id]`).
Navbar updated with role-based links (farmers see "My Farm", admins/managers see "Dashboard").

---

## Immediate next candidates

These are the most impactful gaps remaining, in rough priority order:

1. **Customer cart + checkout + order placement** — customers can browse products but have no way to buy anything. This is the biggest missing piece for the core user journey.
   - Need: cart state (localStorage or DB), checkout page, `POST /api/orders` route that creates `Order` + `OrderItem` rows, decrements stock.

2. **Verify everything works end-to-end** — no manual testing has been done yet. Run `npm run dev` and walk through: register as farmer → add product → register as customer → (future) buy product.

3. **Input validation hardening** — `PATCH /api/products/[id]` and `POST /api/products` accept fields without strict type/length validation. Consider adding Zod schemas on the API layer.

4. **Money type fix** — `price` and `totalAmount` are `Float` in the schema. Floating-point arithmetic causes rounding errors in financial calculations. Should migrate to `Decimal` before going to production.

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

src/contexts/AuthContext.tsx      ← JWT + localStorage auth state
src/lib/
  auth.ts                         ← signToken, verifyToken
  authorize.ts                    ← authorize(user, roles[])
  getAuthUser.ts                  ← extracts JWT from Authorization header
  prisma.ts                       ← Prisma client singleton
  roles.ts                        ← ROLES constant

prisma/schema.prisma
```
