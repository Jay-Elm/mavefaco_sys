import { describe, expect, it } from "vitest";
import { POST as checkoutRoute } from "./route";
import { GET as optionsRoute } from "./options/route";
import { GET as customerOrders } from "../customer/orders/route";
import { PATCH as customerPatch } from "../customer/orders/[id]/route";
import { POST as submitPayment } from "../customer/orders/[id]/payment/route";
import { POST as farmerPayment } from "../farmer/orders/[id]/payment/route";
import { PATCH as farmerPatch } from "../farmer/orders/[id]/route";
import { GET as staffOrders } from "../admin/orders/route";
import { PATCH as staffPatch } from "../admin/orders/[id]/route";
import { PUT as putLocation } from "../users/me/location/route";
import { PUT as putGcash } from "../users/me/gcash/route";
import { prisma } from "@/lib/prisma";
import { deleteUserAccount } from "@/lib/deleteAccount";
import { createProduct, createUser, params, request, type SessionUser } from "@/test-utils/integration/helpers";
import { placedOrder } from "@/test-utils/integration/orders";

const TABACO = { lat: 13.3594, lng: 123.7311 };
const LEGAZPI = { lat: 13.1391, lng: 123.7438 };
const REF = "1234567891234";

const checkout = (as: SessionUser, productId: number, paymentMethod: string, deliveryMethod = "pickup") =>
  checkoutRoute(request("/api/orders", { method: "POST", as, body: { items: [{ productId, quantity: 1 }], paymentMethod, deliveryMethod } }));
const pay = (as: SessionUser, orderId: number, body: Record<string, unknown> = { reference: REF, payerName: "Juan Dela Cruz", payerNumber: "0917 123 4567" }) =>
  submitPayment(request(`/api/customer/orders/${orderId}/payment`, { method: "POST", as, body }), params({ id: String(orderId) }));
const answer = (as: SessionUser, orderId: number, action: string) =>
  farmerPayment(request(`/api/farmer/orders/${orderId}/payment`, { method: "POST", as, body: { action } }), params({ id: String(orderId) }));
const orderOf = (id: number) => prisma.order.findUniqueOrThrow({ where: { id } });

async function farmerWithGcash() {
  const farmer = await createUser({ role: "farmer" });
  await prisma.user.update({ where: { id: farmer.id }, data: { gcashName: "Maria Santos", gcashNumber: "09181234567" } });
  return farmer;
}

describe("checkout payment methods", () => {
  it("refuses Bank Transfer, which is no longer offered", async () => {
    const farmer = await farmerWithGcash();
    const product = await createProduct(farmer.id);
    const res = await checkout(await createUser(), product.id, "bank_transfer");
    expect(res.status).toBe(400);
  });

  it("refuses GCash when the farmer hasn't set it up, and the options say so", async () => {
    const farmer = await createUser({ role: "farmer" });
    const customer = await createUser();
    const product = await createProduct(farmer.id);

    const opts = await optionsRoute(request(`/api/orders/options?farmerId=${farmer.id}`, { as: customer }));
    expect(await opts.json()).toEqual({ gcash: false });

    const res = await checkout(customer, product.id, "gcash");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/hasn't set up GCash/);
    expect(await prisma.order.count()).toBe(0);
  });

  it("takes GCash when the farmer has it, and shows the customer where to pay", async () => {
    const farmer = await farmerWithGcash();
    const customer = await createUser();
    const product = await createProduct(farmer.id);

    const opts = await optionsRoute(request(`/api/orders/options?farmerId=${farmer.id}`, { as: customer }));
    expect(await opts.json()).toEqual({ gcash: true });

    const res = await checkout(customer, product.id, "gcash");
    expect(res.status).toBe(201);
    const [order] = await (await customerOrders(request("/api/customer/orders", { as: customer }))).json();
    expect(order.paymentStatus).toBe("unpaid");
    expect(order.payTo).toEqual({ name: "Maria Santos", number: "09181234567", qrUrl: null });
    expect(order.farmer).toEqual({ id: farmer.id, name: farmer.name });
  });
});

