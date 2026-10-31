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

// Email clients need an absolute image URL, and most block SVG, so the logo
// is a PNG copy of public/logo.svg served from production. Preview
// deployments sit behind Vercel's sign-in, so their emails use it too.
const LOGO_URL = "https://mavefaco-sys.vercel.app/email/logo.png";

/**
 * Wraps an email body in the cooperative's letterhead: the logo and name
 * above, a short footer below. Table layout and inline styles, because
 * that is what email clients render reliably. `body` is already-escaped
 * HTML from `emailHtml`.
 */
export function emailLayout(body: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F8F4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8F4;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E3E5DC;border-radius:12px;">
<tr><td style="padding:20px 28px;border-bottom:4px solid #013B1E;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;padding-right:12px;"><img src="${LOGO_URL}" width="120" height="40" alt="" style="display:block;border:0;"></td>
<td style="vertical-align:middle;font-family:Arial,Helvetica,sans-serif;color:#2B2622;">
<div style="font-size:20px;font-weight:bold;line-height:1.1;">MaVeFaCo</div>
<div style="font-size:12px;line-height:1.3;color:#5F5A55;">Mayon Vegetable Farmers Agriculture Cooperative</div>
</td>
</tr></table>
</td></tr>
<tr><td style="padding:24px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#2B2622;word-break:break-word;overflow-wrap:anywhere;">
${body}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #E3E5DC;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#5F5A55;">
MaVeFaCo sent this automatic email about your account. Questions? Write to mavefaco@gmail.com.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * Sends a transactional email via Brevo, inside `emailLayout`. Returns false on any failure
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
        htmlContent: emailLayout(html),
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
