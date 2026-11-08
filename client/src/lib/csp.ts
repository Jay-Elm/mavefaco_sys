/**
 * The Content-Security-Policy sent with every page (set per request by
 * src/proxy.ts, since the nonce changes each time).
 *
 * Scripts: only those carrying this request's nonce. Next.js adds it to
 * its own scripts automatically; 'strict-dynamic' lets those load the
 * chunks they need. An injected <script>, inline handler or javascript:
 * URL has no nonce and is blocked.
 *
 * Styles stay 'unsafe-inline' on purpose: React style={{...}} attributes
 * and next/image layout rely on inline styles, which nonces can't cover,
 * and style injection is far less dangerous than script injection. (A
 * nonce in style-src would also make browsers ignore 'unsafe-inline'.)
 *
 * Violations are reported to /api/csp-report and logged.
 */
export function buildCsp(nonce: string, { dev = false }: { dev?: boolean } = {}): string {
  return [
    "default-src 'self'",
    // React uses eval for richer error stacks in development only.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // Product photos can be any https URL (Supabase Storage today); the
    // MFA QR code is a data: URL.
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // api.open-meteo.com: the farmer dashboard's weather widget. The
    // Supabase socket: instant change signals (src/lib/liveSignal.ts).
    // Supabase over https: "Save QR image" downloads the picture.
    `connect-src 'self' https://api.open-meteo.com${realtimeSocket()}${supabaseHttps()}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "report-uri /api/csp-report",
    "report-to csp",
  ].join("; ");
}

/** " wss://<project>.supabase.co" when Supabase is configured, else "". */
function realtimeSocket(): string {
  try {
    return process.env.SUPABASE_URL ? ` wss://${new URL(process.env.SUPABASE_URL).host}` : "";
  } catch {
    return "";
  }
}

/** " https://<project>.supabase.co" when Supabase is configured, else "". */
function supabaseHttps(): string {
  try {
    return process.env.SUPABASE_URL ? ` https://${new URL(process.env.SUPABASE_URL).host}` : "";
  } catch {
    return "";
  }
}

export function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}
