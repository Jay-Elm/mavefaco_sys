import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { createProduct, createUser, request, type SessionUser } from "@/test-utils/integration/helpers";

const create = async (as: SessionUser | undefined, body: Record<string, unknown> = {}) => {
  const category = await prisma.category.create({ data: { name: `Cat ${Math.random()}` } });
  return POST(
    request("/api/products", {
      method: "POST",
      as,
      body: { name: "Tomatoes", description: "Fresh", price: 45.5, stock: 20, unit: "kg", categoryId: category.id, ...body },
    }),
  );
};
const list = async (query = "", as?: SessionUser) =>
  (await GET(request(`/api/products${query}`, { as }))).json() as Promise<{ id: number }[]>;
const verifiedFarmer = async () => {
  const farmer = await createUser({ role: "farmer" });
  return prisma.user.update({ where: { id: farmer.id }, data: { verified: true } });
};

describe("POST /api/products", () => {
  it("lets a verified farmer list a product, unapproved until reviewed", async () => {
    const farmer = await verifiedFarmer();

    const res = await create(farmer);

    expect(res.status).toBe(201);
    const { product } = await res.json();
    expect(product).toMatchObject({ name: "Tomatoes", price: 45.5, approved: false, farmerId: farmer.id });
    expect(await prisma.auditLog.count({ where: { action: "CREATE_PRODUCT", entityId: product.id } })).toBe(1);
  });

  it("ignores an attempt to self-approve or list under another farmer", async () => {
    const farmer = await verifiedFarmer();
    const other = await createUser({ role: "farmer" });

    const { product } = await (await create(farmer, { approved: true, farmerId: other.id })).json();

    expect(product).toMatchObject({ approved: false, farmerId: farmer.id });
  });

  it("requires a farmer's ID to be verified first", async () => {
    const farmer = await createUser({ role: "farmer" });

    expect((await create(farmer)).status).toBe(403);
    expect(await prisma.product.count()).toBe(0);
  });

  it.each([
    ["no session", undefined, 401],
    ["a customer", "customer", 403],
  ] as const)("refuses %s", async (_, role, status) => {
    const as = role ? await createUser({ role }) : undefined;
    expect((await create(as)).status).toBe(status);
  });

  it.each([
    ["a zero price", { price: 0 }],
    ["negative stock", { stock: -1 }],
    ["a missing name", { name: "  " }],
    ["a javascript: image URL", { imageUrl: "javascript:alert(1)" }],
  ])("rejects %s", async (_, body) => {
    const farmer = await verifiedFarmer();
    expect((await create(farmer, body)).status).toBe(400);
  });
});

describe("GET /api/products", () => {
  it("shows the public only approved products, newest first, filterable by category", async () => {
    const farmer = await createUser({ role: "farmer" });
    const older = await createProduct(farmer.id);
    const newer = await createProduct(farmer.id);
    await createProduct(farmer.id, { approved: false });

    expect((await list()).map((p) => p.id)).toEqual([newer.id, older.id]);
    expect((await list(`?categoryId=${older.categoryId}`)).map((p) => p.id)).toEqual([older.id]);
  });

  it("shows a farmer their own unapproved products via ?farmerId", async () => {
    const farmer = await createUser({ role: "farmer" });
    const pending = await createProduct(farmer.id, { approved: false });

    expect((await list(`?farmerId=${farmer.id}`, farmer)).map((p) => p.id)).toContain(pending.id);
  });

  it("doesn't show anyone else a farmer's unapproved products via ?farmerId", async () => {
    const farmer = await createUser({ role: "farmer" });
    await createProduct(farmer.id, { approved: false });
    const stranger = await createUser();

    expect(await list(`?farmerId=${farmer.id}`)).toEqual([]);
    expect(await list(`?farmerId=${farmer.id}`, stranger)).toEqual([]);
    expect(await list(`?farmerId=${farmer.id}`, await createUser({ role: "farmer" }))).toEqual([]);
  });

  it("shows staff a farmer's unapproved products via ?farmerId", async () => {
    const farmer = await createUser({ role: "farmer" });
    const pending = await createProduct(farmer.id, { approved: false });

    expect((await list(`?farmerId=${farmer.id}`, await createUser({ role: "manager" }))).map((p) => p.id)).toEqual([pending.id]);
  });
});
