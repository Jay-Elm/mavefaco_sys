import { vi } from "vitest";

export type StorageCall = { method: string; url: string; paths?: string[] };

/**
 * Replaces global fetch with a fake Supabase Storage for the current test
 * (undo with vi.unstubAllGlobals / vi.unstubAllEnvs). `deleteOk` decides,
 * per object path, whether a DELETE succeeds; `uploadOk` does the same for
 * uploads. Returns the list of calls made, for assertions.
 */
export function fakeStorage({
  deleteOk = () => true,
  uploadOk = true,
}: { deleteOk?: (path: string) => boolean | "network"; uploadOk?: boolean } = {}) {
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
      return new Response("{}", { status: uploadOk ? 200 : 500 });
    }),
  );
  return calls;
}
