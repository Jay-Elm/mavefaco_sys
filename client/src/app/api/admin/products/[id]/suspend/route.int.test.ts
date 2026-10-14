import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email")>();
  return { ...actual, sendEmail: vi.fn(async () => true) };
});

import { NextRequest } from "next/server";
import { POST as suspendRoute } from "./route";
import { PATCH as approveRoute } from "@/app/api/admin/products/[id]/route";
import { POST as restoreRoute } from "@/app/api/admin/products/[id]/restore/route";
import { GET as getProduct, PATCH as editProduct, DELETE as deleteProduct } from "@/app/api/products/[id]/route";
import { GET as shopList } from "@/app/api/products/route";
import { POST as placeOrder } from "@/app/api/orders/route";
import { PATCH as farmerOrderStatus } from "@/app/api/farmer/orders/[id]/route";
import { GET as cron } from "@/app/api/cron/purge-suspended-products/route";
import { GET as listNotices } from "@/app/api/notices/route";
import { POST as readNotices } from "@/app/api/notices/read/route";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { createProduct, createUser, params, request, type SessionUser } from "@/test-utils/integration/helpers";
import { placedOrder } from "@/test-utils/integration/orders";

const DAY = 24 * 60 * 60 * 1000;
const CRON_SECRET = "cron-secret-for-tests";

const suspend = (id: number, as: SessionUser | undefined, body: unknown = { reasons: ["incorrect_price"], note: "" }) =>
  suspendRoute(request(`/api/admin/products/${id}/suspend`, { method: "POST", as, body }), params({ id: String(id) }));
const get = (id: number, as?: SessionUser) => getProduct(request(`/api/products/${id}`, { as }), params({ id: String(id) }));
const edit = (id: number, as: SessionUser, body: unknown) =>
  editProduct(request(`/api/products/${id}`, { method: "PATCH", as, body }), params({ id: String(id) }));
const del = (id: number, as: SessionUser) =>
  deleteProduct(request(`/api/products/${id}`, { method: "DELETE", as }), params({ id: String(id) }));
const approve = (id: number, as: SessionUser) =>
  approveRoute(request(`/api/admin/products/${id}`, { method: "PATCH", as, body: { approved: true } }), params({ id: String(id) }));
const runCron = (secret: string | null = CRON_SECRET) =>
  cron(new NextRequest("http://localhost:3000/api/cron/purge-suspended-products", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  }));
const productOf = (id: number) => prisma.product.findUnique({ where: { id } });
/** Backdate a suspension so it is `days` old. */
const ageSuspension = (id: number, days: number) =>
  prisma.product.update({ where: { id }, data: { suspendedAt: new Date(Date.now() - days * DAY) } });

beforeEach(() => {
  vi.mocked(sendEmail).mockClear();
  vi.stubEnv("CRON_SECRET", CRON_SECRET);
});

