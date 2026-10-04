import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getActiveAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(user, [ROLES.ADMIN, ROLES.MANAGER]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await context.params;
    const categoryId = Number(id);
    if (isNaN(categoryId))
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const [liveCount, archivedCount] = await Promise.all([
      prisma.product.count({ where: { categoryId, archivedAt: null } }),
      prisma.product.count({ where: { categoryId, archivedAt: { not: null } } }),
    ]);
    if (liveCount > 0)
      return NextResponse.json(
        { error: `Cannot delete: ${liveCount} product(s) still use this category` },
        { status: 409 },
      );
    // Archived products are hidden everywhere, so say so rather than
    // reporting products staff can't find.
    if (archivedCount > 0)
      return NextResponse.json(
        { error: `Cannot delete: ${archivedCount} archived product(s) kept for past orders still use this category` },
        { status: 409 },
      );

    await prisma.category.delete({ where: { id: categoryId } });

    await logAudit("DELETE_CATEGORY", "CATEGORY", categoryId, user.id);

    return NextResponse.json({ message: "Category deleted" });
  } catch {
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
