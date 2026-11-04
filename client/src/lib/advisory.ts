// Groups members' crop reports for the community advisory, so that "four
// farms reported a pest or disease on tomato this month" reads as one line
// instead of four.

export interface AdvisoryReport {
  id: number;
  type: string;
  note: string;
  observedOn: string;
  farmerId: number;
  cropType: { id: number; name: string };
}

export interface AdvisoryGroup {
  key: string;
  type: string;
  cropType: string;
  farms: number;
  reports: number;
  latest: string;
  // Newest first, without who reported them.
  notes: { id: number; note: string; observedOn: string }[];
}

/** How many of a group's notes are shown. */
export const ADVISORY_NOTES_PER_GROUP = 5;

/**
 * One group per crop and kind of problem (pest or disease, weather, damage).
 * Groups seen on more farms come first, then the most recent.
 */
export function groupAdvisory(reports: AdvisoryReport[]): AdvisoryGroup[] {
  const groups = new Map<string, AdvisoryGroup & { farmIds: Set<number> }>();
  const sorted = [...reports].sort((a, b) => b.observedOn.localeCompare(a.observedOn) || b.id - a.id);

  for (const r of sorted) {
    const key = `${r.cropType.id}:${r.type}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, type: r.type, cropType: r.cropType.name, farms: 0, reports: 0, latest: r.observedOn, notes: [], farmIds: new Set() };
      groups.set(key, g);
    }
    g.reports++;
    g.farmIds.add(r.farmerId);
    if (g.notes.length < ADVISORY_NOTES_PER_GROUP) g.notes.push({ id: r.id, note: r.note, observedOn: r.observedOn });
  }

  return [...groups.values()]
    .map(({ farmIds, ...g }) => ({ ...g, farms: farmIds.size }))
    .sort((a, b) => b.farms - a.farms || b.latest.localeCompare(a.latest));
}
