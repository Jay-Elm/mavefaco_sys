import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { NextRequest, NextResponse } from "next/server";

// Returns a list of conversations (one entry per unique other-person)
export async function GET(req: NextRequest) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [sent, received] = await Promise.all([
      prisma.message.findMany({
        where: { senderId: actor.id },
        orderBy: { createdAt: "desc" },
        include: { receiver: { select: { id: true, name: true, role: true } } },
      }),
      prisma.message.findMany({
        where: { receiverId: actor.id },
        orderBy: { createdAt: "desc" },
        include: { sender: { select: { id: true, name: true, role: true } } },
      }),
    ]);

    // Build conversation map keyed by the other user's id
    const convMap = new Map<number, {
      user: { id: number; name: string; role: string };
      lastMessage: string;
      lastAt: Date;
      unread: number;
    }>();

    for (const m of sent) {
      const other = m.receiver;
      const existing = convMap.get(other.id);
      if (!existing || m.createdAt > existing.lastAt) {
        convMap.set(other.id, {
          user: other,
          lastMessage: m.content,
          lastAt: m.createdAt,
          unread: existing?.unread ?? 0,
        });
      }
    }

    for (const m of received) {
      const other = m.sender;
      const existing = convMap.get(other.id);
      const unreadAdd = !m.read ? 1 : 0;
      if (!existing || m.createdAt > existing.lastAt) {
        convMap.set(other.id, {
          user: other,
          lastMessage: m.content,
          lastAt: m.createdAt,
          unread: (existing?.unread ?? 0) + unreadAdd,
        });
      } else {
        convMap.set(other.id, { ...existing, unread: existing.unread + unreadAdd });
      }
    }

    const conversations = Array.from(convMap.values()).sort(
      (a, b) => b.lastAt.getTime() - a.lastAt.getTime(),
    );

    return NextResponse.json(conversations);
  } catch {
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
  }
}
