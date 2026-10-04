import { describe, expect, it } from "vitest";
import { GET as auditLogs } from "./route";
import { POST as createCategory } from "@/app/api/categories/route";
import { DELETE as deleteCategory } from "@/app/api/categories/[id]/route";
import { POST as createAnnouncement } from "@/app/api/announcements/route";
import { DELETE as deleteAnnouncement } from "@/app/api/announcements/[id]/route";
import { POST as createBanner } from "@/app/api/banners/route";
import { PUT as updateBanner, DELETE as deleteBanner } from "@/app/api/banners/[id]/route";
import { POST as createFaq } from "@/app/api/admin/faqs/route";
import { DELETE as deleteFaq } from "@/app/api/admin/faqs/[id]/route";
import { PUT as updateSiteContent } from "@/app/api/admin/site-content/route";
import { prisma } from "@/lib/prisma";
import { createUser, params, request, type SessionUser } from "@/test-utils/integration/helpers";

const actions = async () =>
  (await prisma.auditLog.findMany({ orderBy: { id: "asc" } })).map((l) => [l.action, l.entityType, l.entityId]);

describe("content changes are recorded in the audit log", () => {
  it("covers categories, announcements, banners, FAQs and site content", async () => {
    const admin: SessionUser = await createUser({ role: "admin" });
    const post = (path: string, body: unknown) => request(path, { method: "POST", as: admin, body });
    const del = (path: string) => request(path, { method: "DELETE", as: admin });

    const category = await (await createCategory(post("/api/categories", { name: "Root crops" }))).json();
    await deleteCategory(del(`/api/categories/${category.id}`), params({ id: String(category.id) }));
    const announcement = await (await createAnnouncement(post("/api/announcements", { title: "Market day", body: "Saturday" }))).json();
    await deleteAnnouncement(del(`/api/announcements/${announcement.id}`), params({ id: String(announcement.id) }));
    const banner = await (await createBanner(post("/api/banners", { title: "Fresh harvest" }))).json();
    await updateBanner(request(`/api/banners/${banner.id}`, { method: "PUT", as: admin, body: { active: false } }), params({ id: String(banner.id) }));
    await deleteBanner(del(`/api/banners/${banner.id}`), params({ id: String(banner.id) }));
    const faq = await (await createFaq(post("/api/admin/faqs", { question: "Delivery?", answer: "Within Albay" }))).json();
    await deleteFaq(del(`/api/admin/faqs/${faq.id}`), params({ id: String(faq.id) }));
    await updateSiteContent(request("/api/admin/site-content", { method: "PUT", as: admin, body: { mission: "Fair prices" } }));

    expect(await actions()).toEqual([
      ["CREATE_CATEGORY", "CATEGORY", category.id],
      ["DELETE_CATEGORY", "CATEGORY", category.id],
      ["CREATE_ANNOUNCEMENT", "ANNOUNCEMENT", announcement.id],
      ["DELETE_ANNOUNCEMENT", "ANNOUNCEMENT", announcement.id],
      ["CREATE_BANNER", "BANNER", banner.id],
      ["UPDATE_BANNER", "BANNER", banner.id],
      ["DELETE_BANNER", "BANNER", banner.id],
      ["CREATE_FAQ", "FAQ", faq.id],
      ["DELETE_FAQ", "FAQ", faq.id],
      ["UPDATE_SITE_CONTENT", "SITE_CONTENT", 0],
    ]);
    expect(await prisma.auditLog.count({ where: { userId: admin.id } })).toBe(10);
  });

  it("doesn't log a change that was refused", async () => {
    const manager = await createUser({ role: "manager" });

    const res = await createBanner(request("/api/banners", { method: "POST", as: manager, body: { title: "Nope" } }));

    expect(res.status).toBe(403); // banners are admin-only
    expect(await prisma.auditLog.count()).toBe(0);
  });
});

describe("GET /api/admin/audit-logs paging", () => {
  it("returns the newest 100, then older entries via ?before=", async () => {
    const admin = await createUser({ role: "admin" });
    await prisma.auditLog.createMany({
      data: Array.from({ length: 130 }, (_, i) => ({ action: "TEST", entityType: "X", entityId: i, userId: admin.id })),
    });
    const page = async (query = "") =>
      (await (await auditLogs(request(`/api/admin/audit-logs${query}`, { as: admin }))).json()) as { id: number; entityId: number }[];

    const first = await page();
    expect(first).toHaveLength(100);
    expect(first[0].entityId).toBe(129); // newest first

    const second = await page(`?before=${first.at(-1)!.id}`);
    expect(second).toHaveLength(30);
    expect(second.at(-1)!.entityId).toBe(0);
    expect(new Set([...first, ...second].map((l) => l.id)).size).toBe(130); // no overlap, nothing missed
  });

  it("is staff-only", async () => {
    expect((await auditLogs(request("/api/admin/audit-logs", { as: await createUser({ role: "farmer" }) }))).status).toBe(403);
  });
});
