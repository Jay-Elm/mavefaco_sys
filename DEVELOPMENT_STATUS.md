# Development Status — Cooperative Marketplace Capstone

**Last updated:** 2026-05-11  
**Branch:** master  
**Commit:** f7bbbfe (Initial commit)

---

## 1. Architecture

The project is a **Next.js 15 full-stack monorepo** using the App Router. There is no separate backend service — API routes live alongside the frontend inside the same Next.js application.

```
proj/
└── client/                   # Single Next.js 15 application
    ├── prisma/               # PostgreSQL schema + migrations (Prisma ORM)
    ├── src/
    │   ├── app/
    │   │   ├── api/          # RESTful API routes (backend)
    │   │   └── (pages)/      # Frontend pages (App Router)
    │   ├── lib/              # Shared server-side utilities
    │   ├── components/       # React UI components (empty)
    │   ├── hooks/            # Custom React hooks (empty)
    │   ├── services/         # Axios API client abstractions (empty)
    │   ├── types/            # TypeScript type definitions (empty)
    │   ├── utils/            # General utilities (empty)
    │   ├── validators/       # Zod validation schemas (empty)
    │   ├── constants/        # App-wide constants (empty)
    │   └── middleware/       # Next.js middleware (empty)
    └── generated/prisma/     # Auto-generated Prisma client
```

**Tech stack:**

| Layer | Technology |
|---|---|
| Framework | Next.js 15.2.6, React 19.2.4 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL (local, port 5432) |
| ORM | Prisma 7.8.0 |
| Auth | JWT (`jsonwebtoken`), bcrypt (`bcryptjs`) |
| Validation | Zod + React Hook Form |
| HTTP Client | Axios |

---

## 2. Main Modules

### `src/lib/` — Server utilities

| File | Purpose |
|---|---|
| `prisma.ts` | Singleton Prisma client with PostgreSQL adapter |
| `auth.ts` | `verifyToken(token)` — decodes and validates a JWT |
| `authorize.ts` | `authorize(req, allowedRoles[])` — extracts Bearer token and checks role |
| `roles.ts` | Role constants: `ADMIN`, `MANAGER`, `FARMER`, `CUSTOMER` |

### `src/app/api/` — API routes

| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/auth/register` | POST | None | Create account (name, email, password) |
| `/api/auth/login` | POST | None | Login → returns JWT (7-day expiry) |
| `/api/products` | GET | None | List all products; filter by `?categoryId=` |
| `/api/products` | POST | FARMER / MANAGER / ADMIN | Create product; writes AuditLog entry |
| `/api/products/[id]` | GET | None | Get single product with category + farmer |
| `/api/protected` | GET | Any valid JWT | Token verification smoke-test |
| `/api/admin` | GET | ADMIN only | Admin smoke-test endpoint |

### `src/app/` — Frontend pages

| File | Status |
|---|---|
| `layout.tsx` | Root layout with Geist font imports |
| `page.tsx` | Home page — **empty, no UI** |
| `globals.css` | Tailwind base styles + CSS variables |

### `prisma/schema.prisma` — Database models

| Model | Key fields |
|---|---|
| `User` | id, name, email, password (hashed), role, timestamps |
| `Category` | id, name (unique) |
| `Product` | id, name, description, price, stock, imageUrl, farmerId, categoryId |
| `Order` | id, totalAmount, status (`pending`/…), customerId |
| `OrderItem` | id, quantity, price, orderId, productId |
| `AuditLog` | id, action, entityType, entityId, userId, timestamp |

---

## 3. Data Flow

### Authentication flow
```
Client → POST /api/auth/login
       → bcrypt.compare(password, hash)
       → jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "7d" })
       → returns { token }
```

### Protected request flow
```
Client → Authorization: Bearer <token>
       → authorize(req, allowedRoles) in lib/authorize.ts
       → verifyToken(token) in lib/auth.ts
       → role check → 401/403 or continue
```

### Product creation flow
```
Client → POST /api/products { name, description, price, stock, categoryId, imageUrl }
       → authorize(req, [FARMER, MANAGER, ADMIN])
       → prisma.product.create(...)
       → prisma.auditLog.create({ action: "CREATE_PRODUCT", entityId, userId })
       → returns created product
```

### Product listing flow
```
Client → GET /api/products?categoryId=X
       → prisma.product.findMany({ where: { categoryId }, include: { category, farmer } })
       → returns product array