describe("checkout delivery", () => {
  it("needs a saved location", async () => {
    const product = await createProduct((await farmerWithGcash()).id);
    const res = await checkout(await createUser(), product.id, "cod", "delivery");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Set your delivery location/);
  });

  it("saves a location outside the area but refuses delivery to it", async () => {
    const product = await createProduct((await farmerWithGcash()).id);
    const customer = await createUser();
    const saved = await putLocation(request("/api/users/me/location", { method: "PUT", as: customer, body: { ...LEGAZPI, address: "Rizal St., Legazpi" } }));
    expect(saved.status).toBe(200);
    expect((await saved.json()).deliveryTown).toBeNull();

    const res = await checkout(customer, product.id, "cod", "delivery");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/only within Tabaco City, Malinao, Malilipot, Ligao City and Oas/);
    // Pickup still works.
    expect((await checkout(customer, product.id, "cod", "pickup")).status).toBe(201);
  });

  it("copies a location inside the area onto the order", async () => {
    const product = await createProduct((await farmerWithGcash()).id);
    const customer = await createUser();
    const saved = await putLocation(request("/api/users/me/location", { method: "PUT", as: customer, body: { ...TABACO, address: "123 Ziga Ave., near the church" } }));
    expect((await saved.json()).deliveryTown).toBe("Tabaco City");

    const res = await checkout(customer, product.id, "cod", "delivery");
    expect(res.status).toBe(201);
    const order = await orderOf((await res.json()).id);
    expect(order).toMatchObject({ deliveryLat: TABACO.lat, deliveryLng: TABACO.lng, deliveryAddress: "123 Ziga Ave., near the church", deliveryTown: "Tabaco City" });
  });

  it("is for customers only, and checks the pin and details", async () => {
    const farmer = await createUser({ role: "farmer" });
    expect((await putLocation(request("/api/users/me/location", { method: "PUT", as: farmer, body: { ...TABACO, address: "Somewhere 1" } }))).status).toBe(403);
    const customer = await createUser();
    expect((await putLocation(request("/api/users/me/location", { method: "PUT", as: customer, body: { ...TABACO, address: "x" } }))).status).toBe(400);
    expect((await putLocation(request("/api/users/me/location", { method: "PUT", as: customer, body: { lat: 51.5, lng: -0.1, address: "London Road" } }))).status).toBe(400);
  });

  it("keeps the delivery address from staff but shows the town", async () => {
    const product = await createProduct((await farmerWithGcash()).id);
    const customer = await createUser();
    await putLocation(request("/api/users/me/location", { method: "PUT", as: customer, body: { ...TABACO, address: "123 Ziga Ave." } }));
    await checkout(customer, product.id, "cod", "delivery");

    const [order] = await (await staffOrders(request("/api/admin/orders", { as: await createUser({ role: "manager" }) }))).json();
    expect(order.deliveryTown).toBe("Tabaco City");
    expect(order).not.toHaveProperty("deliveryAddress");
    expect(order).not.toHaveProperty("deliveryLat");
  });
});

describe("GCash payment steps", () => {
  it("customer enters the reference, farmer confirms, then the order can ship", async () => {
    const { farmer, customer, order } = await placedOrder({ paymentMethod: "gcash" });
    await farmerPatch(request(`/api/farmer/orders/${order.id}`, { method: "PATCH", as: farmer, body: { status: "confirmed" } }), params({ id: String(order.id) }));

    // Can't ship before the money is confirmed.
    const early = await farmerPatch(request(`/api/farmer/orders/${order.id}`, { method: "PATCH", as: farmer, body: { status: "shipped" } }), params({ id: String(order.id) }));
    expect(early.status).toBe(400);
    expect((await early.json()).error).toMatch(/confirm the payment/);

    expect((await pay(customer, order.id)).status).toBe(200);
    expect(await orderOf(order.id)).toMatchObject({ paymentStatus: "submitted", gcashReference: REF, payerNumber: "09171234567" });
    // Saved to their profile for next time.
    expect(await prisma.user.findUniqueOrThrow({ where: { id: customer.id } })).toMatchObject({ gcashName: "Juan Dela Cruz", gcashNumber: "09171234567" });

    expect((await answer(farmer, order.id, "confirm")).status).toBe(200);
    expect((await orderOf(order.id)).paidAt).not.toBeNull();

    const ship = await farmerPatch(request(`/api/farmer/orders/${order.id}`, { method: "PATCH", as: farmer, body: { status: "shipped" } }), params({ id: String(order.id) }));
    expect(ship.status).toBe(200);
  });

  it("a rejected payment frees the reference and lets the customer enter it again", async () => {
    const { farmer, customer, order } = await placedOrder({ paymentMethod: "gcash" });
    await pay(customer, order.id);
    expect((await pay(customer, order.id)).status).toBe(409); // already entered

    expect((await answer(farmer, order.id, "reject")).status).toBe(200);
    expect(await orderOf(order.id)).toMatchObject({ paymentStatus: "rejected", gcashReference: null });
    expect((await pay(customer, order.id)).status).toBe(200);
  });

  it("refuses a reference already used on another order", async () => {
    const a = await placedOrder({ paymentMethod: "gcash" });
    const b = await placedOrder({ paymentMethod: "gcash" });
    expect((await pay(a.customer, a.order.id)).status).toBe(200);
    const res = await pay(b.customer, b.order.id);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already used/);
  });

  it("checks the reference and number, the order's owner and its method", async () => {
    const { customer, order } = await placedOrder({ paymentMethod: "gcash" });
    expect((await pay(customer, order.id, { reference: "123", payerName: "Juan", payerNumber: "09171234567" })).status).toBe(400);
    expect((await pay(customer, order.id, { reference: REF, payerName: "Juan", payerNumber: "12345" })).status).toBe(400);
    expect((await pay(await createUser(), order.id)).status).toBe(403);
    const cod = await placedOrder();
    expect((await pay(cod.customer, cod.order.id)).status).toBe(400);
  });

  it("only the order's farmer can answer", async () => {
    const { customer, order } = await placedOrder({ paymentMethod: "gcash" });
    await pay(customer, order.id);
    expect((await answer(await createUser({ role: "farmer" }), order.id, "confirm")).status).toBe(403);
  });
});

