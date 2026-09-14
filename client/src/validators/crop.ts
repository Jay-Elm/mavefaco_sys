import { z } from "zod";
import { requiredString } from "./helpers";

export const CROP_GROWTH_STAGES = [
  "seedling",
  "vegetative",
  "flowering",
  "fruiting",
  "harvest-ready",
  "harvested",
] as const;

// A date field that may be absent (key not sent -> don't touch), explicitly
// cleared (null or ""), or a parseable date string.
const dateOrNull = z
  .union([z.string(), z.null()])
  .refine((v) => v === null || v === "" || !isNaN(Date.parse(v)), { message: "Invalid date" })
  .optional();

// PATCH /api/farmer/crops/[id]
export const cropUpdateSchema = z.object({
  plantingDate: dateOrNull,
  expectedHarvestDate: dateOrNull,
  // An unrecognized stage silently clears to null, matching the previous
  // manual VALID_STAGES.includes(...) ? value : null behavior.
  growthStage: z.enum(CROP_GROWTH_STAGES).nullish().catch(null),
  readyForHarvest: z.boolean().optional(),
});

export type CropUpdateInput = z.infer<typeof cropUpdateSchema>;

export const CROP_LOG_TYPES = ["weather_impact", "pest_disease", "damage", "note"] as const;

// POST /api/farmer/crops/[id]/logs
export const cropLogCreateSchema = z.object({
  type: z.enum(CROP_LOG_TYPES),
  note: requiredString(z.string().trim().min(1, "Note is required")),
});

export type CropLogCreateInput = z.infer<typeof cropLogCreateSchema>;
