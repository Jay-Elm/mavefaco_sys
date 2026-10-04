import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

const MAX_BODY_BYTES = 16 * 1024;

type Violation = { documentURL?: string; blockedURL?: string; effectiveDirective?: string };

/** Pulls the fields worth logging out of either report format browsers send. */
function violations(body: unknown): Violation[] {
  // Reporting API (report-to): [{ type: "csp-violation", body: {...} }, ...]
  if (Array.isArray(body)) {
    return body
      .filter((r) => r && typeof r === "object" && r.type === "csp-violation" && r.body)
      .map((r) => r.body as Violation);
  }
  // Legacy report-uri: { "csp-report": { "document-uri", "blocked-uri", "violated-directive" } }
  const legacy = (body as { "csp-report"?: Record<string, string> } | null)?.["csp-report"];
  if (legacy) {
    return [{
      documentURL: legacy["document-uri"],
      blockedURL: legacy["blocked-uri"],
      effectiveDirective: legacy["effective-directive"] ?? legacy["violated-directive"],
    }];
  }
  return [];
}

/**
 * POST /api/csp-report — receives Content-Security-Policy violation reports
 * (see next.config.ts) and writes a one-line summary of each to the server
 * log, so the Report-Only policy actually shows what enforcing it would
 * block. Public by necessity (browsers post anonymously), so it's
 * rate-limited per IP and size-capped, and never stores anything.
 */
export async function POST(req: NextRequest) {
  const { allowed } = rateLimit(`csp-report:${getClientIp(req)}`, 30, 60 * 1000);
  if (!allowed) return new NextResponse(null, { status: 429 });

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  for (const v of violations(body).slice(0, 10)) {
    console.warn(
      `CSP violation: ${v.effectiveDirective ?? "?"} blocked ${String(v.blockedURL ?? "?").slice(0, 200)} on ${String(v.documentURL ?? "?").slice(0, 200)}`,
    );
  }
  return new NextResponse(null, { status: 204 });
}
