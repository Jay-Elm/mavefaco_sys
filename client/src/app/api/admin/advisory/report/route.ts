import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { logAudit } from "@/lib/audit";
import { todayPH } from "@/lib/planting";
import { recentReports } from "@/lib/advisoryQuery";
import { AiReportError, buildAiPrompt, DEFAULT_GEMINI_MODEL, generateAiReport, REPORT_COOLDOWN_MS } from "@/lib/aiReport";
import { NextRequest, NextResponse } from "next/server";

// Gemini can take a while on a month of notes.
export const maxDuration = 60;

async function staff(req: NextRequest) {
  const user = await getActiveAuthUser(req);
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!authorize(user, [ROLES.ADMIN, ROLES.MANAGER]))
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

/** The latest report as the page shows it, with how many reports came in since. */
async function latest() {
  const report = await prisma.aiReport.findFirst({
    orderBy: { id: "desc" },
    select: { id: true, content: true, model: true, reportCount: true, lastLogId: true, createdAt: true, createdBy: { select: { name: true } } },
  });
  if (!report) return null;
  const reports = await recentReports();
  const newer = reports.filter((r) => report.lastLogId === null || r.id > report.lastLogId).length;
  return { ...report, createdBy: report.createdBy?.name ?? null, newer };
}

/**
 * GET /api/admin/advisory/report — the last AI crop report, or null.
 * `enabled` says whether the AI is set up (GEMINI_API_KEY).
 */
export async function GET(req: NextRequest) {
  const auth = await staff(req);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ enabled: !!process.env.GEMINI_API_KEY, report: await latest() });
  } catch {
    return NextResponse.json({ error: "Failed to load the AI report" }, { status: 500 });
  }
}

/**
 * POST /api/admin/advisory/report — ask the AI for a new report from the
 * last 30 days of members' crop logs. Saved, audited, and returned.
 */
export async function POST(req: NextRequest) {
  const auth = await staff(req);
  if (auth.error) return auth.error;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "The AI report isn't set up yet (GEMINI_API_KEY is missing)." }, { status: 503 });

  try {
    const last = await prisma.aiReport.findFirst({ orderBy: { id: "desc" }, select: { createdAt: true } });
    if (last && Date.now() - last.createdAt.getTime() < REPORT_COOLDOWN_MS)
      return NextResponse.json({ error: "A report was just made. Wait a minute before asking for another." }, { status: 429 });

    const reports = await recentReports();
    if (reports.length === 0)
      return NextResponse.json({ error: "There are no pest, weather or damage reports from the last 30 days to read." }, { status: 400 });

    const prompt = buildAiPrompt(reports, todayPH());
    const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    const content = await generateAiReport(prompt, { apiKey, model });

    // Keep translations only for notes that were sent.
    const sent = new Set(reports.map((r) => r.id));
    content.translations = content.translations.filter((t) => sent.has(t.id));

    const saved = await prisma.aiReport.create({
      data: { content, model, reportCount: prompt.noteCount, lastLogId: prompt.lastLogId, createdById: auth.user.id },
    });
    await logAudit("GENERATE_AI_REPORT", "AI_REPORT", saved.id, auth.user.id);

    return NextResponse.json({ enabled: true, report: await latest() }, { status: 201 });
  } catch (err) {
    if (err instanceof AiReportError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("ai-report: failed", err);
    return NextResponse.json({ error: "Failed to make the AI report" }, { status: 500 });
  }
}
