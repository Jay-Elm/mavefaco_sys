import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";
import { PATCH } from "./[id]/route";
import { params } from "@/test-utils/integration/helpers";
import { prisma } from "@/lib/prisma";
import { createUser, request, type SessionUser } from "@/test-utils/integration/helpers";

const list = async (as?: SessionUser) =>
  ((await (await GET(request("/api/announcements", { as }))).json()) as { title: string }[]).map((a) => a.title).sort();

/** One announcement per audience, titled after it. */
async function seed() {
  const staff = await createUser({ role: "manager" });
  for (const audience of ["everyone", "farmers", "customers"])
    await prisma.announcement.create({ data: { title: audience, body: "b", audience, authorId: staff.id } });
  return staff;
}

describe("GET /api/announcements — audience", () => {
  it("shows farmers the announcements for everyone and for farmers", async () => {
    await seed();
    expect(await list(await createUser({ role: "farmer" }))).toEqual(["everyone", "farmers"]);
  });

  it("shows customers and guests the ones for everyone and for customers", async () => {
    await seed();
    expect(await list(await createUser({ role: "customer" }))).toEqual(["customers", "everyone"]);
    expect(await list()).toEqual(["customers", "everyone"]);
  });

  it("shows staff all of them", async () => {
    const staff = await seed();
    expect(await list(staff)).toEqual(["customers", "everyone", "farmers"]);
  });
});

describe("POST /api/announcements — audience", () => {
  it("saves the chosen audience and defaults to everyone", async () => {
    const staff = await createUser({ role: "admin" });
    const post = (body: unknown) => POST(request("/api/announcements", { method: "POST", as: staff, body }));

    const forFarmers = await post({ title: "Seed day", body: "b", audience: "farmers" });
    expect(forFarmers.status).toBe(201);
    expect((await forFarmers.json()).audience).toBe("farmers");
    expect((await (await post({ title: "Hello", body: "b" })).json()).audience).toBe("everyone");
  });

  it("rejects an unknown audience instead of publishing to everyone", async () => {
    const staff = await createUser({ role: "admin" });
    const res = await POST(request("/api/announcements", { method: "POST", as: staff, body: { title: "t", body: "b", audience: "staff" } }));
    expect(res.status).toBe(400);
    expect(await prisma.announcement.count()).toBe(0);
  });
});

describe("PATCH /api/announcements/[id] — pin", () => {
  const pin = (as: SessionUser, id: number, pinned: unknown) =>
    PATCH(request(`/api/announcements/${id}`, { method: "PATCH", as, body: { pinned } }), params({ id: String(id) }));
  const order = async (as?: SessionUser) =>
    ((await (await GET(request("/api/announcements", { as }))).json()) as { title: string }[]).map((a) => a.title);

  it("puts a pinned announcement first for its audience, and unpinning puts it back", async () => {
    const staff = await createUser({ role: "manager" });
    const make = (title: string, audience: string, daysAgo: number) =>
      prisma.announcement.create({ data: { title, body: "b", audience, authorId: staff.id, createdAt: new Date(Date.now() - daysAgo * 86400000) } });
    const old = await make("old for customers", "customers", 9);
    await make("new for everyone", "everyone", 1);
    await make("for farmers", "farmers", 2);

    expect(await order()).toEqual(["new for everyone", "old for customers"]);
    expect((await pin(staff, old.id, true)).status).toBe(200);
    expect(await order()).toEqual(["old for customers", "new for everyone"]);
    // Farmers don't see it, pinned or not.
    expect(await order(await createUser({ role: "farmer" }))).toEqual(["new for everyone", "for farmers"]);
    expect(await prisma.auditLog.count({ where: { action: "PIN_ANNOUNCEMENT", entityId: old.id } })).toBe(1);

    expect((await pin(staff, old.id, false)).status).toBe(200);
    expect(await order()).toEqual(["new for everyone", "old for customers"]);
  });

  it("only staff can pin; bad input and unknown ids are refused", async () => {
    const staff = await createUser({ role: "admin" });
    const a = await prisma.announcement.create({ data: { title: "t", body: "b", authorId: staff.id } });
    expect((await pin(await createUser({ role: "farmer" }), a.id, true)).status).toBe(403);
    expect((await pin(staff, a.id, "yes")).status).toBe(400);
    expect((await pin(staff, a.id + 99, true)).status).toBe(404);
    expect((await prisma.announcement.findUniqueOrThrow({ where: { id: a.id } })).pinnedAt).toBeNull();
  });
});
