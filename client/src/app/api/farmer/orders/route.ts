import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { authorize } from "@/lib/authorize";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import { signPrivateImages } from "@/lib/privateImages";

/** GET /api/farmer/orders — orders that contain at least one of the farmer's products */
export async function GET(req: NextRequest) {
  try {
    const user = await getActiveAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorize(user, [ROLES.FARMER]))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const orders = await prisma.order.findMany({
      where: {
        items: { some: { product: { farmerId: user.id } } },
      },
      include: {
        customer: { select: { id: true, name: true, email: true, gcashName: true, gcashNumber: true, gcashQrPath: true } },
        items: {
          where: { product: { farmerId: user.id } },
          include: { product: { select: { id: true, name: true, unit: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Where to send a refund, only on orders that owe one: the account the
    // customer paid from, else their saved GCash, and their private QR.
    const owing = orders.filter((o) => o.paymentStatus === "refund_due");
    const qrUrls = await signPrivateImages(owing.map((o) => o.customer.gcashQrPath).filter((p): p is string => !!p));

    return NextResponse.json(
      orders.map(({ customer: { gcashName, gcashNumber, gcashQrPath, ...customer }, ...o }) => ({
        ...o,
        customer,
        totalAmount: Number(o.totalAmount),
        items: o.items.map((i) => ({ ...i, price: Number(i.price) })),
        refundTo:
          o.paymentStatus === "refund_due"
            ? {
                name: o.payerName ?? gcashName,
                number: o.payerNumber ?? gcashNumber,
                qrUrl: gcashQrPath ? (qrUrls.get(gcashQrPath) ?? null) : null,
              }
            : null,
      })),
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
