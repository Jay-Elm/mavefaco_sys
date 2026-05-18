import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const [rows, faqs] = await Promise.all([
      prisma.siteContent.findMany(),
      prisma.faq.findMany({ orderBy: { displayOrder: "asc" } }),
    ]);
    const content = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return NextResponse.json({ content, faqs });
  } catch {
    return NextResponse.json({ error: "Failed to fetch site content" }, { status: 500 });
  }
}
