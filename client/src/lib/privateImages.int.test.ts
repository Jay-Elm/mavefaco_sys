import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as sendPhoto } from "@/app/api/messages/[userId]/image/route";
import { GET as thread } from "@/app/api/messages/[userId]/route";
import { GET as conversations } from "@/app/api/messages/route";
import { DELETE as removeQr, POST as uploadQr } from "@/app/api/users/me/gcash-qr/route";
import { GET as me } from "@/app/api/users/me/route";
import { GET as farmerOrders } from "@/app/api/farmer/orders/route";
import { POST as farmerPayment } from "@/app/api/farmer/orders/[id]/payment/route";
import { prisma } from "@/lib/prisma";
import { deleteUserAccount } from "@/lib/deleteAccount";
import { createUser, params, request, sessionToken, type SessionUser } from "@/test-utils/integration/helpers";
import { placedOrder } from "@/test-utils/integration/orders";
import { fakeStorage } from "@/test-utils/integration/storage";

/** The first bytes of a PNG: all the server reads to know the type. */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const png = (bytes: Uint8Array<ArrayBuffer> = PNG) => new File([bytes], "qr.png", { type: "image/png" });

function formRequest(path: string, as: SessionUser | undefined, fields: Record<string, string | File>, method = "POST") {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return new NextRequest(`http://localhost:3000${path}`, { method, headers: as ? { cookie: `token=${sessionToken(as)}` } : {}, body: form });
}
const photoTo = (as: SessionUser, to: number, fields: Record<string, string | File>) =>
  sendPhoto(formRequest(`/api/messages/${to}/image`, as, fields), params({ userId: String(to) }));
const uploads = (calls: { method: string; url: string }[]) =>
  calls.filter((c) => c.method === "POST" && c.url.includes("/object/private-images/")).map((c) => c.url.split("/object/private-images/")[1]);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("photos in Messages", () => {
  it("stores the photo privately and gives both sides a short-lived link", async () => {
    const calls = fakeStorage();
    const customer = await createUser();
    const farmer = await createUser({ role: "farmer" });

    const res = await photoTo(customer, farmer.id, { file: png(), caption: "  My GCash QR  " });
    expect(res.status).toBe(201);
    const sent = await res.json();
    expect(sent).toMatchObject({ content: "My GCash QR", imageUrl: expect.stringContaining("/object/sign/private-images/chat/") });
    expect(sent).not.toHaveProperty("imagePath");

    const [path] = uploads(calls);
    expect(path).toMatch(new RegExp(`^chat/${customer.id}/[0-9a-f-]{36}\\.png$`));
    expect((await prisma.message.findFirstOrThrow()).imagePath).toBe(path);

    const seen = await (await thread(request(`/api/messages/${customer.id}`, { as: farmer }), params({ userId: String(customer.id) }))).json();
    expect(seen[0].imageUrl).toContain(path);

    const list = await (await conversations(request("/api/messages", { as: farmer }))).json();
    expect(list[0].lastMessage).toBe("📷 My GCash QR");
  });

  it("creates the private bucket on first use", async () => {
    const calls = fakeStorage({ bucketMissing: true });
    const customer = await createUser();
    const farmer = await createUser({ role: "farmer" });
    expect((await photoTo(customer, farmer.id, { file: png() })).status).toBe(201);
    expect(calls.some((c) => c.url.endsWith("/storage/v1/bucket"))).toBe(true);
    expect((await prisma.message.findFirstOrThrow()).content).toBe("");
  });

  it("refuses non-images, big files, staff, and people who can't message each other", async () => {
    fakeStorage();
    const customer = await createUser();
    const farmer = await createUser({ role: "farmer" });
    const other = await createUser();
    const manager = await createUser({ role: "manager" });

    expect((await photoTo(customer, farmer.id, { file: new File(["<svg/>"], "x.png") })).status).toBe(400);
    const big = new Uint8Array(4 * 1024 * 1024 + 1);
    big.set(PNG);
    expect((await photoTo(customer, farmer.id, { file: png(big) })).status).toBe(400);
    expect((await photoTo(customer, farmer.id, { caption: "no file" })).status).toBe(400);
    expect((await photoTo(customer, other.id, { file: png() })).status).toBe(403);
    expect((await photoTo(manager, farmer.id, { file: png() })).status).toBe(403);
    expect(await prisma.message.count()).toBe(0);
  });

  it("fails cleanly when storage refuses the upload", async () => {
    fakeStorage({ uploadOk: false });
    const customer = await createUser();
    const farmer = await createUser({ role: "farmer" });
    expect((await photoTo(customer, farmer.id, { file: png() })).status).toBe(502);
    expect(await prisma.message.count()).toBe(0);
  });
});

