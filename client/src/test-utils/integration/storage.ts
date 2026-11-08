import { vi } from "vitest";

export type StorageCall = { method: string; url: string; paths?: string[] };

/**
 * Replaces global fetch with a fake Supabase Storage for the current test
 * (undo with vi.unstubAllGlobals / vi.unstubAllEnvs). `deleteOk` decides,
 * per object path, whether a DELETE succeeds; `uploadOk` does the same for
 * uploads. Signing a path (or a batch of paths) always succeeds.
 * `bucketMissing`: uploads answer "Bucket not found" until the bucket is
 * created. Returns the list of calls made, for assertions.
 */
export function fakeStorage({
  deleteOk = () => true,
  uploadOk = true,
  bucketMissing = false,
}: { deleteOk?: (path: string) => boolean | "network"; uploadOk?: boolean; bucketMissing?: boolean } = {}) {
  let bucketExists = !bucketMissing;
  vi.stubEnv("SUPABASE_URL", "https://storage.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
  const calls: StorageCall[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init: RequestInit = {}) => {
      const url = String(input);
      const method = init.method ?? "GET";
      if (method === "DELETE") {
        const { prefixes } = JSON.parse(String(init.body)) as { prefixes: string[] };
        calls.push({ method, url, paths: prefixes });
        const outcome = deleteOk(prefixes[0]);
        if (outcome === "network") throw new TypeError("fetch failed");
        return outcome
          ? new Response(JSON.stringify([{ name: prefixes[0] }]), { status: 200 })
          : new Response("storage unavailable", { status: 503 });
      }
      calls.push({ method, url });
      if (url.endsWith("/storage/v1/bucket")) {
        bucketExists = true;
        return new Response("{}", { status: 200 });
      }
      if (!bucketExists && /\/object\/[^/]+\/.+/.test(url) && !url.includes("/object/sign/"))
        return new Response(JSON.stringify({ error: "Bucket not found" }), { status: 400 });
      // A batch of signed links: POST /object/sign/<bucket> with { paths }.
      const batch = init.body && typeof init.body === "string" ? (JSON.parse(init.body) as { paths?: string[] }).paths : undefined;
      if (batch) {
        const bucket = url.split("/object/sign/")[1];
        return new Response(JSON.stringify(batch.map((p) => ({ path: p, signedURL: `/object/sign/${bucket}/${p}?token=t`, error: null }))), { status: 200 });
      }
      // A signed view link, as Supabase returns it (relative to /storage/v1).
      const signed = url.match(/\/object\/sign\/(.+)$/);
      if (signed) return new Response(JSON.stringify({ signedURL: `/object/sign/${signed[1]}?token=t` }), { status: 200 });
      return new Response("{}", { status: uploadOk ? 200 : 500 });
    }),
  );
  return calls;
}
