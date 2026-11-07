import { prisma } from "@/lib/prisma";

/**
 * What a listing's crop fields become from a form: a crop (no longer "not a
 * farm crop"), "not a farm crop" (no crop), or neither. `undefined` fields
 * mean "leave as is". Returns an error message for a crop that doesn't exist.
 */
export async function cropLinkData(
  cropTypeId: number | null | undefined,
  notACrop: boolean | undefined,
): Promise<{ data: { cropTypeId?: number | null; notACrop?: boolean } } | { error: string }> {
  if (notACrop) return { data: { cropTypeId: null, notACrop: true } };
  if (cropTypeId) {
    const exists = await prisma.cropType.findUnique({ where: { id: cropTypeId }, select: { id: true } });
    if (!exists) return { error: "Choose a crop from the list" };
    return { data: { cropTypeId, notACrop: false } };
  }
  if (cropTypeId === null || notACrop === false) return { data: { cropTypeId: null, notACrop: false } };
  return { data: {} };
}
