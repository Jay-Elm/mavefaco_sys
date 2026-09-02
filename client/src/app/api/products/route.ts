import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const actor = await getActiveAuthUser(req);
    if (!actor) return NextResponse.json({ error: "No token provided" }, { status: 401 });

    if (!authorize(actor, [ROLES.FARMER, ROLES.MANAGER, ROLES.ADMIN]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (actor.role === ROLES.FARMER) {
      const dbUser = await prisma.user.findUnique({ where: { id: actor.id }, select: { verified: true } });
      if (!dbUser?.verified)
        return NextResponse.json({ error: "Your account must be verified before listing products. Please submit your ID for verification." }, { status: 403 });
    }

    const body = await req.json();

    const { name, description, price, stock, unit, categoryId, imageUrl } = body;

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price,
        stock,
        unit: unit || 'piece',
        categoryId,
        imageUrl,
        farmerId: actor.id,
        approved: false,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE_PRODUCT",
        entityType: "PRODUCT",
        entityId: product.id,
        userId: actor.id,
      },
    });

    return NextResponse.json(
      {
        message: "Product created successfully",
        product,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const categoryId = searchParams.get("categoryId");
    const farmerId = searchParams.get("farmerId");

    const products = await prisma.product.findMany({
      where: {
        ...(categoryId && { categoryId: Number(categoryId) }),
        ...(farmerId && { farmerId: Number(farmerId) }),
        ...(!farmerId && { approved: true }),
      },
      include: {
        category: true,
        farmer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 },
    );
  }
}
