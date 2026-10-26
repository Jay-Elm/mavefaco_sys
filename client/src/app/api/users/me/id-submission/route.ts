import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { rateLimit } from "@/lib/rateLimit";
import { detectImageType, imageSize } from "@/lib/imageSniff";
import { deleteIdImages, purgeReplaced, storageConfig, uploadIdImage } from "@/lib/idImageStorage";
import { findIdType, idNumberError, submissionSummary } from "@/lib/idVerification";
import { hashIdNumber, idNumberLast4 } from "@/lib/idNumberHash";
import { ROLES } from "@/lib/roles";

// The capture flow resizes photos on the phone before sending, so all three
// fit in one request under Vercel's ~4.5 MB body limit.
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
// Shorter side, in pixels: enough to read an ID's text.
const MIN_IMAGE_SIDE = 480;

/** Thrown inside the transaction to roll it back with a response. */
class SubmissionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

type Photo = { name: "front" | "back" | "selfie"; bytes: ArrayBuffer; ext: string; contentType: string };

/** Reads one photo from the form, or says what's wrong with it. */
async function readPhoto(form: FormData, name: Photo["name"], label: string): Promise<Photo | string> {
  const file = form.get(name);
  if (!(file instanceof File) || file.size === 0) return `The ${label} photo is missing`;
  if (file.size > MAX_IMAGE_BYTES) return `The ${label} photo is too large (max 1.5 MB)`;
  const bytes = await file.arrayBuffer();
  const view = new Uint8Array(bytes);
  const type = detectImageType(view);
  if (!type) return `The ${label} photo must be a PNG, JPEG or WEBP image`;
  const size = imageSize(view);
  if (!size || Math.min(size.width, size.height) < MIN_IMAGE_SIDE) return `The ${label} photo is too small to read; retake it closer or in better light`;
  return { name, bytes, ext: type === "jpeg" ? "jpg" : type, contentType: `image/${type}` };
}

/**
 * POST /api/users/me/id-submission — a farmer submits their ID for
 * verification: ID type and number, front, back (unless a passport) and a
 * selfie holding the ID. Replaces a pending submission. The number is kept
 * only as a keyed fingerprint plus its last 4 characters, and the same ID
 * can't be pending or approved on two accounts.
 */
export async function POST(req: NextRequest) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== ROLES.FARMER) return NextResponse.json({ error: "Only farmers verify an ID" }, { status: 403 });

  const { allowed, retryAfterSeconds } = rateLimit(`id-image:${actor.id}`, 10, 60 * 60 * 1000);
  if (!allowed)
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );

  if (!storageConfig()) {
    console.error("id-submission: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const me = await prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { verified: true } });
  if (me.verified) return NextResponse.json({ error: "Your account is already verified" }, { status: 409 });

  const idType = String(form.get("idType") ?? "");
  const idNumber = String(form.get("idNumber") ?? "");
  const captureMethod = form.get("captureMethod") === "camera" ? "camera" : "upload";
  const type = findIdType(idType);
  if (!type) return NextResponse.json({ error: "Choose an ID type" }, { status: 400 });
  const numberError = idNumberError(idType, idNumber);
  if (numberError) return NextResponse.json({ error: numberError }, { status: 400 });

  const photos: Photo[] = [];
  for (const [name, label] of [["front", "front"], ...(type.needsBack ? [["back", "back"]] : []), ["selfie", "selfie"]] as [Photo["name"], string][]) {
    const photo = await readPhoto(form, name, label);
    if (typeof photo === "string") return NextResponse.json({ error: photo }, { status: 400 });
    photos.push(photo);
  }

  // Upload first, then record; anything that stops the record from being
  // written deletes these uploads again.
  const stamp = Date.now();
  const paths: Partial<Record<Photo["name"], string>> = {};
  for (const photo of photos) {
    const path = `${actor.id}/${stamp}-${photo.name}.${photo.ext}`;
    if (!(await uploadIdImage(path, photo.bytes, photo.contentType))) {
      await discard(Object.values(paths), actor.id);
      return NextResponse.json({ error: "Upload failed, please try again" }, { status: 500 });
    }
    paths[photo.name] = path;
  }

  const numberHash = hashIdNumber(idType, idNumber);
  let submission;
  try {
    submission = await prisma.$transaction(async (tx) => {
      // Serializes submissions of the same ID number, so two accounts can't
      // both pass the check below at once.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${numberHash}))`;
      const taken = await tx.idSubmission.findFirst({
        where: { numberHash, userId: { not: actor.id }, status: { in: ["pending", "approved"] }, user: { deletedAt: null } },
      });
      if (taken) throw new SubmissionError("This ID is already being used to verify another account. If it's yours, contact the cooperative.", 409);

      // A pending submission being replaced keeps its image paths until
      // storage confirms they're deleted (below, or the daily purge).
      await tx.idSubmission.updateMany({
        where: { userId: actor.id, status: "pending" },
        data: { status: "replaced", reviewedAt: new Date() },
      });
      return tx.idSubmission.create({
        data: {
          userId: actor.id,
          idType,
          numberHash,
          numberLast4: idNumberLast4(idNumber),
          frontPath: paths.front,
          backPath: paths.back ?? null,
          selfiePath: paths.selfie,
          captureMethod,
        },
      });
    });
  } catch (error) {
    await discard(Object.values(paths), actor.id);
    if (error instanceof SubmissionError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Failed to submit your ID" }, { status: 500 });
  }

  await purgeReplaced(actor.id);
  return NextResponse.json(submissionSummary(submission), { status: 201 });
}

/** DELETE /api/users/me/id-submission — withdraw a pending submission and its images. */
export async function DELETE(req: NextRequest) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pending = await prisma.idSubmission.findFirst({ where: { userId: actor.id, status: "pending" } });
  if (!pending) return NextResponse.json({ error: "No ID submission to withdraw" }, { status: 404 });

  // Only forget the submission once its images are really gone.
  if (!(await deleteIdImages([pending.frontPath, pending.backPath, pending.selfiePath])))
    return NextResponse.json({ error: "Couldn't remove your ID right now. Please try again." }, { status: 502 });

  await prisma.idSubmission.deleteMany({ where: { id: pending.id, status: "pending" } });
  return NextResponse.json({ withdrawn: true });
}

async function discard(paths: (string | undefined)[], userId: number) {
  if (!(await deleteIdImages(paths.filter((p): p is string => !!p))))
    console.error(`id-submission: ORPHANED upload(s) for user ${userId} need manual removal:`, paths);
}
