import { z } from "zod";
import { MAX, tooLong } from "./limits";
import { requiredString } from "./helpers";
import { todayPH } from "@/lib/planting";

const blankToNull = (v: unknown) => (v === "" || v === null || v === undefined ? null : v);

// A calendar date as "YYYY-MM-DD" that really exists (no Feb 30).
const calendarDate = (label: string) =>
  requiredString(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} is required`)
      .refine((v) => !isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v), {
        message: `${label} is not a valid date`,
      }),
  );

const notInFuture = (label: string) =>
  calendarDate(label).refine((v) => v <= todayPH(), { message: `${label} can't be in the future` });

// Kilograms or square metres: positive, with a generous upper bound.
const amount = (label: string) =>
  z.coerce.number({ message: `${label} must be a number` }).positive(`${label} must be greater than 0`).max(1_000_000, `${label} is too large`);

const day = (label: string) =>
  z.coerce.number({ message: `${label} must be a number` }).int(`${label} must be a whole number`).min(0, `${label} can't be negative`).max(730, `${label} is too large`);

// --- Crop types (staff) -------------------------------------------------------

const cropTypeFields = z.object({
  name: requiredString(z.string().trim().min(1, "Name is required").max(MAX.cropTypeName, tooLong("Name", MAX.cropTypeName))),
  // Both blank when no DA figure is known.
  daysToHarvestMin: z.preprocess(blankToNull, day("Earliest harvest day").min(1, "Earliest harvest day must be at least 1").nullable()),
  daysToHarvestMax: z.preprocess(blankToNull, day("Latest harvest day").nullable()),
  category: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v : undefined),
    z.string().trim().max(40, tooLong("Category", 40)).optional(),
  ),
  // Other names: a list, or one comma-separated string from the form.
  aliases: z.preprocess(
    (v) => (typeof v === "string" ? v.split(",") : v),
    z.array(z.string().trim().toLowerCase().max(60, tooLong("Each other name", 60))).max(30, "At most 30 other names")
      .transform((a) => [...new Set(a.filter(Boolean))]),
  ).optional(),
  // Optional citation for the range; blank clears it.
  source: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v : null),
    z.string().trim().max(MAX.cropSource, tooLong("Source", MAX.cropSource)).nullable(),
  ).optional(),
});

// POST /api/crop-types, PUT /api/crop-types/[id]
export const cropTypeSchema = cropTypeFields
  .refine((t) => (t.daysToHarvestMin === null) === (t.daysToHarvestMax === null), {
    message: "Give both harvest days, or leave both blank",
    path: ["daysToHarvestMax"],
  })
  .refine((t) => t.daysToHarvestMin === null || t.daysToHarvestMax === null || t.daysToHarvestMax >= t.daysToHarvestMin, {
    message: "Latest harvest day can't be before the earliest",
    path: ["daysToHarvestMax"],
  });
export type CropTypeInput = z.infer<typeof cropTypeSchema>;

// --- Plantings (farmer) -------------------------------------------------------

// POST /api/farmer/plantings
export const plantingCreateSchema = z.object({
  cropTypeId: z.coerce.number().int().positive("Choose a crop"),
  plantedOn: notInFuture("Planting date"),
  areaSqm: amount("Area").nullish(),
  expectedYield: amount("Expected yield").nullish(),
  productId: z.coerce.number().int().positive().nullish(),
  // Only used for a crop with no known growing time.
  harvestStart: calendarDate("Expected harvest start").optional(),
  harvestEnd: calendarDate("Expected harvest end").optional(),
})
  .refine((v) => !v.harvestStart || !v.harvestEnd || v.harvestEnd >= v.harvestStart, {
    message: "The harvest can't end before it starts",
    path: ["harvestEnd"],
  })
  .refine((v) => !v.harvestStart || v.harvestStart >= v.plantedOn, {
    message: "The harvest can't start before the planting date",
    path: ["harvestStart"],
  });
export type PlantingCreateInput = z.infer<typeof plantingCreateSchema>;

// PATCH /api/farmer/plantings/[id]. Harvested is set through /harvest, which
// records the yield; here a planting can only be marked failed or back to growing.
export const plantingUpdateSchema = z
  .object({
    plantedOn: notInFuture("Planting date").optional(),
    harvestStart: calendarDate("Harvest start").optional(),
    harvestEnd: calendarDate("Harvest end").optional(),
    areaSqm: amount("Area").nullable().optional(),
    expectedYield: amount("Expected yield").nullable().optional(),
    productId: z.coerce.number().int().positive().nullable().optional(),
    status: z.enum(["growing", "failed"]).optional(),
  })
  .refine((v) => (v.harvestStart === undefined) === (v.harvestEnd === undefined), {
    message: "Send both ends of the harvest window",
    path: ["harvestEnd"],
  })
  .refine((v) => !v.harvestStart || !v.harvestEnd || v.harvestEnd >= v.harvestStart, {
    message: "Harvest end can't be before harvest start",
    path: ["harvestEnd"],
  });
export type PlantingUpdateInput = z.infer<typeof plantingUpdateSchema>;

// POST /api/farmer/plantings/[id]/harvest
export const harvestSchema = z.object({
  harvestedOn: notInFuture("Harvest date"),
  actualYield: amount("Harvested amount").nullish(),
  // Units of the linked listing to add to its stock.
  addToStock: amount("Stock to add").nullish(),
});
export type HarvestInput = z.infer<typeof harvestSchema>;

// --- Crop logs ----------------------------------------------------------------

export const CROP_LOG_TYPES = ["weather_impact", "pest_disease", "damage", "note"] as const;

// POST /api/farmer/plantings/[id]/logs
export const cropLogCreateSchema = z.object({
  type: z.enum(CROP_LOG_TYPES),
  note: requiredString(z.string().trim().min(1, "Note is required").max(MAX.cropNote, tooLong("Note", MAX.cropNote))),
  observedOn: notInFuture("Date observed"),
});
export type CropLogCreateInput = z.infer<typeof cropLogCreateSchema>;
