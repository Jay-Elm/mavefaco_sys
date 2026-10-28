import { z } from "zod";

// PUT /api/admin/faqs/order and /api/admin/banners/order — every item's id,
// in the order they should show.
export const reorderSchema = z.object({
  ids: z
    .array(z.number().int().positive())
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length, { message: "Each item can appear only once" }),
});

export type ReorderInput = z.infer<typeof reorderSchema>;
