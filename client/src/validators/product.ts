import { z } from "zod";
import { isSafeUrl } from "@/lib/url";
import { requiredString } from "./helpers";

const imageUrlField = z
  .string()
  .trim()
  .nullish()
  .refine((v) => !v || isSafeUrl(v), { message: "Image URL must be a valid URL" });

// POST /api/products — farmer/admin/manager creating a new product.
export const productCreateSchema = z.object({
  name: requiredString(z.string().trim().min(1, "Name is required")),
  // Optional per the create form — no min-length requirement.
  description: z.string().trim().catch(""),
  price: z.coerce.number().positive("Price must be greater than 0"),
  stock: z.coerce.number().min(0, "Stock cannot be negative"),
  unit: z.string().trim().min(1).catch("piece"),
  categoryId: z.coerce.number().int().positive("Valid category is required"),
  imageUrl: imageUrlField,
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;

// PATCH /api/products/[id] — farmer editing their own product (partial).
export const productUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").optional(),
  description: z.string().trim().optional(),
  price: z.coerce.number().positive("Price must be greater than 0").optional(),
  stock: z.coerce.number().min(0, "Stock cannot be negative").optional(),
  unit: z.string().trim().min(1).optional(),
  categoryId: z.coerce.number().int().positive("Valid category is required").optional(),
  imageUrl: imageUrlField,
});

export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

// PATCH /api/admin/products/[id] — admin/manager editing or approving.
export const adminProductUpdateSchema = productUpdateSchema.extend({
  approved: z.boolean().optional(),
});

export type AdminProductUpdateInput = z.infer<typeof adminProductUpdateSchema>;
