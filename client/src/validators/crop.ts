import { z } from "zod";
import { MAX, tooLong } from "./limits";
import { requiredString } from "./helpers";
import { todayPH } from "@/lib/planting";

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
  daysToHarvestMin: day("Earliest harvest day").min(1, "Earliest harvest day must be at least 1"),
  daysToHarvestMax: day("Latest harvest day"),
  vegetativeDay: day("Vegetative stage day"),
  floweringDay: day("Flowering stage day").nullable().optional(),
  fruitingDay: day("Fruiting stage day").nullable().optional(),
});

type CropTypeFields = z.infer<typeof cropTypeFields>;

// Stages must start in order, all before the harvest window opens.
function stagesInOrder(t: CropTypeFields, ctx: z.RefinementCtx) {
  const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (t.daysToHarvestMax < t.daysToHarvestMin) issue("daysToHarvestMax", "Latest harvest day can't be before the earliest");
  if (t.vegetativeDay >= t.daysToHarvestMin) issue("vegetativeDay", "Vegetative stage must start before harvest");
  const flowering = t.floweringDay ?? null;
  const fruiting = t.fruitingDay ?? null;
  if (flowering !== null && (flowering <= t.vegetativeDay || flowering >= t.daysToHarvestMin))
    issue("floweringDay", "Flowering must start after the vegetative stage and before harvest");
  if (fruiting !== null) {
    if (flowering === null) issue("fruitingDay", "Set when flowering starts before fruiting");
    else if (fruiting <= flowering || fruiting >= t.daysToHarvestMin)
      issue("fruitingDay", "Fruiting must start after flowering and before harvest");
  }
}

// POST /api/crop-types, PUT /api/crop-types/[id]
export const cropTypeSchema = cropTypeFields.superRefine(stagesInOrder);
export type CropTypeInput = z.infer<typeof cropTypeSchema>;

// --- Plantings (farmer) -------------------------------------------------------

// POST /api/farmer/plantings
export const plantingCreateSchema = z.object({
  cropTypeId: z.coerce.number().int().positive("Choose a crop"),
  plantedOn: notInFuture("Planting date"),
  areaSqm: amount("Area").nullish(),
  expectedYield: amount("Expected yield").nullish(),
  productId: z.coerce.number().int().positive().nullish(),
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
export const CROP_LOG_SEVERITIES = ["low", "medium", "high"] as const;

// Common vegetable pests and diseases in the Philippines, for grouping
// reports; anything else is "other" with the details in the note.
export const CROP_PESTS = [
  "aphids",
  "armyworm",
  "cutworm",
  "fruit-and-shoot-borer",
  "fruit-fly",
  "leaf-miner",
  "thrips",
  "whitefly",
  "diamondback-moth",
  "bacterial-wilt",
  "fusarium-wilt",
  "leaf-spot",
  "powdery-mildew",
  "downy-mildew",
  "damping-off",
  "mosaic-virus",
  "other",
] as const;

export const PEST_LABELS: Record<(typeof CROP_PESTS)[number], string> = {
  aphids: "Aphids",
  armyworm: "Armyworm",
  cutworm: "Cutworm",
  "fruit-and-shoot-borer": "Fruit and shoot borer",
  "fruit-fly": "Fruit fly",
  "leaf-miner": "Leaf miner",
  thrips: "Thrips",
  whitefly: "Whitefly",
  "diamondback-moth": "Diamondback moth",
  "bacterial-wilt": "Bacterial wilt",
  "fusarium-wilt": "Fusarium wilt",
  "leaf-spot": "Leaf spot",
  "powdery-mildew": "Powdery mildew",
  "downy-mildew": "Downy mildew",
  "damping-off": "Damping-off",
  "mosaic-virus": "Mosaic virus",
  other: "Other",
};

// POST /api/farmer/plantings/[id]/logs
export const cropLogCreateSchema = z
  .object({
    type: z.enum(CROP_LOG_TYPES),
    note: requiredString(z.string().trim().min(1, "Note is required").max(MAX.cropNote, tooLong("Note", MAX.cropNote))),
    observedOn: notInFuture("Date observed"),
    severity: z.enum(CROP_LOG_SEVERITIES).nullish(),
    pest: z.enum(CROP_PESTS).nullish(),
  })
  .refine((v) => v.type === "note" || v.severity, { message: "Choose how severe it is", path: ["severity"] })
  .refine((v) => v.type !== "pest_disease" || v.pest, { message: "Choose the pest or disease", path: ["pest"] })
  // General notes carry no severity, and only pest reports name a pest.
  .transform((v) => ({
    ...v,
    severity: v.type === "note" ? null : (v.severity ?? null),
    pest: v.type === "pest_disease" ? (v.pest ?? null) : null,
  }));
export type CropLogCreateInput = z.infer<typeof cropLogCreateSchema>;
