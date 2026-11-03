import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { NextRequest, NextResponse } from "next/server";

type Person = { id: number; name: string; role: string };
type Conversation = {
  user: Person;
  lastMessage: string;
  lastAt: Date;
  unread: number;
  /** With ?q=: the newest message in the conversation that mentions it. */
  match?: { content: string; createdAt: Date };
};

/**
 * GET /api/messages — the caller's conversations, one per other person,
 * most recently active first. Messages from before the caller removed a
 * conversation (DELETE /api/messages/[userId]) are left out.
 *
 * ?q=text — only conversations with that person's name, or a message
 * containing the text (e.g. "ampalaya"); each says which message matched.
 */
export async function GET(req: NextRequest) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100).toLowerCase();

  try {
    const [messages, hides] = await Promise.all([
      prisma.message.findMany({
        where: { OR: [{ senderId: actor.id }, { receiverId: actor.id }] },
        orderBy: { createdAt: "desc" },
        include: {
          sender: { select: { id: true, name: true, role: true } },
          receiver: { select: { id: true, name: true, role: true } },
        },
      }),
      prisma.conversationHide.findMany({ where: { userId: actor.id } }),
    ]);
    const hiddenUntil = new Map(hides.map((h) => [h.otherId, h.hiddenAt]));

    // Newest first, so the first message seen per person is the latest.
    const conversations = new Map<number, Conversation>();
    for (const m of messages) {
      const other = m.senderId === actor.id ? m.receiver : m.sender;
      const hidden = hiddenUntil.get(other.id);
      if (hidden && m.createdAt <= hidden) continue;

      let c = conversations.get(other.id);
      if (!c) {
        c = { user: other, lastMessage: m.content, lastAt: m.createdAt, unread: 0 };
        conversations.set(other.id, c);
      }
      if (m.receiverId === actor.id && !m.read) c.unread++;
      if (q && !c.match && m.content.toLowerCase().includes(q)) c.match = { content: m.content, createdAt: m.createdAt };
    }

    let list = [...conversations.values()];
    if (q) list = list.filter((c) => c.match || c.user.name.toLowerCase().includes(q));
    list.sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());

    return NextResponse.json(list);
  } catch {
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
  }
}
