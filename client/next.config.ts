import type { NextConfig } from "next";

// The Content-Security-Policy itself is set per request in src/proxy.ts
// (policy in src/lib/csp.ts), because it carries a fresh script nonce each
// time. Reporting-Endpoints below names where its violation reports go.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera only for this site's own pages: the farmer ID capture flow.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
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
