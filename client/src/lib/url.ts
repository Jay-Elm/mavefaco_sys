/**
 * Allows only same-site relative paths ("/foo") or absolute http(s) URLs.
 * Rejects javascript:, data:, vbscript:, and protocol-relative ("//host")
 * URLs — anything a browser would execute or that escapes the site.
 * Use for any user- or admin-supplied string that gets rendered as a
 * clickable href (idImageUrl, banner ctaLink, site-content facebook_url, ...).
 */
export function isSafeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  if (trimmed.startsWith("/")) return !trimmed.startsWith("//");
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
