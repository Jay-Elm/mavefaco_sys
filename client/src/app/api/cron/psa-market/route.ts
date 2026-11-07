import { NextRequest, NextResponse } from "next/server";
import { syncPsaMarket } from "@/lib/psa";

// PSA's server can be slow; a full run is about a dozen requests.
export const maxDuration = 60;

/**
 * Vercel Cron target (see vercel.json), weekly: copies PSA farmgate prices
 * and production volumes for Albay and Bicol into the database. A table PSA
 * fails to serve is skipped and the run answers 502, so it shows in the cron
 * logs; whatever did arrive is kept, and next week's run tries again.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("psa-market: CRON_SECRET not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${expected}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await syncPsaMarket();
  if (result.errors.length) console.error("psa-market:", result.errors.join("; "));
  return NextResponse.json(result, { status: result.errors.length ? 502 : 200 });
}
