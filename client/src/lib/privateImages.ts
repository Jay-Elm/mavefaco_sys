import { storageConfig } from "@/lib/idImageStorage";
import { detectImageType } from "@/lib/imageSniff";

/**
 * Private pictures people share with one another: photos sent in Messages
 * and a customer's own GCash QR code (for refunds). They live in a private
 * Supabase bucket and are shown through short-lived signed links, only to
 * the people allowed to see them. Product photos and a farmer's GCash QR
 * stay in the public product-images bucket.
 *
 * The bucket is created on first use, so no dashboard step is needed.
 */
export const PRIVATE_IMAGE_BUCKET = "private-images";
export const PRIVATE_IMAGE_MAX_BYTES = 4 * 1024 * 1024; // Vercel's request limit is ~4.5 MB
/** How long a view link works: long enough to read a conversation. */
export const PRIVATE_IMAGE_TTL_SECONDS = 60 * 60;

export type ImageCheck = { ok: true; body: ArrayBuffer; contentType: string; ext: string } | { ok: false; error: string };

/** Size and real type (from the bytes, not the file name) of an uploaded image. */
export async function checkImage(file: File | null): Promise<ImageCheck> {
  if (!file || typeof file === "string") return { ok: false, error: "No image attached" };
  if (file.size > PRIVATE_IMAGE_MAX_BYTES) return { ok: false, error: "Image too large (max 4 MB)" };
  const body = await file.arrayBuffer();
  const type = detectImageType(new Uint8Array(body));
  if (!type) return { ok: false, error: "The picture must be a PNG, JPEG or WEBP image" };
  return { ok: true, body, contentType: `image/${type}`, ext: type === "jpeg" ? "jpg" : type };
}

async function createBucket(supabaseUrl: string, serviceKey: string) {
  const res = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: PRIVATE_IMAGE_BUCKET,
      name: PRIVATE_IMAGE_BUCKET,
      public: false,
      file_size_limit: PRIVATE_IMAGE_MAX_BYTES,
      allowed_mime_types: ["image/png", "image/jpeg", "image/webp"],
    }),
  });
  // 409 / "already exists": another request made it first.
  return res.ok || res.status === 409 || /exist/i.test(await res.text());
}

/** Stores one image. True once Supabase confirms it. */
export async function uploadPrivateImage(path: string, body: ArrayBuffer, contentType: string): Promise<boolean> {
  const config = storageConfig();
  if (!config) {
    console.error("private-image: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
    return false;
  }
  const put = () =>
    fetch(`${config.supabaseUrl}/storage/v1/object/${PRIVATE_IMAGE_BUCKET}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.serviceKey}`, "Content-Type": contentType, "x-upsert": "true" },
      body,
    });
  try {
    let res = await put();
    if (!res.ok) {
      const text = await res.text();
      if (/bucket not found/i.test(text) && (await createBucket(config.supabaseUrl, config.serviceKey))) {
        res = await put();
        if (res.ok) return true;
      }
      console.error(`private-image: upload of ${path} refused (${res.status}):`, text);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`private-image: failed to upload ${path}`, err);
    return false;
  }
}

/** Signed view links for the given paths (one request); a path that fails is left out. */
export async function signPrivateImages(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  const config = storageConfig();
  if (!config || unique.length === 0) return out;
  try {
    const res = await fetch(`${config.supabaseUrl}/storage/v1/object/sign/${PRIVATE_IMAGE_BUCKET}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: PRIVATE_IMAGE_TTL_SECONDS, paths: unique }),
    });
    if (!res.ok) {
      console.error(`private-image: storage refused to sign (${res.status}):`, await res.text());
      return out;
    }
    const data: { path?: string; signedURL?: string | null }[] = await res.json();
    for (const d of data) {
      if (d.path && d.signedURL) out.set(d.path, `${config.supabaseUrl}/storage/v1${d.signedURL}`);
    }
  } catch (err) {
    console.error("private-image: failed to sign", err);
  }
  return out;
}

/** Deletes the given images; true only if storage confirmed (or there was nothing to delete). */
export async function deletePrivateImages(paths: (string | null | undefined)[]): Promise<boolean> {
  const list = paths.filter((p): p is string => !!p);
  if (list.length === 0) return true;
  const config = storageConfig();
  if (!config) return false;
  try {
    const res = await fetch(`${config.supabaseUrl}/storage/v1/object/${PRIVATE_IMAGE_BUCKET}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${config.serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: list }),
    });
    if (!res.ok) {
      console.error(`private-image: storage refused to delete (${res.status}):`, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("private-image: failed to delete", err);
    return false;
  }
}
