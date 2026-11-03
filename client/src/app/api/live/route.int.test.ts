import { describe, expect, it } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { createUser, request, type SessionUser } from "@/test-utils/integration/helpers";

const stamp = async (as?: SessionUser) => {
  const res = await GET(request("/api/live", { as }));
  expect(res.status).toBe(200);
  return ((await res.json()) as { stamp: string }).stamp;
};

describe("GET /api/live", () => {
  it("stays the same while nothing changes, and changes when a message arrives", async () => {
    const farmer = await createUser({ role: "farmer" });
    const customer = await createUser();
    const before = await stamp(farmer);
    expect(await stamp(farmer)).toBe(before);

    await prisma.message.create({ data: { senderId: customer.id, receiverId: farmer.id, content: "Hi" } });

    expect(await stamp(farmer)).not.toBe(before);
  });

  it("changes for a customer when their order's status changes", async () => {
    const customer = await createUser();
    const order = await prisma.order.create({ data: { customerId: customer.id, totalAmount: 100 } });
    const before = await stamp(customer);

    await prisma.order.update({ where: { id: order.id }, data: { status: "confirmed" } });

    expect(await stamp(customer)).not.toBe(before);
  });

  it("answers guests too, and their stamp follows announcements", async () => {
    const admin = await createUser({ role: "admin" });
    const before = await stamp();

    await prisma.announcement.create({ data: { title: "Market day", body: "Saturday", authorId: admin.id } });

    expect(await stamp()).not.toBe(before);
  });
});
