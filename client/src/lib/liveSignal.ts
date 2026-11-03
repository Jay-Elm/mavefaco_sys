import { after } from "next/server";

/**
 * Instant updates: after anything is written to the database, one empty
 * "change" message goes out on a Supabase Realtime channel. Open pages are
 * subscribed to it and, on hearing it, run their usual /api/live check, so
 * they update within a second instead of waiting for the 15-second poll.
 *
 * The message carries nothing (no ids, no content). Who may see what is
 * still decided by /api/live and the other routes, behind their normal
 * login checks. The poll stays as a backup for when Realtime is down or
 * not configured.
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (to send) and
 * SUPABASE_ANON_KEY (handed to browsers, to listen). Without them nothing
 * is sent and pages simply poll.
 */

export const LIVE_TOPIC = "live";

/** What a browser needs to listen, or null when Realtime isn't set up. */
export function realtimeClientConfig(): { url: string; key: string; topic: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key, topic: LIVE_TOPIC };
}

async function send(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ topic: LIVE_TOPIC, event: "change", payload: {} }] }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) console.error("live-signal: broadcast failed", res.status);
  } catch (err) {
    console.error("live-signal: broadcast failed", err);
  }
}

// Writes close together (several in one request, or in requests running at
// the same time) share one message. A write joins the pending message only
// while it hasn't gone out yet, so no write is announced before it is saved.
let scheduled: Promise<void> | null = null;

function sendSoon(): Promise<void> {
  scheduled ??= new Promise<void>((resolve) => setTimeout(resolve, 50)).then(() => {
    scheduled = null;
    return send();
  });
  return scheduled;
}

/**
 * Announce that something changed. Called by the Prisma client after every
 * write; the message goes out after the response, so after the request's
 * transaction has committed.
 */
export function signalChange(): void {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    after(sendSoon);
  } catch {
    // Outside a request (a script): send straight away.
    void sendSoon();
  }
}
