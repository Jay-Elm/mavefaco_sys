import { prisma } from "@/lib/prisma";
import { createProduct, createUser } from "./helpers";

/**
 * A farmer, a customer and one order of `quantity` units already placed,
 * with stock decremented the way checkout leaves it.
 */
export async function placedOrder({ status = "pending", stock = 10, quantity = 3 } = {}) {
  const farmer = await createUser({ role: "farmer" });
  const customer = await createUser();
  const product = await createProduct(farmer.id, { stock: stock - quantity });
  const order = await prisma.order.create({
    data: {
      customerId: customer.id,
      totalAmount: 50 * quantity,
      status,
      items: { create: [{ productId: product.id, quantity, price: 50 }] },
    },
  });
  const stockNow = async () => (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock;
  return { farmer, customer, product, order, stockNow };
}
