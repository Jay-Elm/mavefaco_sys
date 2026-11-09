import { describe, expect, it, vi, afterEach } from "vitest";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCropType, createProduct, createUser, params, request, type SessionUser } from "@/test-utils/integration/helpers";
import { placedOrder } from "@/test-utils/integration/orders";
import { SUSPENSION_REASONS } from "@/validators/productSuspension";

import { GET as stats } from "./admin/stats/route";
import { GET as orders } from "./admin/orders/route";
import { PATCH as orderStatus } from "./admin/orders/[id]/route";
import { GET as products } from "./admin/products/route";
import { PATCH as approve } from "./admin/products/[id]/route";
import { POST as suspend } from "./admin/products/[id]/suspend/route";
import { PATCH as linkCrop } from "./admin/products/[id]/crop/route";
import { GET as supply } from "./admin/supply/route";
import { GET as advisory } from "./admin/advisory/route";
import { GET as aiReport } from "./admin/advisory/report/route";
import { GET as reports } from "./admin/reports/route";
import { GET as farmerStats } from "./admin/farmer-stats/route";
import { GET as users } from "./admin/users/route";
import { PATCH as editUser } from "./admin/users/[id]/route";
import { POST as syncPsa } from "./admin/market/psa/route";
import { GET as market } from "./market/route";
import { GET as priceReference } from "./market/reference/route";
import { GET as cropTypes, POST as addCropType } from "./crop-types/route";
import { PUT as editCropType } from "./crop-types/[id]/route";
import { GET as categories, POST as addCategory } from "./categories/route";
import { GET as announcements, POST as postAnnouncement } from "./announcements/route";
import { PATCH as pinAnnouncement } from "./announcements/[id]/route";
import { GET as navBadges } from "./nav-badges/route";

/**
 * Administrators can do everything managers can. Every staff route is called
 * as a manager and as an admin: whatever a manager may do, an admin may too
 * (same success status). Run fresh data for each role, so neither run sees
 * the other's changes.
 */
type Call = (as: SessionUser) => Promise<Response | NextResponse>;

