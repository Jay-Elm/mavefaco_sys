import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { emailHtml, sendEmail } from "@/lib/email";
import { idTypeLabel } from "@/lib/idVerification";
import { idReasonLabels, idReviewSchema } from "@/validators/idReview";

/**
 * POST /api/admin/id-submissions/[id]/review — staff approve a pending ID
 * submission (the farmer becomes verified) or reject it with reasons. Either
 * way the farmer gets a notice in Messages and an email.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActiveAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(actor, [ROLES.ADMIN, ROLES.MANAGER]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const id = Number((await context.params).id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const parsed = idReviewSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const review = parsed.data;

    const submission = await prisma.idSubmission.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true, role: true, deletedAt: true } } },
    });
    if (!submission || submission.user.deletedAt || submission.user.role !== ROLES.FARMER)
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });

    const farmer = submission.user;
    const approve = review.decision === "approve";
    const reasons = approve ? [] : review.reasons;
    const note = approve ? null : review.note || null;
    const labels = idReasonLabels(reasons);
    const now = new Date();

    const reviewed = await prisma.$transaction(async (tx) => {
      // Only a still-pending submission: a double click, or two staff at
      // once, records one decision and sends one notice.
      const { count } = await tx.idSubmission.updateMany({
        where: { id, status: "pending" },
        data: { status: approve ? "approved" : "rejected", rejectionReasons: reasons, rejectionNote: note, reviewedById: actor.id, reviewedAt: now },
      });
      if (count === 0) return false;
      await tx.user.update({
        where: { id: farmer.id },
        data: approve ? { verified: true, verifiedAt: now } : { verified: false, verifiedAt: null, verifiedInPersonAt: null },
      });
      await tx.notice.create({
        data: approve
          ? { recipientId: farmer.id, title: "Your ID was approved", body: "Your account is verified. You can now list products for sale." }
          : {
              recipientId: farmer.id,
              title: "Your ID wasn't approved",
              body: `Reasons: ${labels.join("; ")}.${note ? ` Note from staff: ${note}` : ""} Submit your ID again from your Profile page.`,
            },
      });
      await tx.auditLog.create({
        data: { action: approve ? "APPROVE_ID" : "REJECT_ID", entityType: "USER", entityId: farmer.id, userId: actor.id },
      });
      return true;
    });
    if (!reviewed) return NextResponse.json({ error: "This submission was already reviewed, please refresh" }, { status: 409 });

    const profileUrl = `${req.nextUrl.origin}/farmer/profile`;
    const emailSent = await sendEmail({
      to: farmer.email,
      subject: approve ? "Your MaVeFaCo account is verified" : "Your MaVeFaCo ID wasn't approved",
      html: approve
        ? emailHtml`
            <p>Hi ${farmer.name},</p>
            <p>MaVeFaCo staff approved your ${idTypeLabel(submission.idType)}. Your account is verified, and you can now list products for sale.</p>
          `
        : emailHtml`
            <p>Hi ${farmer.name},</p>
            <p>MaVeFaCo staff couldn't approve the ${idTypeLabel(submission.idType)} you submitted.</p>
            <p>Reasons:</p>
            <ul>` +
          labels.map((l) => emailHtml`<li>${l}</li>`).join("") +
          emailHtml`</ul>` +
          (note ? emailHtml`<p>Note from staff: ${note}</p>` : "") +
          emailHtml`
            <p>You can submit your ID again from your profile:</p>
            <p><a href="${profileUrl}">${profileUrl}</a></p>
          `,
    });
    if (!emailSent) console.error(`Failed to send ID review email for user ${farmer.id}`);

    return NextResponse.json({ id, status: approve ? "approved" : "rejected", emailSent });
  } catch {
    return NextResponse.json({ error: "Failed to review the submission" }, { status: 500 });
  }
}
