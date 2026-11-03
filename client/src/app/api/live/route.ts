import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { getActiveAuthUser } from "@/lib/getActiveAuthUser";
import { ROLES } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

type Part = string | number | Date | null | undefined;

/**
 * GET /api/live — a short fingerprint of everything the caller can see
 * change. Open pages poll it (contexts/LiveUpdatesContext) and re-load when
 * it differs from last time. It holds no data, only a hash of counts and
 * latest ids/times, so it's safe to answer guests too.
 */
export async function GET(req: NextRequest) {
  const actor = await getActiveAuthUser(req);

  try {
    // What anyone can see: the shop, announcements, reviews, site content.
    const shared = Promise.all([
      prisma.product.aggregate({ where: { archivedAt: null }, _max: { updatedAt: true }, _count: true }),
      prisma.announcement.aggregate({ _max: { id: true }, _count: true }),
      prisma.review.aggregate({ _max: { id: true }, _count: true }),
      // Banners, FAQs, site text and categories are only changed by staff,
      // and every such change is audited.
      prisma.auditLog.aggregate({
        where: { entityType: { in: ["BANNER", "FAQ", "SITE_CONTENT", "CATEGORY", "CROP_TYPE", "ANNOUNCEMENT"] } },
        _max: { id: true },
      }),
    ]).then(([p, a, r, c]): Part[] => [p._max.updatedAt, p._count, a._max.id, a._count, r._max.id, r._count, c._max.id]);

    const own: Promise<Part[]> = !actor
      ? Promise.resolve([])
      : Promise.all([
          prisma.user.findUnique({ where: { id: actor.id }, select: { updatedAt: true } }),
          // Messages either way, and whether the other side has read them.
          prisma.message.aggregate({
            where: { OR: [{ senderId: actor.id }, { receiverId: actor.id }] },
            _max: { id: true },
            _count: true,
          }),
          prisma.message.count({ where: { OR: [{ senderId: actor.id }, { receiverId: actor.id }], read: false } }),
          prisma.notice.aggregate({ where: { recipientId: actor.id }, _max: { id: true, resolvedAt: true }, _count: true }),
          prisma.notice.count({ where: { recipientId: actor.id, read: false } }),
          prisma.idSubmission.aggregate({ where: { userId: actor.id }, _max: { id: true, reviewedAt: true } }),
        ]).then(([u, m, mUnread, n, nUnread, ids]): Part[] => [
          u?.updatedAt, m._max.id, m._count, mUnread, n._max.id, n._max.resolvedAt, n._count, nUnread, ids._max.id, ids._max.reviewedAt,
        ]);

    // Orders, listings and crops, by role.
    let byRole: Promise<Part[]> = Promise.resolve([]);
    if (actor?.role === ROLES.CUSTOMER) {
      byRole = prisma.order
        .aggregate({ where: { customerId: actor.id }, _max: { updatedAt: true }, _count: true })
        .then((o) => [o._max.updatedAt, o._count]);
    } else if (actor?.role === ROLES.FARMER) {
      byRole = Promise.all([
        prisma.order.aggregate({
          where: { items: { some: { product: { farmerId: actor.id } } } },
          _max: { updatedAt: true },
          _count: true,
        }),
        prisma.product.aggregate({ where: { farmerId: actor.id }, _max: { updatedAt: true }, _count: true }),
        prisma.planting.aggregate({ where: { farmerId: actor.id }, _max: { updatedAt: true }, _count: true }),
        prisma.cropLog.aggregate({ where: { planting: { farmerId: actor.id } }, _max: { id: true }, _count: true }),
      ]).then(([o, p, pl, cl]) => [o._max.updatedAt, o._count, p._max.updatedAt, p._count, pl._max.updatedAt, pl._count, cl._max.id, cl._count]);
    } else if (actor?.role === ROLES.ADMIN || actor?.role === ROLES.MANAGER) {
      byRole = Promise.all([
        prisma.order.aggregate({ _max: { updatedAt: true }, _count: true }),
        prisma.product.aggregate({ _max: { updatedAt: true }, _count: true }),
        prisma.user.aggregate({ _max: { updatedAt: true }, _count: true }),
        prisma.idSubmission.aggregate({ _max: { id: true, reviewedAt: true }, _count: true }),
        prisma.planting.aggregate({ _max: { updatedAt: true }, _count: true }),
        prisma.auditLog.aggregate({ _max: { id: true } }),
      ]).then(([o, p, u, ids, pl, al]) => [
        o._max.updatedAt, o._count, p._max.updatedAt, p._count, u._max.updatedAt, u._count,
        ids._max.id, ids._max.reviewedAt, ids._count, pl._max.updatedAt, pl._count, al._max.id,
      ]);
    }

    const parts = (await Promise.all([shared, own, byRole])).flat();
    const text = parts.map((v) => (v instanceof Date ? v.getTime() : v ?? "-")).join("|");
    const stamp = createHash("sha256").update(`${actor?.id ?? 0}:${text}`).digest("base64url").slice(0, 16);

    return NextResponse.json({ stamp }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to check for updates" }, { status: 500 });
  }
}
