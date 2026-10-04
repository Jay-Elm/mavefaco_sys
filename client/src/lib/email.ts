const SENDER = { email: "mavefaco@gmail.com", name: "MaVeFaCo Support" };

export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Tagged template for email bodies: every interpolated value is
 * HTML-escaped, the literal template text is not. Names and email
 * addresses are user-chosen, and a raw `${user.name}` let anyone register a
 * stranger's address with an HTML "name" and have MaVeFaCo deliver their
 * markup (links, fake instructions) to that inbox.
 *
 *   html: emailHtml`<p>Hi ${user.name},</p>`
 */
export function emailHtml(strings: TemplateStringsArray, ...values: unknown[]): string {
  return strings.reduce((out, text, i) => out + text + (i < values.length ? escapeHtml(values[i]) : ""), "");
}

/**
 * Sends a transactional email via Brevo. Returns false on any failure
 * (missing API key, Brevo error) instead of throwing — callers should log
 * the failure but still respond to the client with a generic message, so
 * a broken email provider never becomes an oracle for account enumeration.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("BREVO_API_KEY not set");
    return false;
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: SENDER,
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });

    if (!res.ok) {
      console.error("Brevo send failed:", await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Brevo send error:", err);
    return false;
  }
}
