export const ID_IMAGE_BUCKET = "id-verification";

export function storageConfig(): { supabaseUrl: string; serviceKey: string } | null {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  return { supabaseUrl, serviceKey };
}

/**
 * Deletes one object from the private ID-verification bucket. Returns true
 * only when Supabase confirms it (an already-missing object also counts —
 * Supabase answers 200 with an empty list). Callers must keep their
 * database reference to the image whenever this returns false: these are
 * government ID scans (RA 10173), and clearing the path after a failed
 * delete would leave the file stored with nothing pointing at it, beyond
 * the reach of the retention purge.
 */
export async function deleteIdImage(path: string): Promise<boolean> {
  const config = storageConfig();
  if (!config) {
    console.error("id-image: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set; cannot delete", path);
    return false;
  }
  try {
    const res = await fetch(`${config.supabaseUrl}/storage/v1/object/${ID_IMAGE_BUCKET}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${config.serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: [path] }),
    });
    if (!res.ok) {
      console.error(`id-image: storage refused to delete ${path} (${res.status}):`, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error(`id-image: failed to delete ${path}`, err);
    return false;
  }
}