```

---

## 4. Current Implementation Status

### Done
- [x] PostgreSQL schema — all 6 models designed and migrated
- [x] User registration with bcrypt password hashing
- [x] JWT-based login (7-day tokens)
- [x] Role constants (`ADMIN`, `MANAGER`, `FARMER`, `CUSTOMER`)
- [x] `authorize()` middleware utility for role-gated routes
- [x] Product listing API (with category filter)
- [x] Product creation API (role-gated, audit-logged)
- [x] Single product fetch API
- [x] AuditLog writes on product creation
- [x] Smoke-test endpoints (`/api/protected`, `/api/admin`)
- [x] Next.js App Router project scaffold
- [x] Tailwind CSS configured
- [x] TypeScript configured

### Not started
- [ ] All frontend UI pages (home, login, register, product listing, product detail, cart, checkout, orders, dashboard)
- [ ] React components library
- [ ] API client services (Axios wrappers in `src/services/`)
- [ ] Custom React hooks (auth state, cart, etc.)
- [ ] Zod validators for client-side form validation
- [ ] Next.js middleware (route protection at the router level)
- [ ] Order management API endpoints (create order, list orders, update order status)
- [ ] Category management API endpoints (CRUD)
- [ ] User profile API endpoints (get/update profile)
- [ ] Product update and delete endpoints
- [ ] Admin dashboard API (user management, reports)
- [ ] Image upload handling (currently only stores a URL string)

---

## 5. Technical Debt

### Critical
- **Weak secrets in `.env`** — `JWT_SECRET = "supersecretkey123"` and a hardcoded database password. These must be rotated before any deployment and `.env` must be added to `.gitignore`.
- **`.env` committed to git** — The `.env` file with plaintext credentials is checked in. Rotate credentials and remove from history before making the repo public.

### High
- **No input validation on API routes** — Register and login endpoints accept raw `req.json()` without Zod validation. Malformed payloads can cause unhandled errors.
- **No global error handling** — API routes have no `try/catch`; Prisma errors (e.g. duplicate email on register) will leak stack traces to the client.
- **Password policy not enforced** — Registration accepts any string as a password with no minimum length or complexity check.
- **No refresh token mechanism** — Tokens are fixed 7-day JWTs with no revocation path. A stolen token cannot be invalidated.

### Medium
- **Product price stored as `Float`** — Floating-point arithmetic causes rounding errors in financial calculations. Should use `Decimal` in Prisma and store as integer cents.
- **Order status is an untyped `String`** — Should be a Prisma `enum` (e.g. `PENDING`, `CONFIRMED`, `SHIPPED`, `DELIVERED`, `CANCELLED`).
- **AuditLog `action` is a plain string** — Should be an enum for consistency and queryability.
- **No pagination on `GET /api/products`** — Will return the entire products table with no limit.
- **Prisma client generated inside the repo** (`/generated/prisma/`) — This directory should be gitignored and generated at build time.

### Low
- **`src/components/`, `src/hooks/`, etc. are empty** — Placeholder directories add noise; populate or remove them.
- **`README.md` is the default Next.js boilerplate** — Should be replaced with project-specific documentation.

---

## 6. Missing Features

### Core marketplace flows (blocking for MVP)
- **Product browse page** — Grid/list view of all products with category filter, search, and pagination
- **Product detail page** — Images, description, farmer info, add-to-cart button
- **Shopping cart** — Client-side cart state, quantity adjustment, total calculation
- **Checkout flow** — Address input, order review, order submission (`POST /api/orders`)
- **Order history** — Customer view of past and active orders with status tracking
- **User authentication UI** — Login and registration pages with form validation

### Role-specific dashboards
- **Farmer dashboard** — Post new products, manage inventory (edit/delete), view orders containing their products
- **Manager/Admin dashboard** — User management, category management, order oversight, audit log viewer

### API endpoints not yet built
- `GET/POST /api/categories` — Category management
- `GET/POST /api/orders` — Order creation and listing
- `PATCH /api/orders/[id]` — Update order status
- `PATCH /api/products/[id]` — Update product
- `DELETE /api/products/[id]` — Delete product
- `GET /api/users/me` — Current user profile
- `PATCH /api/users/me` — Update profile

### Infrastructure
- **Image upload** — S3/Cloudinary integration or local file upload; currently the schema only stores a URL string
- **Email notifications** — Order confirmation, status updates
- **Rate limiting** — No throttling on auth endpoints (brute-force risk)
- **Search** — Full-text product search (PostgreSQL `tsvector` or external service)
- **Environment-specific config** — No staging/production environment separation

---

## Quick-start for next development session

```bash
cd client

# Install dependencies (if not done)
npm install

# Ensure PostgreSQL is running locally on port 5432
# Database: capstone_db, user: postgres, password: (see .env)

# Apply migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Start dev server
npm run dev
```

App runs at `http://localhost:3000`. Test the API with:
```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```
