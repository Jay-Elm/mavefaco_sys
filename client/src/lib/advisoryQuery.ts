import { prisma } from "@/lib/prisma";
import { addDays, fromDateString, toDateString, todayPH } from "@/lib/planting";
import { groupAdvisory, type AdvisoryReport } from "@/lib/advisory";

/** How far back the advisory looks. */
export const ADVISORY_DAYS = 30;

/**
 * Members' pest, weather and damage reports from the last 30 days, each
 * tagged with its crop type and farm id (for counting farms, never shown).
 * Shared by the farmer and staff advisories.
 */
export async function recentReports(): Promise<AdvisoryReport[]> {
  const logs = await prisma.cropLog.findMany({
    where: {
      type: { in: ["pest_disease", "weather_impact", "damage"] },
      observedOn: { gte: fromDateString(addDays(todayPH(), -ADVISORY_DAYS)) },
      planting: { farmer: { deletedAt: null } },
    },
    select: {
      id: true,
      type: true,
      note: true,
      observedOn: true,
      planting: { select: { farmerId: true, cropType: { select: { id: true, name: true } } } },
    },
  });
  return logs.map(({ planting, observedOn, ...log }) => ({
    ...log,
    observedOn: toDateString(observedOn),
    farmerId: planting.farmerId,
    cropType: planting.cropType,
  }));
}

/** The advisory as both portals show it: grouped by crop and kind of problem. */
export async function recentAdvisory() {
  return groupAdvisory(await recentReports());
}
