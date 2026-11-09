import { afterEach, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import pg from "pg";
import { prisma } from "@/lib/prisma";
import { loadMarket } from "@/lib/marketQuery";
import { createCropType, createProduct, createUser } from "@/test-utils/integration/helpers";
import { DEMO_DOMAIN, clearDemo, reset, seed } from "../../scripts/demo-data.mjs";

// The crops the demo listings use, with their growing times.
const CROPS: [string, number, number][] = [
  ["Tomato", 80, 90], ["Pechay", 20, 25], ["Ampalaya", 60, 75], ["Eggplant", 50, 80], ["Siling Labuyo", 60, 75],
  ["Squash", 80, 90], ["Okra", 60, 75], ["Kangkong", 21, 28], ["Camote", 90, 120],
];

let db: pg.Client;
beforeEach(async () => {
  db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  for (const [name, min, max] of CROPS) await createCropType({ name, daysToHarvestMin: min, daysToHarvestMax: max });
});
afterEach(async () => {
  await db.end();
});

/** What the site looked like: an admin plus hand-typed placeholder accounts and content. */
async function placeholderSite() {
  const admin = await createUser({ role: "admin" });
  await prisma.totpBackupCode.create({ data: { userId: admin.id, codeHash: "x" } });
  const farmer = await createUser({ role: "farmer" });
  const customer = await createUser({ role: "customer" });
  const manager = await createUser({ role: "manager" });
  const product = await createProduct(farmer.id);
  await prisma.order.create({
    data: { totalAmount: 100, customerId: customer.id, items: { create: [{ productId: product.id, quantity: 2, price: 50 }] } },
  });
  await prisma.announcement.create({ data: { title: "Title #2", body: "Lorem ipsum", authorId: admin.id } });
  await prisma.auditLog.create({ data: { action: "CREATE", entityType: "PRODUCT", entityId: product.id, userId: manager.id } });
  await prisma.faq.create({ data: { question: "Q?", answer: "A." } });
  return { admin };
}

describe("scripts/demo-data.mjs", () => {
  it("reset keeps only the admin (and its backup codes), the crop list, categories and FAQ; it asks first", async () => {
    const { admin } = await placeholderSite();
    expect(await reset(db, {}, { yes: false })).toBeNull();
    expect(await prisma.user.count()).toBe(4);

    const r = await reset(db, {}, { yes: true });
    expect(r!.kept).toBe(1);
    expect((await prisma.user.findMany()).map((u) => u.id)).toEqual([admin.id]);
    expect(await prisma.totpBackupCode.count()).toBe(1);
    for (const n of [prisma.product.count(), prisma.order.count(), prisma.orderItem.count(), prisma.announcement.count(), prisma.auditLog.count()])
      expect(await n).toBe(0);
    expect(await prisma.category.count()).toBe(1);
    expect(await prisma.faq.count()).toBe(1);
    expect(await prisma.cropType.count()).toBe(CROPS.length);
  });

  it("refuses to reset a database without an admin", async () => {
    await createUser({ role: "farmer" });
    await expect(reset(db, {}, { yes: true })).rejects.toThrow(/No admin/);
    expect(await prisma.user.count()).toBe(1);
  });

  it("seed gives the Market page each kind of reading, with working demo logins", async () => {
    await placeholderSite();
    await reset(db, {}, { yes: true });
    const r = await seed(db, { yes: true });
    expect(r!.counts.listings).toBe(9);

    const farmer = await prisma.user.findFirstOrThrow({ where: { email: `rogelio.banares@${DEMO_DOMAIN}` } });
    expect(farmer.verified && farmer.emailVerifiedAt && farmer.termsAcceptedAt).toBeTruthy();
    expect(await bcrypt.compare(r!.password, farmer.password)).toBe(true);

    const market = await loadMarket();
    const row = (name: string) => market.rows.find((x) => x.crop.name === name)!;
    expect(row("Tomato").signal).toBe("demand-above-supply");
    expect(row("Pechay").signal).toBe("demand-above-supply");
    expect(row("Ampalaya").risingDemand).toBe(true);
    expect(row("Eggplant").signal).toBe("balanced");
    expect(row("Squash").signal).toBe("oversupply");
    expect(row("Okra").signal).toBe("no-recent-demand");
    expect(row("Kangkong").signal).toBe("other-units");
    expect(row("Tomato").prices.length).toBeGreaterThanOrEqual(10);
    expect(market.alerts.some((a) => a.kind === "high-demand" && a.crop === "Ampalaya")).toBe(true);
    expect(market.suggestions).toContain(row("Tomato").crop.id);

    await expect(seed(db, { yes: true })).rejects.toThrow(/already there/);
  });

  it("clear-demo removes only the demo data", async () => {
    const { admin } = await placeholderSite();
    await reset(db, {}, { yes: true });
    await seed(db, { yes: true });
    await prisma.announcement.create({ data: { title: "Real announcement", body: "Kept", authorId: admin.id } });

    await clearDemo(db, {}, { yes: true });
    expect((await prisma.user.findMany()).map((u) => u.id)).toEqual([admin.id]);
    expect(await prisma.product.count()).toBe(0);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.planting.count()).toBe(0);
    expect((await prisma.announcement.findMany()).map((a) => a.title)).toEqual(["Real announcement"]);
    // The placeholder's category and the "Vegetables" one seed added stay.
    expect(await prisma.category.count()).toBe(2);
  });
});
