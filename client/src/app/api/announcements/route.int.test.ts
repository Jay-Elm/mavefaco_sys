import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";
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
