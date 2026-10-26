// Groups members' crop reports for the community advisory, so that "four
// farms saw aphids on tomato this month" reads as one line instead of four.

export interface AdvisoryReport {
  id: number;
  type: string;
  note: string;
  observedOn: string;
  severity: string | null;
  pest: string | null;
  farmerId: number;
  cropType: { id: number; name: string };
}

export interface AdvisoryGroup {
  key: string;
  type: string;
  pest: string | null;
  cropType: string;
  farms: number;
  reports: number;
  high: number;
  latest: string;
  // Newest first, without who reported them.
  notes: { id: number; note: string; observedOn: string; severity: string | null }[];
}

/** How many of a group's notes are shown. */
export const ADVISORY_NOTES_PER_GROUP = 5;

/**
 * One group per crop and problem: pest reports by pest, weather and damage
 * reports by type. Groups seen on more farms come first, then those with
 * more high-severity reports, then the most recent.
 */
export function groupAdvisory(reports: AdvisoryReport[]): AdvisoryGroup[] {
  const groups = new Map<string, AdvisoryGroup & { farmIds: Set<number> }>();
  const sorted = [...reports].sort((a, b) => b.observedOn.localeCompare(a.observedOn) || b.id - a.id);

  for (const r of sorted) {
    const key = `${r.cropType.id}:${r.type}:${r.type === "pest_disease" ? (r.pest ?? "other") : ""}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        key, type: r.type, pest: r.type === "pest_disease" ? (r.pest ?? "other") : null, cropType: r.cropType.name,
        farms: 0, reports: 0, high: 0, latest: r.observedOn, notes: [], farmIds: new Set(),
      };
      groups.set(key, g);
    }
    g.reports++;
    g.farmIds.add(r.farmerId);
    if (r.severity === "high") g.high++;
    if (g.notes.length < ADVISORY_NOTES_PER_GROUP) g.notes.push({ id: r.id, note: r.note, observedOn: r.observedOn, severity: r.severity });
  }

  return [...groups.values()]
    .map(({ farmIds, ...g }) => ({ ...g, farms: farmIds.size }))
    .sort((a, b) => b.farms - a.farms || b.high - a.high || b.latest.localeCompare(a.latest));
}
