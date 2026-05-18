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

    const faqs = await prisma.faq.findMany({ orderBy: { displayOrder: "asc" } });
    return NextResponse.json(faqs);
  } catch {
    return NextResponse.json({ error: "Failed to fetch FAQs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getActiveAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(actor, [ROLES.ADMIN]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { question, answer, displayOrder } = await req.json();
    if (!question?.trim()) return NextResponse.json({ error: "Question is required" }, { status: 400 });
    if (!answer?.trim()) return NextResponse.json({ error: "Answer is required" }, { status: 400 });

    const faq = await prisma.faq.create({
      data: {
        question: question.trim(),
        answer: answer.trim(),
        displayOrder: Number(displayOrder) || 0,
      },
    });
    return NextResponse.json(faq, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create FAQ" }, { status: 500 });
  }
}
