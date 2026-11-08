import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { rateLimit } from "@/lib/rateLimit";
import { messageRefusal, withImageUrls } from "@/lib/messaging";
import { checkImage, uploadPrivateImage } from "@/lib/privateImages";
import { MAX, tooLong } from "@/validators/limits";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/messages/[userId]/image — send a photo (form field `file`: PNG,
 * JPEG or WEBP, max 4 MB) with an optional `caption`. Stored privately;
 * only the two people in the conversation get a link to it.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const receiverId = Number((await params).userId);
  const refused = await messageRefusal(actor, receiverId);
  if (refused) return NextResponse.json({ error: refused.error }, { status: refused.status });

  const { allowed, retryAfterSeconds } = await rateLimit(`message-image:${actor.id}`, 30, 60 * 60 * 1000);
  if (!allowed)
    return NextResponse.json(
      { error: "Too many photos sent. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const caption = String(form.get("caption") ?? "").trim();
  if (caption.length > MAX.message) return NextResponse.json({ error: tooLong("Caption", MAX.message) }, { status: 400 });

  const image = await checkImage(form.get("file") as File | null);
  if (!image.ok) return NextResponse.json({ error: image.error }, { status: 400 });

  // Not guessable, and grouped by sender so an account's photos can be found.
  const path = `chat/${actor.id}/${randomUUID()}.${image.ext}`;
  if (!(await uploadPrivateImage(path, image.body, image.contentType)))
    return NextResponse.json({ error: "Couldn't upload the photo. Please try again." }, { status: 502 });

  try {
    const message = await prisma.message.create({
      data: { senderId: actor.id, receiverId, content: caption, imagePath: path },
      include: { sender: { select: { id: true, name: true } } },
    });
    const [sent] = await withImageUrls([message]);
    return NextResponse.json(sent, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to send the photo" }, { status: 500 });
  }
}
