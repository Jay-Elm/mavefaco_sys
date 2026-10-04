import type { NextConfig } from "next";

// Content-Security-Policy is shipped Report-Only for now: Next.js's App
// Router streams hydration data through inline <script> tags, so a strict
// script-src needs per-request nonces (middleware) to avoid breaking
// hydration — tracked as a follow-up. Report-Only lets us see what a
// tighter policy would have blocked in production before enforcing it.
const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  // api.open-meteo.com: the farmer dashboard's weather widget.
  "connect-src 'self' https://api.open-meteo.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  // Violations are posted to /api/csp-report and logged server-side.
  "report-uri /api/csp-report",
  "report-to csp",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
  { key: "Reporting-Endpoints", value: 'csp="/api/csp-report"' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
