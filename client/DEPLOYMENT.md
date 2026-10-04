# Deployment Guide — MaVeFaCo Marketplace

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

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Runtime connection — Supabase **Transaction** pooler (port 6543) |
| `DIRECT_URL` | Yes | Migration connection — Supabase **Session** pooler (port 5432 on the pooler host; the true direct endpoint is IPv6-only and unreachable from Vercel) |
| `JWT_SECRET` | Yes | Signs session tokens; at least 32 random characters |
| `TOTP_ENCRYPTION_KEY` | Strongly recommended | Encrypts staff MFA secrets; at least 32 random characters. Without it the MFA key is derived from `JWT_SECRET`, so rotating `JWT_SECRET` would break every enrolled authenticator |
| `TOTP_ENCRYPTION_KEY_PREVIOUS` | Only while rotating | The old `TOTP_ENCRYPTION_KEY` value, so existing secrets keep decrypting until each user's next login re-encrypts them |
| `BREVO_API_KEY` | Yes | Transactional email (verification, password reset, security notices) |
| `SUPABASE_URL` | Yes | Supabase project URL, for product images and ID storage |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side Storage access; never expose to the browser |
| `CRON_SECRET` | Yes | Authenticates Vercel Cron calls to `/api/cron/purge-id-images` |

Generate random values with `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`.

**Rotating secrets.**
- `JWT_SECRET`: logs everyone out (expected). Safe for MFA only once `TOTP_ENCRYPTION_KEY` is set *and* every admin/manager has logged in at least once since — each login moves that account's MFA secret onto the new key. Staff who haven't yet can still sign in with a backup code, or an admin can reset their MFA.
- `TOTP_ENCRYPTION_KEY`: set the new value, move the old one to `TOTP_ENCRYPTION_KEY_PREVIOUS`, and remove `_PREVIOUS` once all staff have logged in.

**Preview deployments.** Preview must not share Production's database or signing keys. Give Preview its own Supabase project and its own `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` and `TOTP_ENCRYPTION_KEY` (each a separate Vercel variable scoped to Preview only), then set `PREVIEW_DATABASE_ISOLATED=true` for Preview. `npm run build` (`scripts/migrate.mjs`) skips `prisma migrate deploy` on Preview builds until that flag is set, so a shared database is never migrated from a branch; never set the flag while Preview still shares Production's database. A shared `JWT_SECRET` with separate databases is unsafe: a token issued on Preview would be accepted by Production as whichever production user has the same ID.

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
