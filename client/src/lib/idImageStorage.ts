import { prisma } from "@/lib/prisma";

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

/** Stores one image in the private ID bucket. True once Supabase confirms it. */
export async function uploadIdImage(path: string, body: ArrayBuffer, contentType: string): Promise<boolean> {
  const config = storageConfig();
  if (!config) return false;
  try {
    const res = await fetch(`${config.supabaseUrl}/storage/v1/object/${ID_IMAGE_BUCKET}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.serviceKey}`, "Content-Type": contentType, "x-upsert": "true" },
      body,
    });
    if (!res.ok) {
      console.error(`id-image: upload of ${path} refused (${res.status}):`, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error(`id-image: failed to upload ${path}`, err);
    return false;
  }
}

/** How long a staff member's view link to an ID image works. */
export const SIGNED_URL_TTL_SECONDS = 300;

/** A short-lived link to view one ID image, or null if storage won't give one. */
export async function signIdImage(path: string): Promise<string | null> {
  const config = storageConfig();
  if (!config) return null;
  try {
    const res = await fetch(`${config.supabaseUrl}/storage/v1/object/sign/${ID_IMAGE_BUCKET}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
    });
    if (!res.ok) {
      console.error(`id-image: storage refused to sign ${path} (${res.status}):`, await res.text());
      return null;
    }
    const data: { signedURL?: string } = await res.json();
    return data.signedURL ? `${config.supabaseUrl}/storage/v1${data.signedURL}` : null;
  } catch (err) {
    console.error(`id-image: failed to sign ${path}`, err);
    return null;
  }
}

/** Deletes every given path; true only if storage confirmed all of them. */
export async function deleteIdImages(paths: (string | null)[]): Promise<boolean> {
  let ok = true;
  for (const path of paths) {
    if (path && !(await deleteIdImage(path))) ok = false;
  }
  return ok;
}

/**
 * Deletes the images of a farmer's replaced submissions now rather than at
 * the next daily purge. Paths are cleared only once storage confirms.
 */
export async function purgeReplaced(userId: number): Promise<void> {
  const replaced = await prisma.idSubmission.findMany({ where: { userId, status: "replaced", imagesPurgedAt: null } });
  for (const r of replaced) {
    if (await deleteIdImages([r.frontPath, r.backPath, r.selfiePath])) {
      await prisma.idSubmission.update({
        where: { id: r.id },
        data: { frontPath: null, backPath: null, selfiePath: null, imagesPurgedAt: new Date() },
      });
    } else {
      console.error(`id-submission: images of replaced submission ${r.id} not deleted yet; the daily purge will retry`);
    }
  }
}
