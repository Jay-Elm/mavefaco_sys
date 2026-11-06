import { prisma } from "@/lib/prisma";

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

/**
 * Fixed-window rate limiter kept in Postgres (the RateLimit table), so every
 * Vercel instance counts against the same limit. One upsert per call: a key
 * whose window has ended starts again at 1.
 *
 * Raw SQL on purpose: it skips the Prisma write hook, so counting a login
 * attempt doesn't tell open pages to reload (src/lib/prisma.ts).
 *
 * If the database can't be reached, it falls back to a per-instance count
 * in memory rather than letting every request through.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  try {
    const [row] = await prisma.$queryRaw<{ count: number; wait: number }[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt")
      VALUES (${key}, 1, now() + make_interval(secs => ${windowMs / 1000}::double precision))
      ON CONFLICT ("key") DO UPDATE SET
        "count"   = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
      RETURNING "count", EXTRACT(EPOCH FROM ("resetAt" - now()))::float8 AS "wait"`;

    // Now and then, clear windows that ended long ago so the table stays small.
    if (Math.random() < 0.01) {
      await prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "resetAt" < now() - interval '1 day'`;
    }

    return row.count <= limit
      ? { allowed: true, retryAfterSeconds: 0 }
      : { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(row.wait)) };
  } catch (err) {
    console.error("rateLimit: database unavailable, counting in memory", err);
    return memoryRateLimit(key, limit, windowMs);
  }
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Per-instance fallback: only used when the database can't be reached. */
export function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  // Opportunistic cleanup so the map doesn't grow unbounded on a
  // long-lived instance.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (now >= b.resetAt) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
