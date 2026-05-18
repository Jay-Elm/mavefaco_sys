import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const actor = await getActiveAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(actor, [ROLES.ADMIN]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const rows = await prisma.siteContent.findMany();
    const content = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return NextResponse.json(content);
  } catch {
    return NextResponse.json({ error: "Failed to fetch site content" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const actor = await getActiveAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(actor, [ROLES.ADMIN]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const updates: Record<string, string> = await req.json();
    const allowedKeys = [
      "cooperative_name", "about_text", "mission", "vision",
      "contact_email", "contact_phone", "contact_address", "facebook_url",
    ];

    await Promise.all(
      Object.entries(updates)
        .filter(([k]) => allowedKeys.includes(k))
        .map(([key, value]) =>
          prisma.siteContent.upsert({
            where: { key },
            update: { value: String(value) },
            create: { key, value: String(value) },
          })
        )
    );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update site content" }, { status: 500 });
  }
}
