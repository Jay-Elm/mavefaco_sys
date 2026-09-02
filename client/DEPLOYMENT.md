# Deployment Guide — CoopMarket Capstone

Target: Vercel (frontend + API routes) + Supabase (PostgreSQL)

---

## Prerequisites

- Node.js 20+ installed locally
- A [Vercel](https://vercel.com) account (free)
- A [Supabase](https://supabase.com) account (free)
- Git repository pushed to GitHub

---

## Step 1 — Push the repo to GitHub (if not yet done)

```bash
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin master
```

---

## Step 2 — Provision a cloud PostgreSQL database (Supabase)

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New Project** → fill in name, password, region (choose Asia — Singapore for lower latency).
3. Wait for the project to finish provisioning (~2 minutes).
4. Go to **Project Settings → Database → Connection string → URI**.
5. Copy the connection string. It looks like:
   ```
   postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
   ```
6. Replace `<password>` with the database password you set in step 2.
7. Keep this URL — you will need it in Step 4.

---

## Step 3 — Fix `next.config.ts`

Remove the `allowedDevOrigins` line — it is a dev-only setting and is not needed in production.

Open `next.config.ts` and change it to:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

Commit the change:

```bash
git add next.config.ts
git commit -m "remove dev-only allowedDevOrigins for production"
git push
```

---

## Step 4 — Generate a strong JWT secret

Run this in your terminal to generate a secure 64-character secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output. You will use it as `JWT_SECRET` in Step 6.

---

## Step 5 — Run database migrations against Supabase

In your local terminal, inside the `client/` directory:

```bash
# Set the Supabase DATABASE_URL temporarily for this command
$env:DATABASE_URL="postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"

npx prisma migrate deploy
npx prisma generate
```

> **Important:** `npx prisma generate` is required after every migration because this project uses a custom Prisma output path (`generated/prisma`).

Verify the migrations ran successfully — you should see all 7 migrations applied with no errors.

---

## Step 6 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in.
2. Click **Add New → Project**.
3. Import your GitHub repository.
4. Set the **Root Directory** to `client` (since the Next.js app lives in `client/`, not the repo root).
5. Under **Environment Variables**, add the following:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | The Supabase connection string from Step 2 |
   | `JWT_SECRET` | The generated secret from Step 4 |

6. Click **Deploy**.
7. Wait for the build to complete (~2–3 minutes).

---

## Step 7 — Verify the deployment

Once deployed, Vercel gives you a URL like `https://your-project.vercel.app`. Check the following:

- [ ] Home page loads with banners and featured products
- [ ] Register a new Customer account
- [ ] Register a new Farmer account
- [ ] Log in as each role and confirm the correct redirect (Customer → /products, Farmer → /farmer)
- [ ] Admin login works (you may need to manually set a user's role to `admin` in Supabase's Table Editor)
- [ ] Add a product as Farmer, approve it as Admin, add to cart as Customer, place an order

---

## Step 8 — Seed an admin user (first-time only)

Supabase's Table Editor lets you manually edit rows. To create the first admin:

1. Go to Supabase → **Table Editor → User**.
2. Find your registered user row.
3. Set `role` to `admin`.
4. Save.

Alternatively, run this SQL in Supabase → **SQL Editor**:

```sql
UPDATE "User" SET role = 'admin' WHERE email = 'your@email.com';
```

---

## Known Limitations (acceptable for capstone)

| Item | Notes |
|---|---|
| `Float` for price/stock | Minor rounding risk; not an issue for demo scale |
| JWT in `localStorage` | XSS risk; acceptable for capstone, not for real production |
| No image file upload | Products use image URLs only; hosting images externally (e.g., Imgur) works fine |
| Messaging uses polling (8s) | Not real-time WebSocket; functional for demo |
| No password reset email | Password reset is admin-only via dashboard |

---

## Environment Variables Reference

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:pass@db.xyz.supabase.co:5432/postgres` |
| `JWT_SECRET` | Secret for signing JWTs — must be long and random | `a3f8d2...` (64 hex chars) |

> Never commit `.env` to git. Keep these values only in Vercel's environment variable settings.

---

## Redeploying after code changes

Push to the `master` branch and Vercel automatically rebuilds. If you add a new Prisma migration:

```bash
# Run against production DB first
$env:DATABASE_URL="<supabase-url>"
npx prisma migrate deploy
npx prisma generate

# Then push code
git push
```