describe("POST /api/admin/products/[id]/suspend", () => {
  it("hides the listing from customers, notifies the farmer in Messages and by email, and audits it", async () => {
    const farmer = await createUser({ role: "farmer", name: "Juan" });
    const product = await createProduct(farmer.id, { name: "Tomatoes" });
    const manager = await createUser({ role: "manager" });

    const res = await suspend(product.id, manager, { reasons: ["incorrect_price", "other", "other"], note: "Price is per sack, not per kg" });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: product.id, suspensionReasons: ["incorrect_price", "other"], emailSent: true });
    expect(await productOf(product.id)).toMatchObject({
      approved: false,
      suspensionReasons: ["incorrect_price", "other"],
      suspensionNote: "Price is per sack, not per kg",
      suspendedById: manager.id,
    });

    // Hidden from customers: product page and shop list
    expect((await get(product.id, await createUser())).status).toBe(404);
    expect(await (await shopList(request("/api/products"))).json()).toEqual([]);
    // Still visible to its farmer and staff
    expect((await get(product.id, farmer)).status).toBe(200);
    expect((await get(product.id, manager)).status).toBe(200);

    const notice = await prisma.notice.findFirstOrThrow();
    expect(notice).toMatchObject({ recipientId: farmer.id, productId: product.id, read: false, title: "Listing suspended: Tomatoes" });
    expect(notice.body).toContain("Incorrect or unrealistic price");
    expect(notice.body).toContain("Note from staff: Price is per sack, not per kg");
    expect(notice.body).toContain("deleted automatically");

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [email] = vi.mocked(sendEmail).mock.calls[0];
    expect(email.to).toBe(farmer.email);
    expect(email.html).toContain(`/farmer/products/${product.id}/edit`);
    expect(email.html).toContain("Incorrect or unrealistic price");

    expect(await prisma.auditLog.count({ where: { action: "SUSPEND_PRODUCT", entityId: product.id, userId: manager.id } })).toBe(1);
  });

  it("escapes staff-written text in the email", async () => {
    const product = await createProduct((await createUser({ role: "farmer" })).id);

    await suspend(product.id, await createUser({ role: "admin" }), { reasons: ["other"], note: "<a href=\"https://evil.test\">fix</a>" });

    const [email] = vi.mocked(sendEmail).mock.calls[0];
    expect(email.html).not.toContain("<a href=\"https://evil.test\">");
    expect(email.html).toContain("&lt;a href=");
  });

  it.each([
    ["no reasons", { reasons: [] }],
    ["an unknown reason", { reasons: ["ugly"] }],
    ['"Other" without a note', { reasons: ["other"], note: "  " }],
  ])("rejects %s", async (_, body) => {
    const product = await createProduct((await createUser({ role: "farmer" })).id);

    expect((await suspend(product.id, await createUser({ role: "manager" }), body)).status).toBe(400);
    expect((await productOf(product.id))?.suspendedAt).toBeNull();
    expect(await prisma.notice.count()).toBe(0);
  });

  it.each(["farmer", "customer"] as const)("is staff-only: a %s gets 403", async (role) => {
    const farmer = await createUser({ role: "farmer" });
    const product = await createProduct(farmer.id);

    expect((await suspend(product.id, role === "farmer" ? farmer : await createUser())).status).toBe(403);
    expect((await productOf(product.id))?.suspendedAt).toBeNull();
  });

  it("refuses a listing that is already suspended, and sends one notice on a double submit", async () => {
    const product = await createProduct((await createUser({ role: "farmer" })).id);
    const manager = await createUser({ role: "manager" });

    const results = await Promise.all([suspend(product.id, manager), suspend(product.id, manager)]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await suspend(product.id, manager)).status).toBe(409);
    expect(await prisma.notice.count()).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("lets orders already placed carry on, but takes no new ones", async () => {
    const { farmer, order, product } = await placedOrder({ status: "pending" });

    await suspend(product.id, await createUser({ role: "manager" }));

    const moved = await farmerOrderStatus(
      request(`/api/farmer/orders/${order.id}`, { method: "PATCH", as: farmer, body: { status: "confirmed" } }),
      params({ id: String(order.id) }),
    );
    expect(moved.status).toBe(200);

    const newOrder = await placeOrder(request("/api/orders", { method: "POST", as: await createUser(), body: { items: [{ productId: product.id, quantity: 1 }] } }));
    expect(newOrder.status).toBe(400);
    expect(await prisma.order.count()).toBe(1);
  });
});

describe("a suspended listing", () => {
  async function suspendedListing() {
    const farmer = await createUser({ role: "farmer" });
    const product = await createProduct(farmer.id, { name: "Okra", price: 40 });
    const manager = await createUser({ role: "manager" });
    await suspend(product.id, manager);
    return { farmer, product, manager };
  }

  it("can't be approved by staff until the farmer resubmits it", async () => {
    const { farmer, product, manager } = await suspendedListing();

    expect((await approve(product.id, manager)).status).toBe(409);
    expect((await productOf(product.id))?.approved).toBe(false);

    await edit(product.id, farmer, { price: 45 });
    expect((await approve(product.id, manager)).status).toBe(200);
    expect((await productOf(product.id))?.approved).toBe(true);
  });

  it("is resubmitted when its farmer changes what customers see: back to pending, suspension cleared", async () => {
    const { farmer, product } = await suspendedListing();

    const res = await edit(product.id, farmer, { price: 45 });

    expect(res.status).toBe(200);
    expect(await productOf(product.id)).toMatchObject({
      approved: false, suspendedAt: null, suspensionReasons: [], suspensionNote: null, suspendedById: null,
    });
    expect(await prisma.auditLog.count({ where: { action: "RESUBMIT_PRODUCT", entityId: product.id, userId: farmer.id } })).toBe(1);
  });

  it.each([
    ["a stock-only change", { stock: 99 }],
    ["re-saving unchanged details", { name: "Okra", price: 40 }],
  ])("stays suspended after %s", async (_, body) => {
    const { farmer, product } = await suspendedListing();

    const res = await edit(product.id, farmer, body);

    expect(res.status).toBe(200);
    expect((await res.json()).suspendedAt).not.toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "RESUBMIT_PRODUCT" } })).toBe(0);
  });

  it("can be deleted early by staff, who can't delete a listing that isn't suspended", async () => {
    const { product, manager } = await suspendedListing();
    const live = await createProduct((await createUser({ role: "farmer" })).id);

    expect((await del(live.id, manager)).status).toBe(409);
    expect(await productOf(live.id)).not.toBeNull();

    expect((await del(product.id, manager)).status).toBe(200);
    expect(await productOf(product.id)).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "DELETE_PRODUCT", entityId: product.id, userId: manager.id } })).toBe(1);
    // The notice stays, without its listing
    expect((await prisma.notice.findFirstOrThrow()).productId).toBeNull();
  });

  it("can be deleted by its farmer", async () => {
    const { farmer, product } = await suspendedListing();

    expect((await del(product.id, farmer)).status).toBe(200);
    expect(await productOf(product.id)).toBeNull();
  });

  it("comes back as an ordinary pending listing when restored after being archived", async () => {
    const { farmer, product, manager } = await suspendedListing();
    await prisma.order.create({
      data: {
        customerId: (await createUser()).id, totalAmount: 40, status: "delivered",
        items: { create: [{ productId: product.id, quantity: 1, price: 40 }] },
      },
    });
    await del(product.id, farmer); // has history, so archived

    const res = await restoreRoute(request(`/api/admin/products/${product.id}/restore`, { method: "POST", as: manager }), params({ id: String(product.id) }));

    expect(res.status).toBe(200);
    expect(await productOf(product.id)).toMatchObject({ archivedAt: null, suspendedAt: null, approved: false });
  });
});

