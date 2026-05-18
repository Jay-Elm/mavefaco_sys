import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const otherId = Number(userId);
  if (isNaN(otherId)) return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });

  try {
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: actor.id, receiverId: otherId },
          { senderId: otherId, receiverId: actor.id },
        ],
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

  const receiver = await prisma.user.findUnique({ where: { id: receiverId }, select: { id: true, name: true } });
  if (!receiver) return NextResponse.json({ error: "User not found" }, { status: 404 });

  try {
    const { content } = await req.json();
    if (!content?.trim()) return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });

    const message = await prisma.message.create({
      data: { senderId: actor.id, receiverId, content: content.trim() },
      include: { sender: { select: { id: true, name: true } } },
    });

    return NextResponse.json(message, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
