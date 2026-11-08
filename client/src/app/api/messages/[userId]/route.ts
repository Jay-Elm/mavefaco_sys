import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { NextRequest, NextResponse } from "next/server";
import { messageCreateSchema } from "@/validators/message";
import { messageRefusal, withImageUrls } from "@/lib/messaging";
import { rateLimit } from "@/lib/rateLimit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const otherId = Number(userId);
  if (isNaN(otherId)) return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });

  try {
    // Messages from before the caller removed this conversation stay hidden.
    const hide = await prisma.conversationHide.findUnique({
      where: { userId_otherId: { userId: actor.id, otherId } },
    });
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: actor.id, receiverId: otherId },
          { senderId: otherId, receiverId: actor.id },
        ],
        ...(hide && { createdAt: { gt: hide.hiddenAt } }),
      },
      orderBy: { createdAt: "asc" },
      include: {
        sender: { select: { id: true, name: true } },
      },
    });

    // Mark received messages as read
    await prisma.message.updateMany({
      where: { senderId: otherId, receiverId: actor.id, read: false },
      data: { read: true },
    });

    // Photos are private: each comes with a short-lived view link.
    return NextResponse.json(await withImageUrls(messages));
  } catch {
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const receiverId = Number(userId);
  // Messaging is between a customer and a farmer only; staff have no inbox.
  const refused = await messageRefusal(actor, receiverId);
  if (refused) return NextResponse.json({ error: refused.error }, { status: refused.status });

  // Generous for a real conversation (two a minute for an hour), but stops
  // an account flooding someone's inbox.
  const { allowed, retryAfterSeconds } = await rateLimit(`message:${actor.id}`, 120, 60 * 60 * 1000);
  if (!allowed)
    return NextResponse.json(
      { error: "You're sending messages too fast. Please wait a little and try again." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );

  try {
    const parsed = messageCreateSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const message = await prisma.message.create({
      data: { senderId: actor.id, receiverId, content: parsed.data.content },
      include: { sender: { select: { id: true, name: true } } },
    });

    const [sent] = await withImageUrls([message]);
    return NextResponse.json(sent, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}

/**
 * DELETE /api/messages/[userId] — remove the conversation from the caller's
 * Messages list. Only for the caller: the other person keeps every message,
 * and anything sent after this brings the conversation back. Unread
 * messages in it count as read, so the sidebar badge clears.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const otherId = Number((await params).userId);
  if (!Number.isInteger(otherId)) return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });

  try {
    const hiddenAt = new Date();
    await prisma.$transaction([
      prisma.conversationHide.upsert({
        where: { userId_otherId: { userId: actor.id, otherId } },
        create: { userId: actor.id, otherId, hiddenAt },
        update: { hiddenAt },
      }),
      prisma.message.updateMany({
        where: { senderId: otherId, receiverId: actor.id, read: false, createdAt: { lte: hiddenAt } },
        data: { read: true },
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete conversation" }, { status: 500 });
  }
}
