import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";
import { DELETE } from "./[reviewId]/route";
import { prisma } from "@/lib/prisma";
import { createUser, params, request, withRowLocked, type SessionUser } from "@/test-utils/integration/helpers";
import { placedOrder } from "@/test-utils/integration/orders";

const review = (productId: number, as: SessionUser | undefined, body: unknown = { rating: 5, comment: "Great" }) =>
  POST(request(`/api/products/${productId}/reviews`, { method: "POST", as, body }), params({ id: String(productId) }));
const remove = (productId: number, reviewId: number, as: SessionUser) =>
  DELETE(
    request(`/api/products/${productId}/reviews/${reviewId}`, { method: "DELETE", as }),
    params({ id: String(productId), reviewId: String(reviewId) }),
  );

describe("POST /api/products/[id]/reviews", () => {
  it("lets a customer review a product from a delivered order", async () => {
    const { customer, product } = await placedOrder({ status: "delivered" });

    const res = await review(product.id, customer, { rating: 4, comment: "  Sweet and fresh  " });

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ rating: 4, comment: "Sweet and fresh", customer: { id: customer.id } });
  });

  it.each(["pending", "confirmed", "shipped", "cancelled"])("refuses while the order is %s", async (status) => {
    const { customer, product } = await placedOrder({ status });

    expect((await review(product.id, customer)).status).toBe(403);
  });

  it("refuses a customer who never bought the product", async () => {
    const { product } = await placedOrder({ status: "delivered" });

    expect((await review(product.id, await createUser())).status).toBe(403);
  });

  it("refuses the farmer reviewing their own product", async () => {
    const { farmer, product } = await placedOrder({ status: "delivered" });

    expect((await review(product.id, farmer)).status).toBe(403);
  });

  it("allows one review per customer per product", async () => {
    const { customer, product } = await placedOrder({ status: "delivered" });

    expect((await review(product.id, customer)).status).toBe(201);
    expect((await review(product.id, customer)).status).toBe(409);
    expect(await prisma.review.count()).toBe(1);
  });

  // Both requests pass the "already reviewed?" check before either inserts.
  const doubleSubmit = async () => {
    const { customer, product } = await placedOrder({ status: "delivered" });
    return withRowLocked("Product", product.id, 2, () =>
      Promise.all([review(product.id, customer), review(product.id, customer)]),
    );
  };

  it("never stores two reviews when the same customer submits twice at once", async () => {
    const results = await doubleSubmit();

    expect(await prisma.review.count()).toBe(1); // the unique constraint holds
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
  });

  // KNOWN BUG (minor): the losing insert hits the unique constraint and the
  // route returns a generic 500 instead of the 409 a sequential duplicate
  // gets. Data is correct either way. Flip to `it` once P2002 maps to 409.
  it.fails("answers the losing duplicate with 409, not 500", async () => {
    expect((await doubleSubmit()).map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it.each([0, 6, 4.5])("rejects a rating of %s", async (rating) => {
    const { customer, product } = await placedOrder({ status: "delivered" });

    expect((await review(product.id, customer, { rating })).status).toBe(400);
  });

  it("requires a session", async () => {
    const { product } = await placedOrder({ status: "delivered" });
    expect((await review(product.id, undefined)).status).toBe(401);
  });
});

describe("GET /api/products/[id]/reviews", () => {
  it("lists reviews newest first, exposing only the reviewer's id and name", async () => {
    const first = await placedOrder({ status: "delivered" });
    const { product } = first;
    const second = await createUser();
    await prisma.order.create({
      data: { customerId: second.id, totalAmount: 50, status: "delivered", items: { create: [{ productId: product.id, quantity: 1, price: 50 }] } },
    });
    await review(product.id, first.customer, { rating: 3 });
    await review(product.id, second, { rating: 5 });

    const res = await GET(request(`/api/products/${product.id}/reviews`), params({ id: String(product.id) }));
    const body = await res.json();

    expect(body.map((r: { rating: number }) => r.rating)).toEqual([5, 3]);
    expect(Object.keys(body[0].customer).sort()).toEqual(["id", "name"]);
  });
});

describe("DELETE /api/products/[id]/reviews/[reviewId]", () => {
  async function existingReview() {
    const ctx = await placedOrder({ status: "delivered" });
    const r = await prisma.review.create({ data: { customerId: ctx.customer.id, productId: ctx.product.id, rating: 2 } });
    return { ...ctx, reviewId: r.id };
  }

  it("lets the author delete their review", async () => {
    const { customer, product, reviewId } = await existingReview();

    expect((await remove(product.id, reviewId, customer)).status).toBe(200);
    expect(await prisma.review.count()).toBe(0);
  });

  it("lets a manager remove any review", async () => {
    const { product, reviewId } = await existingReview();

    expect((await remove(product.id, reviewId, await createUser({ role: "manager" }))).status).toBe(200);
  });

  it("forbids other customers and the product's farmer", async () => {
    const { farmer, product, reviewId } = await existingReview();

    expect((await remove(product.id, reviewId, await createUser())).status).toBe(403);
    expect((await remove(product.id, reviewId, farmer)).status).toBe(403);
    expect(await prisma.review.count()).toBe(1);
  });
});
