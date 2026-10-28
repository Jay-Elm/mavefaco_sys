import { logAudit } from "@/lib/audit";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { ReorderConflict, saveOrder } from "@/lib/reorder";
import { NextRequest, NextResponse } from "next/server";
import { reorderSchema } from "@/validators/reorder";

/** PUT /api/admin/faqs/order — save the order set with the move up/down buttons. */
export async function PUT(req: NextRequest) {
  try {
    const actor = await getActiveAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(actor, [ROLES.ADMIN]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = reorderSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    await saveOrder("faq", parsed.data.ids);
    await logAudit("REORDER_FAQS", "FAQ", 0, actor.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ReorderConflict)
      return NextResponse.json({ error: "The list changed since you opened it, please refresh" }, { status: 409 });
    return NextResponse.json({ error: "Failed to save the order" }, { status: 500 });
  }
}