describe("refunds", () => {
  it("cancelling after paying makes a refund due, which the farmer marks sent", async () => {
    const { farmer, customer, order } = await placedOrder({ paymentMethod: "gcash" });
    await pay(customer, order.id);
    const res = await customerPatch(request(`/api/customer/orders/${order.id}`, { method: "PATCH", as: customer, body: { status: "cancelled" } }), params({ id: String(order.id) }));
    expect(res.status).toBe(200);
    expect((await orderOf(order.id)).paymentStatus).toBe("refund_due");

    // The farmer can't leave while they owe it.
    expect((await deleteUserAccount(farmer.id)).ok).toBe(false);

    expect((await answer(farmer, order.id, "confirm")).status).toBe(409);
    expect((await answer(farmer, order.id, "refunded")).status).toBe(200);
    expect((await orderOf(order.id)).paymentStatus).toBe("refunded");
  });

  it("an unpaid GCash order cancels with nothing owed", async () => {
    const { farmer, order } = await placedOrder({ paymentMethod: "gcash" });
    await farmerPatch(request(`/api/farmer/orders/${order.id}`, { method: "PATCH", as: farmer, body: { status: "cancelled" } }), params({ id: String(order.id) }));
    expect((await orderOf(order.id)).paymentStatus).toBe("unpaid");
  });

  it("a confirmed payment can't be denied after cancelling", async () => {
    const { farmer, customer, order } = await placedOrder({ paymentMethod: "gcash" });
    await pay(customer, order.id);
    await answer(farmer, order.id, "confirm");
    const manager = await createUser({ role: "manager" });
    await staffPatch(request(`/api/admin/orders/${order.id}`, { method: "PATCH", as: manager, body: { status: "cancelled" } }), params({ id: String(order.id) }));
    expect((await orderOf(order.id)).paymentStatus).toBe("refund_due");
    expect((await answer(farmer, order.id, "reject")).status).toBe(400);
  });

  it("a manager can't ship an unpaid GCash order; an admin can", async () => {
    const { order } = await placedOrder({ status: "confirmed", paymentMethod: "gcash" });
    const ship = (role: "manager" | "admin") =>
      createUser({ role }).then((u) => staffPatch(request(`/api/admin/orders/${order.id}`, { method: "PATCH", as: u, body: { status: "shipped" } }), params({ id: String(order.id) })));
    expect((await ship("manager")).status).toBe(400);
    expect((await ship("admin")).status).toBe(200);
  });
});

describe("GCash details", () => {
  it("a farmer saves name, number and QR; a customer's QR is ignored", async () => {
    const farmer = await createUser({ role: "farmer" });
    const res = await putGcash(request("/api/users/me/gcash", { method: "PUT", as: farmer, body: { name: "Maria Santos", number: "+63 918 123 4567", qrUrl: "https://example.supabase.co/qr.png" } }));
    expect(await res.json()).toEqual({ gcashName: "Maria Santos", gcashNumber: "09181234567", gcashQrUrl: "https://example.supabase.co/qr.png" });

    const customer = await createUser();
    const c = await putGcash(request("/api/users/me/gcash", { method: "PUT", as: customer, body: { name: "Juan", number: "09171234567", qrUrl: "https://example.com/x.png" } }));
    expect((await c.json()).gcashQrUrl).toBeNull();
  });

  it("refuses a number that isn't a PH mobile number", async () => {
    const res = await putGcash(request("/api/users/me/gcash", { method: "PUT", as: await createUser(), body: { name: "Juan", number: "052 123 4567" } }));
    expect(res.status).toBe(400);
  });

  it("deleting an account removes saved and past delivery details", async () => {
    const product = await createProduct((await farmerWithGcash()).id);
    const customer = await createUser();
    await putLocation(request("/api/users/me/location", { method: "PUT", as: customer, body: { ...TABACO, address: "123 Ziga Ave." } }));
    const { id } = await (await checkout(customer, product.id, "cod", "delivery")).json();
    await prisma.order.update({ where: { id }, data: { status: "delivered" } });

    expect((await deleteUserAccount(customer.id)).ok).toBe(true);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: customer.id } })).toMatchObject({ deliveryLat: null, deliveryAddress: null, gcashNumber: null });
    expect(await orderOf(id)).toMatchObject({ deliveryLat: null, deliveryAddress: null, deliveryTown: "Tabaco City" });
  });
});
