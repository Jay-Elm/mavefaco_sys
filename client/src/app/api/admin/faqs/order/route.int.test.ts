import { describe, expect, it } from "vitest";
import { PUT } from "./route";
import { POST as createFaq } from "../route";
import { PUT as orderBanners } from "../../banners/order/route";
import { prisma } from "@/lib/prisma";
import { createUser, request, type SessionUser } from "@/test-utils/integration/helpers";

const putFaqs = (as: SessionUser, ids: unknown) => PUT(request("/api/admin/faqs/order", { method: "PUT", as, body: { ids } }));
const faqOrder = async () =>
  (await prisma.faq.findMany({ orderBy: [{ displayOrder: "asc" }, { id: "asc" }] })).map((f) => f.question);

async function threeFaqs() {
  // Tied and negative orders, as the old typed box allowed.
  const a = await prisma.faq.create({ data: { question: "a", answer: "x", displayOrder: 0 } });
  const b = await prisma.faq.create({ data: { question: "b", answer: "x", displayOrder: 0 } });
  const c = await prisma.faq.create({ data: { question: "c", answer: "x", displayOrder: -3 } });
  return { a, b, c };
}

describe("PUT /api/admin/faqs/order", () => {
  it("saves the given order as 0, 1, 2…", async () => {
    const admin = await createUser({ role: "admin" });
    const { a, b, c } = await threeFaqs();

    const res = await putFaqs(admin, [b.id, a.id, c.id]);

    expect(res.status).toBe(200);
    expect(await faqOrder()).toEqual(["b", "a", "c"]);
    expect((await prisma.faq.findMany({ orderBy: { displayOrder: "asc" } })).map((f) => f.displayOrder)).toEqual([0, 1, 2]);
    expect(await prisma.auditLog.count({ where: { action: "REORDER_FAQS", userId: admin.id } })).toBe(1);
  });

  it("refuses a list that doesn't match the current FAQs, changing nothing", async () => {
    const admin = await createUser({ role: "admin" });
    const { a, b, c } = await threeFaqs();
    const before = await faqOrder();

    expect((await putFaqs(admin, [a.id, b.id])).status).toBe(409); // one added since the page loaded
    expect((await putFaqs(admin, [a.id, b.id, c.id, c.id + 999])).status).toBe(409); // one deleted since
    expect((await putFaqs(admin, [a.id, a.id, b.id])).status).toBe(400); // duplicate
    expect(await faqOrder()).toEqual(before);
  });

  it("is admin only", async () => {
    const { a, b, c } = await threeFaqs();
    expect((await putFaqs(await createUser({ role: "manager" }), [c.id, b.id, a.id])).status).toBe(403);
  });

  it("adds new FAQs at the end, ignoring any order sent", async () => {
    const admin = await createUser({ role: "admin" });
    const { a, b, c } = await threeFaqs();
    await putFaqs(admin, [a.id, b.id, c.id]);

    const res = await createFaq(request("/api/admin/faqs", { method: "POST", as: admin, body: { question: "d", answer: "x", displayOrder: -50 } }));

    expect(res.status).toBe(201);
    expect(await faqOrder()).toEqual(["a", "b", "c", "d"]);
  });
});

describe("PUT /api/admin/banners/order", () => {
  it("saves the given order", async () => {
    const admin = await createUser({ role: "admin" });
    const one = await prisma.banner.create({ data: { title: "one", displayOrder: 0 } });
    const two = await prisma.banner.create({ data: { title: "two", displayOrder: 1 } });

    const res = await orderBanners(request("/api/admin/banners/order", { method: "PUT", as: admin, body: { ids: [two.id, one.id] } }));

    expect(res.status).toBe(200);
    expect((await prisma.banner.findMany({ orderBy: { displayOrder: "asc" } })).map((b) => b.title)).toEqual(["two", "one"]);
  });
});
