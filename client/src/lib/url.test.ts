import { describe, expect, it } from "vitest";
import { isSafeUrl } from "./url";

describe("isSafeUrl", () => {
  it("accepts a same-site relative path", () => {
    expect(isSafeUrl("/about")).toBe(true);
  });

  it("accepts absolute http(s) URLs", () => {
    expect(isSafeUrl("https://example.com/page")).toBe(true);
    expect(isSafeUrl("http://example.com")).toBe(true);
  });

  it("rejects a protocol-relative URL that escapes the site", () => {
    expect(isSafeUrl("//evil.com")).toBe(false);
  });

  it("rejects javascript: URLs", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects data: and vbscript: URLs", () => {
    expect(isSafeUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeUrl("vbscript:msgbox(1)")).toBe(false);
  });

  it("rejects an empty or whitespace-only value", () => {
    expect(isSafeUrl("")).toBe(false);
    expect(isSafeUrl("   ")).toBe(false);
  });

  it("rejects an unparseable string", () => {
    expect(isSafeUrl("not a url")).toBe(false);
  });
});
