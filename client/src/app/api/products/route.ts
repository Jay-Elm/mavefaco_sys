import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];

    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const isAuthorized = authorize(decoded, [
      ROLES.FARMER,
      ROLES.MANAGER,
      ROLES.ADMIN,
    ]);

    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    const { name, description, price, stock, categoryId, imageUrl } = body;

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price,
        stock,
        categoryId,
        imageUrl,
        farmerId: decoded.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE_PRODUCT",
        entityType: "PRODUCT",
        entityId: product.id,
        userId: decoded.id,
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

    const products = await prisma.product.findMany({
      where: categoryId
        ? {
            categoryId: Number(categoryId),
          }
        : {},
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
