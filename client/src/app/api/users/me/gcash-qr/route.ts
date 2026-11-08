import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { rateLimit } from "@/lib/rateLimit";
import { ROLES } from "@/lib/roles";
import { checkImage, deletePrivateImages, signPrivateImages, uploadPrivateImage } from "@/lib/privateImages";
import { NextRequest, NextResponse } from "next/server";

/**
 * A customer's own GCash QR code (optional), so a farmer who owes them a
 * refund can scan or save it. Private: only that farmer gets a view link.
 * (A farmer's QR is public, since every paying customer sees it; it is set
 * through PUT /api/users/me/gcash.)
 *
 * POST   form field `file` (PNG, JPEG or WEBP, max 4 MB) → { gcashQrViewUrl }
 * DELETE removes it
 */
export async function POST(req: NextRequest) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!authorize(actor, [ROLES.CUSTOMER])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { allowed, retryAfterSeconds } = await rateLimit(`gcash-qr:${actor.id}`, 10, 60 * 60 * 1000);
  if (!allowed)
    return NextResponse.json(
      { error: "Too many uploads. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const image = await checkImage(form.get("file") as File | null);
  if (!image.ok) return NextResponse.json({ error: image.error }, { status: 400 });

  const path = `gcash-qr/${actor.id}/${randomUUID()}.${image.ext}`;
  if (!(await uploadPrivateImage(path, image.body, image.contentType)))
    return NextResponse.json({ error: "Couldn't upload the QR code. Please try again." }, { status: 502 });

  const before = await prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { gcashQrPath: true } });
  await prisma.user.update({ where: { id: actor.id }, data: { gcashQrPath: path } });
  // The old one is no longer pointed at; a failed delete only leaves a stray file.
  if (before.gcashQrPath) await deletePrivateImages([before.gcashQrPath]);

  const url = (await signPrivateImages([path])).get(path) ?? null;
  return NextResponse.json({ gcashQrViewUrl: url });
}

export async function DELETE(req: NextRequest) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!authorize(actor, [ROLES.CUSTOMER])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const me = await prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { gcashQrPath: true } });
  if (me.gcashQrPath && !(await deletePrivateImages([me.gcashQrPath])))
    return NextResponse.json({ error: "Couldn't remove the QR code. Please try again." }, { status: 502 });
  await prisma.user.update({ where: { id: actor.id }, data: { gcashQrPath: null } });
  return NextResponse.json({ gcashQrViewUrl: null });
}
