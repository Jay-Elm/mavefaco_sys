import { describe, expect, it } from "vitest";
import { GET } from "./route";
import { GET as stats } from "@/app/api/admin/stats/route";
import { prisma } from "@/lib/prisma";
import { createIdSubmission, createPlanting, createProduct, createUser, request, type SessionUser } from "@/test-utils/integration/helpers";
import { placedOrder } from "@/test-utils/integration/orders";

// A date this many days from today in Philippine time, as "YYYY-MM-DD".
const daysFromToday = (n: number) => new Date(Date.now() + 8 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
const badges = async (as?: SessionUser) => (await GET(request("/api/nav-badges", { as }))).json();
const suspend = (productId: number) =>
  prisma.product.update({ where: { id: productId }, data: { approved: false, suspendedAt: new Date(), suspensionReasons: ["other"] } });

describe("GET /api/nav-badges", () => {
  it("counts what a farmer has waiting: unread messages and notices, new orders, suspended listings, crops to harvest, missing ID", async () => {
    const { farmer, customer, product } = await placedOrder({ status: "pending" });
    await placedOrder({ status: "confirmed" }); // someone else's, and not new
    await prisma.message.createMany({
      data: [
        { senderId: customer.id, receiverId: farmer.id, content: "Hi" },
        { senderId: customer.id, receiverId: farmer.id, content: "Read already", read: true },
        { senderId: farmer.id, receiverId: customer.id, content: "Their unread, not mine" },
      ],
    });
    await prisma.notice.create({ data: { recipientId: farmer.id, title: "Listing suspended", body: "..." } });
    const flagged = await createProduct(farmer.id);
    await suspend(flagged.id);
    await createPlanting(farmer.id, { productId: product.id, harvestStart: daysFromToday(0), harvestEnd: daysFromToday(10) }); // opens today
    await createPlanting(farmer.id, { harvestStart: daysFromToday(-20), harvestEnd: daysFromToday(-5) }); // overdue
    await createPlanting(farmer.id, { harvestStart: daysFromToday(1), harvestEnd: daysFromToday(10) }); // not yet
    await createPlanting(farmer.id, { harvestStart: daysFromToday(-20), harvestEnd: daysFromToday(-5), status: "harvested" });

    expect(await badges(farmer)).toEqual({
      "/farmer/messages": 2,
      "/farmer/orders": 1,
      "/farmer/products": 1,
      "/farmer/crops": 2,
      "/farmer/profile": 1,
    });
  });

  it("clears each farmer badge once dealt with", async () => {
    const { farmer, order } = await placedOrder({ status: "pending" });
    await prisma.order.update({ where: { id: order.id }, data: { status: "confirmed" } });
    await createPlanting(farmer.id, { harvestStart: daysFromToday(-20), harvestEnd: daysFromToday(-5), status: "harvested" });
    await createPlanting(farmer.id, { harvestStart: daysFromToday(-20), harvestEnd: daysFromToday(-5), status: "failed" });
    await createIdSubmission(farmer.id); // submitted, awaiting review

    expect(await badges(farmer)).toEqual({
      "/farmer/messages": 0, "/farmer/orders": 0, "/farmer/products": 0, "/farmer/crops": 0, "/farmer/profile": 0,
    });
  });

  it("counts what staff have to review: pending listings (not suspended ones) and IDs to verify", async () => {
    const farmer = await createUser({ role: "farmer" });
    await createProduct(farmer.id, { approved: false });
    await suspend((await createProduct(farmer.id)).id);
    await createProduct(farmer.id); // approved
    await createIdSubmission(farmer.id);
    const verified = await createUser({ role: "farmer" });
    await createIdSubmission(verified.id, { status: "approved", reviewedAt: new Date() });
    await prisma.user.update({ where: { id: verified.id }, data: { verified: true } });
    await createIdSubmission((await createUser({ role: "farmer" })).id, { status: "rejected", reviewedAt: new Date() });

    for (const role of ["manager", "admin"] as const) {
      expect(await badges(await createUser({ role }))).toEqual({ "/dashboard/products": 1, "/dashboard/users": 1 });
    }
  });

  it("has nothing for customers, and needs a session", async () => {
    expect(await badges(await createUser())).toEqual({});
    expect((await GET(request("/api/nav-badges"))).status).toBe(401);
  });
});

describe("GET /api/admin/stats", () => {
  it("doesn't count a suspended listing as pending", async () => {
    const farmer = await createUser({ role: "farmer" });
    await createProduct(farmer.id);
    await createProduct(farmer.id, { approved: false });
    await suspend((await createProduct(farmer.id)).id);

    const res = await stats(request("/api/admin/stats", { as: await createUser({ role: "manager" }) }));

    expect(await res.json()).toMatchObject({ approvedProductCount: 1, pendingProductCount: 1, suspendedProductCount: 1 });
  });
});
