import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { emailHtml, sendEmail } from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";
import { productSuspendSchema, reasonLabels, suspensionDeadline, SUSPENSION_DAYS } from "@/validators/productSuspension";

const formatDate = (d: Date) =>
  d.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric" });

/**
 * POST /api/admin/products/[id]/suspend — staff take a listing down for the
 * given reasons. It is hidden from customers at once (unapproved), and its
 * farmer gets a notice in Messages plus an email, both pointing at the edit
 * page. Orders already placed carry on. If the farmer doesn't resubmit
 * within SUSPENSION_DAYS, /api/cron/purge-suspended-products removes it.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getActiveAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(actor, [ROLES.ADMIN, ROLES.MANAGER]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await context.params;
    const productId = Number(id);
    if (isNaN(productId)) return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });

    const parsed = productSuspendSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { reasons, note } = parsed.data;

    const product = await prisma.product.findUnique({
      where: { id: productId, archivedAt: null },
      include: { farmer: { select: { id: true, name: true, email: true, deletedAt: true } } },
    });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    if (product.suspendedAt) return NextResponse.json({ error: "This listing is already suspended" }, { status: 409 });

    const suspendedAt = new Date();
    const deadline = suspensionDeadline(suspendedAt);
    const labels = reasonLabels(reasons);
    const editPath = `/farmer/products/${productId}/edit`;

    const body = [
      `Your listing "${product.name}" has been suspended by MaVeFaCo staff and is hidden from customers.`,
      "",
      "Reasons:",
      ...labels.map((l) => `- ${l}`),
      ...(note ? ["", `Note from staff: ${note}`] : []),
      "",
      `Edit the listing to fix these issues and resubmit it for review, or delete it. If it isn't resubmitted by ${formatDate(deadline)}, it will be deleted automatically.`,
      "Orders already placed for this listing are not affected.",
    ].join("\n");

    const suspended = await prisma.$transaction(async (tx) => {
      // Conditional on it not being suspended (or removed) meanwhile, so a
      // double submit can't send the farmer two notices.
      const { count } = await tx.product.updateMany({
        where: { id: productId, archivedAt: null, suspendedAt: null },
        data: { suspendedAt, suspensionReasons: reasons, suspensionNote: note || null, suspendedById: actor.id, approved: false },
      });
      if (count === 0) return false;
      await tx.notice.create({
        data: { recipientId: product.farmerId, productId, title: `Listing suspended: ${product.name}`, body },
      });
      await tx.auditLog.create({
        data: { action: "SUSPEND_PRODUCT", entityType: "PRODUCT", entityId: productId, userId: actor.id },
      });
      return true;
    });
    if (!suspended) return NextResponse.json({ error: "This listing changed, please refresh" }, { status: 409 });

    let emailSent = false;
    if (!product.farmer.deletedAt) {
      const editUrl = `${req.nextUrl.origin}${editPath}`;
      emailSent = await sendEmail({
        to: product.farmer.email,
        subject: `Your MaVeFaCo listing "${product.name}" was suspended`,
        html:
          emailHtml`
            <p>Hi ${product.farmer.name},</p>
            <p>Your listing <strong>${product.name}</strong> has been suspended by MaVeFaCo staff and is hidden from customers.</p>
            <p>Reasons:</p>
            <ul>` +
          labels.map((l) => emailHtml`<li>${l}</li>`).join("") +
          emailHtml`</ul>` +
          (note ? emailHtml`<p>Note from staff: ${note}</p>` : "") +
          emailHtml`
            <p>Edit the listing to fix these issues and resubmit it for review, or delete it:</p>
            <p><a href="${editUrl}">${editUrl}</a></p>
            <p>If it isn't resubmitted within ${SUSPENSION_DAYS} days (by ${formatDate(deadline)}), it will be deleted automatically. Orders already placed for this listing are not affected.</p>
          `,
      });
      if (!emailSent) console.error(`Failed to send listing-suspension email for product ${productId}`);
    }

    return NextResponse.json({ id: productId, suspendedAt, deleteAfter: deadline, suspensionReasons: reasons, emailSent });
  } catch {
    return NextResponse.json({ error: "Failed to suspend product" }, { status: 500 });
  }
}
