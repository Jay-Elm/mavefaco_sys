import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

async function resolveTarget(id: string) {
  const userId = Number(id);
  if (isNaN(userId)) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    include: { _count: { select: { orders: true, products: true } } },
  });
}

/** PATCH /api/admin/users/[id]  — suspend or unsuspend */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getActiveAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(actor, [ROLES.ADMIN, ROLES.MANAGER]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await context.params;
    const target = await resolveTarget(id);
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (target.id === actor.id)
      return NextResponse.json({ error: "You cannot suspend yourself" }, { status: 400 });

    // Managers cannot suspend admins or other managers
    if (actor.role === ROLES.MANAGER && [ROLES.ADMIN, ROLES.MANAGER].includes(target.role as never))
      return NextResponse.json({ error: "Managers can only suspend farmers and customers" }, { status: 403 });

    // Admins cannot suspend other admins
    if (actor.role === ROLES.ADMIN && target.role === ROLES.ADMIN)
      return NextResponse.json({ error: "Cannot suspend another admin" }, { status: 403 });

    const body = await req.json();
    const { suspended, verified, newPassword } = body;

    if (typeof suspended !== "boolean" && typeof verified !== "boolean" && typeof newPassword !== "string")
      return NextResponse.json({ error: "suspended, verified, or newPassword must be provided" }, { status: 400 });

    if (typeof newPassword === "string") {
      if (newPassword.trim().length < 6)
        return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
      // Only admins can reset passwords
      if (actor.role !== ROLES.ADMIN)
        return NextResponse.json({ error: "Only admins can reset passwords" }, { status: 403 });
    }

    const hashed = typeof newPassword === "string" ? await bcrypt.hash(newPassword.trim(), 10) : undefined;

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        ...(typeof suspended === "boolean" && { suspended }),
        ...(typeof verified === "boolean" && { verified }),
        ...(hashed && { password: hashed }),
      },
      select: { id: true, name: true, email: true, role: true, suspended: true, verified: true },
    });

    const action = typeof newPassword === "string"
      ? "RESET_PASSWORD"
      : typeof verified === "boolean"
        ? (verified ? "VERIFY_USER" : "UNVERIFY_USER")
        : (suspended ? "SUSPEND_USER" : "UNSUSPEND_USER");

    await prisma.auditLog.create({
      data: {
        action,
        entityType: "USER",
        entityId: target.id,
        userId: actor.id,
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

/** DELETE /api/admin/users/[id] — permanently remove a user */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getActiveAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // Only admins can delete accounts
    if (!authorize(actor, [ROLES.ADMIN]))
      return NextResponse.json({ error: "Only admins can delete users" }, { status: 403 });

    const { id } = await context.params;
    const target = await resolveTarget(id);
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (target.id === actor.id)
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });

    if (target.role === ROLES.ADMIN)
      return NextResponse.json({ error: "Cannot delete another admin account" }, { status: 403 });

    const ACTIVE_STATUSES = ["pending", "confirmed", "shipped"];

    // Block deletion only if the user has active (in-progress) orders
    const activeOrderCount = await prisma.order.count({
      where: { customerId: target.id, status: { in: ACTIVE_STATUSES } },
    });
    if (activeOrderCount > 0)
      return NextResponse.json(
        { error: `Cannot delete: this user has ${activeOrderCount} active order(s). Wait for them to complete or cancel, then try again.` },
        { status: 409 },
      );

    // Block deletion if any of the user's products are in active orders
    const productInActiveOrders = await prisma.orderItem.findFirst({
      where: { product: { farmerId: target.id }, order: { status: { in: ACTIVE_STATUSES } } },
    });
    if (productInActiveOrders)
      return NextResponse.json(
        { error: "Cannot delete: this farmer has products in active orders. Wait for them to complete, then try again." },
        { status: 409 },
      );

    // Safe to delete — cascade completed/cancelled orders and all related data
    await prisma.$transaction([
      prisma.orderItem.deleteMany({ where: { order: { customerId: target.id } } }),
      prisma.order.deleteMany({ where: { customerId: target.id } }),
      prisma.orderItem.deleteMany({ where: { product: { farmerId: target.id } } }),
      prisma.product.deleteMany({ where: { farmerId: target.id } }),
      prisma.auditLog.deleteMany({ where: { userId: target.id } }),
      prisma.user.delete({ where: { id: target.id } }),
    ]);

    return NextResponse.json({ message: "User deleted successfully" });
  } catch {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
