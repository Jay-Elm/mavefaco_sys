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
  // The search text as a LIKE pattern, with its own % _ \ taken literally.
  const pattern = `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
  const me = actor.id;

  try {
    // The database does the grouping: one row per other person with their
    // latest message and unread count, instead of loading every message.
    // `visible` leaves out messages from before the caller removed the
    // conversation (ConversationHide).
    const [rows, matches] = await Promise.all([
      prisma.$queryRaw<{ other: number; content: string; imagePath: string | null; createdAt: Date; unread: number }[]>`
        WITH visible AS (
          SELECT m.*, CASE WHEN m."senderId" = ${me} THEN m."receiverId" ELSE m."senderId" END AS other
          FROM "Message" m
          LEFT JOIN "ConversationHide" h
            ON h."userId" = ${me} AND h."otherId" = CASE WHEN m."senderId" = ${me} THEN m."receiverId" ELSE m."senderId" END
          WHERE (m."senderId" = ${me} OR m."receiverId" = ${me}) AND (h."hiddenAt" IS NULL OR m."createdAt" > h."hiddenAt")
        ),
        unread AS (
          SELECT other, COUNT(*)::int AS n FROM visible WHERE "receiverId" = ${me} AND NOT "read" GROUP BY other
        )
        SELECT DISTINCT ON (v.other) v.other, v.content, v."imagePath", v."createdAt", COALESCE(u.n, 0) AS unread
        FROM visible v LEFT JOIN unread u ON u.other = v.other
        ORDER BY v.other, v."createdAt" DESC, v.id DESC`,
      // With ?q=: the newest message in each conversation that mentions it.
      q
        ? prisma.$queryRaw<{ other: number; content: string; createdAt: Date }[]>`
            SELECT DISTINCT ON (other) other, content, "createdAt" FROM (
              SELECT m.content, m."createdAt", m.id,
                     CASE WHEN m."senderId" = ${me} THEN m."receiverId" ELSE m."senderId" END AS other
              FROM "Message" m
              LEFT JOIN "ConversationHide" h
                ON h."userId" = ${me} AND h."otherId" = CASE WHEN m."senderId" = ${me} THEN m."receiverId" ELSE m."senderId" END
              WHERE (m."senderId" = ${me} OR m."receiverId" = ${me})
                AND (h."hiddenAt" IS NULL OR m."createdAt" > h."hiddenAt")
                AND m.content ILIKE ${pattern}
            ) found
            ORDER BY other, "createdAt" DESC, id DESC`
        : Promise.resolve([]),
    ]);

    const people = await prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.other) } },
      select: { id: true, name: true, role: true },
    });
    const personById = new Map(people.map((p) => [p.id, p]));
    const matchByOther = new Map(matches.map((m) => [m.other, { content: m.content, createdAt: m.createdAt }]));

    let list: Conversation[] = rows.flatMap((r) => {
      const user = personById.get(r.other);
      if (!user) return [];
      const match = matchByOther.get(r.other);
      return [{
        user,
        // A photo shows as "📷 Photo" (with its caption, if any).
        lastMessage: r.imagePath ? `📷 ${r.content || "Photo"}` : r.content,
        lastAt: r.createdAt,
        unread: Number(r.unread),
        ...(match && { match }),
      }];
    });
    if (q) list = list.filter((c) => c.match || c.user.name.toLowerCase().includes(q));
    list.sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());

    return NextResponse.json(list);
  } catch {
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
  }
}
