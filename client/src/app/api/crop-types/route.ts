import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import { cropTypeSchema } from "@/validators/crop";

const isUniqueViolation = (err: unknown) =>
  typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002";

/** GET /api/crop-types — the crops farmers can record plantings of. */
export async function GET(req: NextRequest) {
  const user = await getActiveAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!authorize(user, [ROLES.FARMER, ROLES.MANAGER, ROLES.ADMIN]))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const cropTypes = await prisma.cropType.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { plantings: true } } },
    });
    return NextResponse.json(cropTypes);
  } catch {
    return NextResponse.json({ error: "Failed to fetch crop types" }, { status: 500 });
  }
}

/** POST /api/crop-types — staff add a crop to the list. */
export async function POST(req: NextRequest) {
  try {
    const user = await getActiveAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(user, [ROLES.ADMIN, ROLES.MANAGER]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = cropTypeSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const cropType = await prisma.cropType.create({ data: parsed.data });
    await logAudit("CREATE_CROP_TYPE", "CROP_TYPE", cropType.id, user.id);

    return NextResponse.json({ ...cropType, _count: { plantings: 0 } }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err))
      return NextResponse.json({ error: "A crop with that name already exists" }, { status: 409 });
    return NextResponse.json({ error: "Failed to create crop type" }, { status: 500 });
  }
}