describe("a customer's GCash QR and refunds", () => {
  it("customers keep a private QR that only a farmer owing them a refund sees", async () => {
    const calls = fakeStorage();
    const { farmer, customer, order } = await placedOrder({ paymentMethod: "gcash", paymentStatus: "refund_due", status: "cancelled" });
    await prisma.order.update({ where: { id: order.id }, data: { payerName: "Ana R.", payerNumber: "09171234567" } });

    const up = await uploadQr(formRequest("/api/users/me/gcash-qr", customer, { file: png() }));
    expect(up.status).toBe(200);
    expect((await up.json()).gcashQrViewUrl).toContain("gcash-qr/");
    const path = (await prisma.user.findUniqueOrThrow({ where: { id: customer.id } })).gcashQrPath!;
    expect(path).toMatch(new RegExp(`^gcash-qr/${customer.id}/`));
    expect((await (await me(request("/api/users/me", { as: customer }))).json()).gcashQrViewUrl).toContain(path);
    expect(uploads(calls)).toEqual([path]);

    const rows = await (await farmerOrders(request("/api/farmer/orders", { as: farmer }))).json();
    expect(rows[0].refundTo).toEqual({ name: "Ana R.", number: "09171234567", qrUrl: expect.stringContaining(path) });
    expect(rows[0].customer).not.toHaveProperty("gcashQrPath");

    // Only while the refund is owed.
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "refunded" } });
    expect((await (await farmerOrders(request("/api/farmer/orders", { as: farmer }))).json())[0].refundTo).toBeNull();

    // Replacing deletes the old picture; removing deletes the new one.
    await uploadQr(formRequest("/api/users/me/gcash-qr", customer, { file: png() }));
    const replaced = calls.filter((c) => c.method === "DELETE").flatMap((c) => c.paths ?? []);
    expect(replaced).toEqual([path]);
    expect((await removeQr(new NextRequest("http://localhost:3000/api/users/me/gcash-qr", { method: "DELETE", headers: { cookie: `token=${sessionToken(customer)}` } }))).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: customer.id } })).gcashQrPath).toBeNull();
  });

  it("only customers upload a private QR", async () => {
    fakeStorage();
    const farmer = await createUser({ role: "farmer" });
    expect((await uploadQr(formRequest("/api/users/me/gcash-qr", farmer, { file: png() }))).status).toBe(403);
  });

  it("the refund's reference is kept and sent to the customer", async () => {
    const { farmer, customer, order } = await placedOrder({ paymentMethod: "gcash", paymentStatus: "refund_due", status: "cancelled" });
    const refund = (body: Record<string, unknown>) =>
      farmerPayment(request(`/api/farmer/orders/${order.id}/payment`, { method: "POST", as: farmer, body }), params({ id: String(order.id) }));

    expect((await refund({ action: "refunded", refundReference: "12345" })).status).toBe(400);
    expect((await refund({ action: "refunded", refundReference: "1234 567 891234" })).status).toBe(200);

    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).refundReference).toBe("1234567891234");
    const msg = await prisma.message.findFirstOrThrow({ where: { receiverId: customer.id, kind: "order_update" } });
    expect(msg.content).toBe(`Your GCash refund for order #${order.id} was sent (reference 1234567891234). Check your GCash app.`);
  });
});

describe("deleting an account", () => {
  it("removes the photos in its conversations and its QR from storage", async () => {
    const calls = fakeStorage();
    const customer = await createUser();
    const farmer = await createUser({ role: "farmer" });
    await photoTo(customer, farmer.id, { file: png() });
    await photoTo(farmer, customer.id, { file: png() });
    await uploadQr(formRequest("/api/users/me/gcash-qr", customer, { file: png() }));
    const stored = uploads(calls);

    expect((await deleteUserAccount(customer.id)).ok).toBe(true);
    const deleted = calls.filter((c) => c.method === "DELETE").flatMap((c) => c.paths ?? []);
    expect(deleted.sort()).toEqual([...stored].sort());
    expect(await prisma.message.count()).toBe(0);
  });

  it("stops if storage won't delete them", async () => {
    fakeStorage({ deleteOk: () => false });
    const customer = await createUser();
    const farmer = await createUser({ role: "farmer" });
    await photoTo(customer, farmer.id, { file: png() });
    expect((await deleteUserAccount(customer.id)).ok).toBe(false);
    expect(await prisma.message.count()).toBe(1);
  });
});