describe("GET /api/cron/purge-suspended-products", () => {
  it("deletes a listing suspended over 7 days ago, attributed to the staff member who suspended it", async () => {
    const product = await createProduct((await createUser({ role: "farmer" })).id);
    const admin = await createUser({ role: "admin" });
    await suspend(product.id, admin);
    await ageSuspension(product.id, 7.1);

    const res = await runCron();

    expect(await res.json()).toEqual({ deleted: 1, archived: 0, skipped: 0 });
    expect(await productOf(product.id)).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "AUTO_DELETE_PRODUCT", entityId: product.id, userId: admin.id } })).toBe(1);
  });

  it("archives one with history instead, and skips one with an order still in progress", async () => {
    const delivered = await placedOrder({ status: "delivered" });
    const shipped = await placedOrder({ status: "shipped" });
    const manager = await createUser({ role: "manager" });
    for (const { product } of [delivered, shipped]) {
      await suspend(product.id, manager);
      await ageSuspension(product.id, 8);
    }

    expect(await (await runCron()).json()).toEqual({ deleted: 0, archived: 1, skipped: 1 });
    expect((await productOf(delivered.product.id))?.archivedAt).not.toBeNull();
    expect((await productOf(shipped.product.id))?.archivedAt).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "AUTO_ARCHIVE_PRODUCT", entityId: delivered.product.id } })).toBe(1);
  });

  it("leaves a suspension younger than 7 days and a resubmitted listing alone", async () => {
    const farmer = await createUser({ role: "farmer" });
    const recent = await createProduct(farmer.id);
    const resubmitted = await createProduct(farmer.id, { price: 40 });
    const manager = await createUser({ role: "manager" });
    await suspend(recent.id, manager);
    await ageSuspension(recent.id, 6.9);
    await suspend(resubmitted.id, manager);
    await ageSuspension(resubmitted.id, 9);
    await edit(resubmitted.id, farmer, { price: 45 });

    expect(await (await runCron()).json()).toEqual({ deleted: 0, archived: 0, skipped: 0 });
    expect(await prisma.product.count()).toBe(2);
  });

  it("refuses a request without the cron secret", async () => {
    expect((await runCron(null)).status).toBe(401);
    expect((await runCron("wrong")).status).toBe(401);
  });
});

describe("notices", () => {
  it("are listed only to their recipient, and marked read on request", async () => {
    const farmer = await createUser({ role: "farmer" });
    const product = await createProduct(farmer.id);
    await suspend(product.id, await createUser({ role: "manager" }));
    const notices = async (as: SessionUser) => (await listNotices(request("/api/notices", { as }))).json();

    const mine = await notices(farmer);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ read: false, product: { id: product.id } });
    expect(await notices(await createUser({ role: "farmer" }))).toEqual([]);
    expect((await listNotices(request("/api/notices"))).status).toBe(401);

    await readNotices(request("/api/notices/read", { method: "POST", as: farmer }));
    expect((await notices(farmer))[0].read).toBe(true);
  });
});
