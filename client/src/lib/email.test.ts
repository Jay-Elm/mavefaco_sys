import { describe, expect, it } from "vitest";
import { emailHtml, escapeHtml } from "./email";

describe("escapeHtml", () => {
  it("escapes every character that can start markup or break out of an attribute", () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
    );
  });

  it("stringifies non-string values", () => {
    expect(escapeHtml(42)).toBe("42");
  });
});

describe("emailHtml", () => {
  it("escapes interpolated values but keeps the template's own markup", () => {
    const name = '<a href="https://evil.test">Claim your prize</a>';
    expect(emailHtml`<p>Hi ${name},</p>`).toBe(
      "<p>Hi &lt;a href=&quot;https://evil.test&quot;&gt;Claim your prize&lt;/a&gt;,</p>",
    );
  });

  it("leaves ordinary names, addresses and links readable", () => {
    const url = "https://mavefaco-sys.vercel.app/verify-email?token=abc123";
    expect(emailHtml`<p>Hi ${"Juan dela Cruz"} (${"juan@example.com"})</p><a href="${url}">${url}</a>`).toBe(
      `<p>Hi Juan dela Cruz (juan@example.com)</p><a href="${url}">${url}</a>`,
    );
  });
});
