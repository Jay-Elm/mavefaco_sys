import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { NextRequest, NextResponse } from "next/server";
import { messageCreateSchema } from "@/validators/message";
import { ROLES } from "@/lib/roles";

// Sender role : receiver role pairs allowed to message each other.
const CAN_MESSAGE = new Set([`${ROLES.CUSTOMER}:${ROLES.FARMER}`, `${ROLES.FARMER}:${ROLES.CUSTOMER}`]);

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

    return NextResponse.json(messages);
  } catch {
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const receiverId = Number(userId);
  if (isNaN(receiverId)) return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  if (receiverId === actor.id) return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });

  const receiver = await prisma.user.findUnique({ where: { id: receiverId, deletedAt: null }, select: { id: true, name: true, role: true } });
  if (!receiver) return NextResponse.json({ error: "User not found" }, { status: 404 });
  // Messaging is between a customer and a farmer only; staff have no inbox.
  if (!CAN_MESSAGE.has(`${actor.role}:${receiver.role}`))
    return NextResponse.json({ error: "Messages can only be sent between customers and farmers" }, { status: 403 });

  try {
    const parsed = messageCreateSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const message = await prisma.message.create({
      data: { senderId: actor.id, receiverId, content: parsed.data.content },
      include: { sender: { select: { id: true, name: true } } },
    });

    return NextResponse.json(message, { status: 201 });
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
