import { z } from "zod";

// Preprocessing a missing/wrong-type value down to "" before the real check
// means an absent field fails the same min-length/format check (and gets
// the same message) as an empty one — rather than zod's generic "expected
// string, received undefined" for the missing case only.
export const requiredString = (schema: z.ZodString) =>
  z.preprocess((v) => (typeof v === "string" ? v : ""), schema);
