import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { adminUserPatchSchema } from "@/validators/adminUser";
import { deleteUserAccount } from "@/lib/deleteAccount";

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

    const parsed = adminUserPatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { suspended, verified, newPassword } = parsed.data;

    if (newPassword !== undefined && actor.role !== ROLES.ADMIN)
      return NextResponse.json({ error: "Only admins can reset passwords" }, { status: 403 });

    const hashed = newPassword !== undefined ? await bcrypt.hash(newPassword, 10) : undefined;

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        ...(typeof suspended === "boolean" && { suspended }),
        ...(typeof verified === "boolean" && { verified }),
        ...(hashed && { password: hashed, tokenVersion: { increment: 1 } }),
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

    const result = await deleteUserAccount(target.id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/admin/users/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
