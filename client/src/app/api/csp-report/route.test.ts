import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

let ipSeq = 0;
const report = (body: string, ip = `10.9.0.${++ipSeq}`) =>
  POST(new NextRequest("http://localhost:3000/api/csp-report", {
    method: "POST",
    headers: { "content-type": "application/csp-report", "x-forwarded-for": ip },
    body,
  }));

afterEach(() => vi.restoreAllMocks());

describe("POST /api/csp-report", () => {
  it("logs a legacy report-uri violation as one line", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await report(JSON.stringify({
      "csp-report": { "document-uri": "https://mavefaco.test/farmer", "blocked-uri": "https://evil.test/x.js", "violated-directive": "script-src" },
    }));

    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledWith("CSP violation: script-src blocked https://evil.test/x.js on https://mavefaco.test/farmer");
  });

  it("logs Reporting API (report-to) batches", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await report(JSON.stringify([
      { type: "csp-violation", body: { documentURL: "https://a.test/", blockedURL: "inline", effectiveDirective: "script-src-elem" } },
      { type: "deprecation", body: {} },
    ]));

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("script-src-elem blocked inline");
  });

  it("rejects malformed and oversized bodies without logging", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect((await report("not json")).status).toBe(400);
    expect((await report("x".repeat(17 * 1024))).status).toBe(413);
    expect(warn).not.toHaveBeenCalled();
  });

  it("rate-limits each IP", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const statuses = [];
    for (let i = 0; i < 31; i++) statuses.push((await report("[]", "10.9.9.9")).status);

    expect(statuses.slice(0, 30).every((s) => s === 204)).toBe(true);
    expect(statuses[30]).toBe(429);
  });
});
