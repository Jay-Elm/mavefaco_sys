import { prisma } from "@/lib/prisma";

/** Lists that admins arrange with the move up/down buttons. */
type OrderedModel = "faq" | "banner";

export class ReorderConflict extends Error {}

/**
 * Saves a new order for every FAQ or banner: `ids` lists all of them, first
 * shown first, and each gets its index as displayOrder. Throws
 * ReorderConflict when `ids` isn't exactly the current set (one was added or
 * deleted since the page loaded), so nothing is half-applied.
 */
export async function saveOrder(model: OrderedModel, ids: number[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const delegate = model === "faq" ? tx.faq : tx.banner;
    // Both delegates share these methods; the casts keep TypeScript from
    // insisting on one model's argument types.
    const current = await (delegate as typeof tx.faq).findMany({ select: { id: true } });
    const known = new Set(current.map((r) => r.id));
    if (current.length !== ids.length || ids.some((id) => !known.has(id))) throw new ReorderConflict();

    for (const [index, id] of ids.entries()) {
      const { count } = await (delegate as typeof tx.faq).updateMany({ where: { id }, data: { displayOrder: index } });
      if (count === 0) throw new ReorderConflict();
    }
  });
}

/** displayOrder for a new item: after every existing one. */
export async function nextDisplayOrder(model: OrderedModel): Promise<number> {
  const delegate = model === "faq" ? prisma.faq : prisma.banner;
  const { _max } = await (delegate as typeof prisma.faq).aggregate({ _max: { displayOrder: true } });
  return (_max.displayOrder ?? -1) + 1;
}
