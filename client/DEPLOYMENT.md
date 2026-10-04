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
4. Click **Connect** on the project and copy two connection strings, replacing `<password>` in each with the database password you set:
   - **Transaction pooler** (port 6543): this becomes `DATABASE_URL`, used by the running app.
   - **Session pooler** (port 5432 on the `…pooler.supabase.com` host): this becomes `DIRECT_URL`, used for migrations.

   Don't use the "Direct connection" string (`db.<project-ref>.supabase.co`): it's IPv6-only and Vercel can't reach it.
5. Keep both; you'll add them in Step 6.

---

## Step 3 — Check `next.config.ts`

Nothing to change. `next.config.ts` is already production-ready: it sets the security response headers (HSTS, `X-Frame-Options`, `nosniff`, and others). Don't replace it with an empty config. The Content-Security-Policy itself is set per request by `src/proxy.ts`.

---

## Step 4 — Generate secrets

Run this in your terminal three times, once each for `JWT_SECRET`, `TOTP_ENCRYPTION_KEY` and `CRON_SECRET` (each a separate random 64-character value):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Keep the three values somewhere safe; you will add them in Step 6. Never paste them into chats, tickets or commits.

---

## Step 5 — Database migrations

You don't run migrations by hand. `npm run build` (`scripts/migrate.mjs`) runs `prisma migrate deploy` against `DIRECT_URL` on every **Production** deploy, so the first deploy creates all tables and later deploys apply new migrations. Preview builds migrate only their own database, and only when `PREVIEW_DATABASE_ISOLATED=true` (see the environment variables below).

`DIRECT_URL` must be Supabase's **Session pooler** connection string (port 5432 on the pooler host). Supabase's true direct endpoint (`db.<project-ref>.supabase.co`) is IPv6-only and can't be reached from Vercel's build servers or most local networks.

After changing `prisma/schema.prisma` locally, create the migration with `npx prisma migrate dev --name <change>` against your local database, then run `npx prisma generate` (Prisma 7 doesn't do this automatically) and commit both the migration and `generated/`.

---

## Step 6 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in.
2. Click **Add New → Project**.
3. Import your GitHub repository.
4. Set the **Root Directory** to `client` (since the Next.js app lives in `client/`, not the repo root).
5. Under **Environment Variables**, add every variable in the [reference below](#environment-variables-reference) for the **Production** environment: the two connection strings from Step 2, `JWT_SECRET` and `TOTP_ENCRYPTION_KEY` (generated as in Step 4), `BREVO_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`. Give Preview its own database and keys (see "Preview deployments" below).

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

Alternatively, run this SQL in Supabase → **SQL Editor** (this also marks the email verified, in case the verification email didn't arrive):

```sql
UPDATE "User" SET role = 'admin', "emailVerifiedAt" = COALESCE("emailVerifiedAt", NOW()) WHERE email = 'your@email.com';
```

On their next login, admins and managers must set up two-factor authentication with an authenticator app and save the one-time backup codes shown.

---

## Known Limitations

| Item | Notes |
|---|---|
| Every page renders per request | Required by the nonce-based Content-Security-Policy; pages aren't served from a CDN cache. Fine at the cooperative's traffic |
| Rate limits are per server instance | In-memory, so not strict across simultaneous Vercel instances. A shared store (e.g. Upstash Redis) would fix this |
| Messaging uses polling (8s) | Not real-time; functional for the cooperative's use |
| No online payments | Payment method is recorded on the order; payment happens outside the system |

The full list of what's in and out of scope is in [`SCOPE_AND_DELIMITATIONS.md`](SCOPE_AND_DELIMITATIONS.md).

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

**Content-Security-Policy.** The app enforces a strict, nonce-based CSP (see `src/lib/csp.ts`). Violations are logged as `CSP violation: …` lines in the Vercel runtime logs. Vercel's Preview toolbar injects its own script without the nonce, so on Preview deployments it may be blocked (harmless; the app itself is unaffected); turn the toolbar off for Preview in the Vercel project settings if the log noise bothers you.

**Preview deployments.** Preview must not share Production's database or signing keys. Give Preview its own Supabase project and its own `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` and `TOTP_ENCRYPTION_KEY` (each a separate Vercel variable scoped to Preview only), then set `PREVIEW_DATABASE_ISOLATED=true` for Preview. `npm run build` (`scripts/migrate.mjs`) skips `prisma migrate deploy` on Preview builds until that flag is set, so a shared database is never migrated from a branch; never set the flag while Preview still shares Production's database. A shared `JWT_SECRET` with separate databases is unsafe: a token issued on Preview would be accepted by Production as whichever production user has the same ID.

> Never commit `.env` to git. Keep these values only in Vercel's environment variable settings.

---

## Redeploying after code changes

Push to `master`; Vercel rebuilds and deploys automatically, applying any new migrations as part of the build. Every push also runs the test and dependency-audit workflows on GitHub. Other branches and pull requests get Preview deployments against the separate Preview database.
