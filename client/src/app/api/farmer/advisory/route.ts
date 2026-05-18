import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const actor = await getActiveAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== "farmer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const logs = await prisma.cropLog.findMany({
      where: {
        type: { in: ["pest_disease", "weather_impact", "damage"] },
        createdAt: { gte: since },
      },
      include: {
        product: { select: { name: true, category: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(logs);
  } catch {
    return NextResponse.json({ error: "Failed to fetch advisory" }, { status: 500 });
  }
}