const calls: Record<string, () => Promise<Call>> = {
  "dashboard stats": async () => (as) => stats(request("/api/admin/stats", { as })),
  "all orders": async () => (as) => orders(request("/api/admin/orders", { as })),
  "move an order forward": async () => {
    const { order } = await placedOrder();
    return (as) => orderStatus(request(`/api/admin/orders/${order.id}`, { method: "PATCH", as, body: { status: "confirmed" } }), params({ id: String(order.id) }));
  },
  "cancel an order": async () => {
    const { order } = await placedOrder();
    return (as) => orderStatus(request(`/api/admin/orders/${order.id}`, { method: "PATCH", as, body: { status: "cancelled" } }), params({ id: String(order.id) }));
  },
  "all products": async () => (as) => products(request("/api/admin/products", { as })),
  "approve a listing": async () => {
    const p = await createProduct((await createUser({ role: "farmer" })).id, { approved: false });
    return (as) => approve(request(`/api/admin/products/${p.id}`, { method: "PATCH", as, body: { approved: true } }), params({ id: String(p.id) }));
  },
  "suspend a listing": async () => {
    const p = await createProduct((await createUser({ role: "farmer" })).id);
    return (as) => suspend(request(`/api/admin/products/${p.id}/suspend`, { method: "POST", as, body: { reasons: [Object.keys(SUSPENSION_REASONS)[0]], note: "Wrong photo" } }), params({ id: String(p.id) }));
  },
  "link a listing to a crop": async () => {
    const p = await createProduct((await createUser({ role: "farmer" })).id);
    const crop = await createCropType();
    return (as) => linkCrop(request(`/api/admin/products/${p.id}/crop`, { method: "PATCH", as, body: { cropTypeId: crop.id } }), params({ id: String(p.id) }));
  },
  "upcoming supply": async () => (as) => supply(request("/api/admin/supply", { as })),
  "crop advisory": async () => (as) => advisory(request("/api/admin/advisory", { as })),
  "AI report status": async () => (as) => aiReport(request("/api/admin/advisory/report", { as })),
  "sales reports": async () => (as) => reports(request("/api/admin/reports", { as })),
  "farmer performance": async () => (as) => farmerStats(request("/api/admin/farmer-stats", { as })),
  "user list": async () => (as) => users(request("/api/admin/users", { as })),
  "suspend a customer": async () => {
    const c = await createUser();
    return (as) => editUser(request(`/api/admin/users/${c.id}`, { method: "PATCH", as, body: { suspended: true } }), params({ id: String(c.id) }));
  },
  "market signals": async () => (as) => market(request("/api/market", { as })),
  "price reference": async () => {
    const crop = await createCropType();
    return (as) => priceReference(request(`/api/market/reference?cropTypeId=${crop.id}`, { as }));
  },
  "update PSA figures": async () => (as) => syncPsa(request("/api/admin/market/psa", { method: "POST", as })),
  "crop types": async () => (as) => cropTypes(request("/api/crop-types", { as })),
  "add a crop type": async () => {
    let n = 0;
    return (as) => addCropType(request("/api/crop-types", { method: "POST", as, body: { name: `Parity crop ${as.id}-${n++}`, daysToHarvestMin: null, daysToHarvestMax: null } }));
  },
  "edit a crop type": async () => {
    const crop = await createCropType();
    return (as) => editCropType(request(`/api/crop-types/${crop.id}`, { method: "PUT", as, body: { name: crop.name, daysToHarvestMin: 30, daysToHarvestMax: 40 } }), params({ id: String(crop.id) }));
  },
  // Public list; staff see the same.
  categories: async () => () => categories(),
  "add a category": async () => (as) => addCategory(request("/api/categories", { method: "POST", as, body: { name: `Parity category ${as.id}` } })),
  announcements: async () => (as) => announcements(request("/api/announcements", { as })),
  "post an announcement": async () => (as) =>
    postAnnouncement(request("/api/announcements", { method: "POST", as, body: { title: "Parity check", body: "Both staff roles can post.", type: "info", audience: "everyone" } })),
  "pin an announcement": async () => {
    const a = await prisma.announcement.create({ data: { title: "Pin me", body: "b", authorId: (await createUser({ role: "manager" })).id } });
    return (as) => pinAnnouncement(request(`/api/announcements/${a.id}`, { method: "PATCH", as, body: { pinned: true } }), params({ id: String(a.id) }));
  },
  "sidebar badges": async () => (as) => navBadges(request("/api/nav-badges", { as })),
};

afterEach(() => vi.unstubAllGlobals());

describe("an admin can do everything a manager can", () => {
  // PSA is faked: an empty table answer is enough to prove access.
  const fakePsa = () =>
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ variables: [] })));

  for (const [what, setup] of Object.entries(calls)) {
    it(what, async () => {
      fakePsa();
      const status = async (role: "manager" | "admin") => (await (await setup())(await createUser({ role }))).status;
      const manager = await status("manager");
      const admin = await status("admin");
      expect(manager, `${what}: managers should be allowed`).toBeLessThan(400);
      expect(admin, `${what}: admin got ${admin} where a manager got ${manager}`).toBe(manager);
    });
  }

  it("admins also keep their own actions: audit logs and site content", async () => {
    const { GET: auditLogs } = await import("./admin/audit-logs/route");
    const admin = await createUser({ role: "admin" });
    const manager = await createUser({ role: "manager" });
    expect((await auditLogs(request("/api/admin/audit-logs", { as: admin }))).status).toBe(200);
    expect((await auditLogs(request("/api/admin/audit-logs", { as: manager }))).status).toBe(403);
    expect(await prisma.user.count({ where: { role: "admin" } })).toBeGreaterThan(0);
  });
});
