import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/getAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

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
    const actor = getAuthUser(req);
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

    const { suspended } = await req.json();
    if (typeof suspended !== "boolean")
      return NextResponse.json({ error: "suspended must be a boolean" }, { status: 400 });

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { suspended },
      select: { id: true, name: true, email: true, role: true, suspended: true },
    });

    await prisma.auditLog.create({
      data: {
        action: suspended ? "SUSPEND_USER" : "UNSUSPEND_USER",
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
    const actor = getAuthUser(req);
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

    // Block deletion if the user has orders (preserves order history)
    if (target._count.orders > 0)
      return NextResponse.json(
        {
          error: `Cannot delete: this user has ${target._count.orders} order(s). Suspend the account instead.`,
        },
        { status: 409 },
      );

    // Check if any of the user's products appear in order items
    const productInOrders = await prisma.orderItem.findFirst({
      where: { product: { farmerId: target.id } },
    });
    if (productInOrders)
      return NextResponse.json(
        { error: "Cannot delete: this farmer's products are referenced in existing orders. Suspend instead." },
        { status: 409 },
      );

    // Safe to delete — cascade in a transaction
    await prisma.$transaction([
      prisma.product.deleteMany({ where: { farmerId: target.id } }),
      prisma.auditLog.deleteMany({ where: { userId: target.id } }),
      prisma.user.delete({ where: { id: target.id } }),
    ]);

    return NextResponse.json({ message: "User deleted successfully" });
  } catch {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
