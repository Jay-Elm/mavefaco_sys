import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { signIdImage, storageConfig } from "@/lib/idImageStorage";

/**
 * GET /api/admin/users/[id]/id-submission — a farmer's ID submission for
 * staff review: the pending one if there is one, else the latest. Each
 * image comes as a 5-minute signed link; the bucket stays private. Also
 * lists other accounts that submitted the same ID number.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActiveAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(actor, [ROLES.ADMIN, ROLES.MANAGER]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const userId = Number((await context.params).id);
    if (!Number.isInteger(userId)) return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });

    const farmer = await prisma.user.findFirst({
      where: { id: userId, role: ROLES.FARMER, deletedAt: null },
      select: { id: true, name: true, verified: true, verifiedAt: true, verifiedInPersonAt: true },
    });
    if (!farmer) return NextResponse.json({ error: "Farmer not found" }, { status: 404 });

    const submissions = await prisma.idSubmission.findMany({
      where: { userId, status: { not: "replaced" } },
      orderBy: { createdAt: "desc" },
    });
    const submission = submissions.find((s) => s.status === "pending") ?? submissions[0];
    if (!submission) return NextResponse.json({ farmer, submission: null });

    if ([submission.frontPath, submission.backPath, submission.selfiePath].some(Boolean) && !storageConfig())
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    const sign = async (path: string | null) => (path ? signIdImage(path) : null);
    const [front, back, selfie] = await Promise.all([sign(submission.frontPath), sign(submission.backPath), sign(submission.selfiePath)]);

    const sameNumber = submission.numberHash
      ? await prisma.idSubmission.findMany({
          where: { numberHash: submission.numberHash, userId: { not: userId } },
          select: { status: true, createdAt: true, user: { select: { id: true, name: true, deletedAt: true } } },
          orderBy: { createdAt: "desc" },
        })
      : [];

    return NextResponse.json({
      farmer,
      submission: {
        id: submission.id,
        idType: submission.idType,
        numberLast4: submission.numberLast4,
        captureMethod: submission.captureMethod,
        status: submission.status,
        rejectionReasons: submission.rejectionReasons,
        rejectionNote: submission.rejectionNote,
        createdAt: submission.createdAt,
        reviewedAt: submission.reviewedAt,
        imagesPurgedAt: submission.imagesPurgedAt,
        images: { front, back, selfie },
      },
      previousRejections: submissions.filter((s) => s.status === "rejected" && s.id !== submission.id).length,
      sameNumber: sameNumber.map((s) => ({
        userId: s.user.id,
        name: s.user.deletedAt ? "Deleted user" : s.user.name,
        status: s.status,
        createdAt: s.createdAt,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Failed to load the ID submission" }, { status: 500 });
  }
}
