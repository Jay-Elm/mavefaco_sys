import { describe, expect, it } from "vitest";
import { ADVISORY_NOTES_PER_GROUP, groupAdvisory, type AdvisoryReport } from "./advisory";

const tomato = { id: 1, name: "Tomato" };
const pechay = { id: 2, name: "Pechay" };
let id = 0;
const report = (over: Partial<AdvisoryReport>): AdvisoryReport => ({
  id: ++id, type: "pest_disease", note: "seen", observedOn: "2026-10-20", farmerId: 1, cropType: tomato, ...over,
});

describe("groupAdvisory", () => {
  it("groups by crop and kind of problem, counting distinct farms and reports", () => {
    const groups = groupAdvisory([
      report({ farmerId: 1, observedOn: "2026-10-24" }),
      report({ farmerId: 1 }),
      report({ farmerId: 2 }),
      report({ farmerId: 3, cropType: pechay }),
      report({ farmerId: 4, type: "weather_impact" }),
    ]);

    expect(groups[0]).toMatchObject({ cropType: "Tomato", type: "pest_disease", farms: 2, reports: 3, latest: "2026-10-24" });
    expect(groups).toHaveLength(3);
    expect(groups.find((g) => g.type === "weather_impact")).toMatchObject({ cropType: "Tomato", farms: 1 });
  });

  it("puts problems seen on more farms first, then the most recent", () => {
    const groups = groupAdvisory([
      report({ type: "damage", observedOn: "2026-10-25" }),
      report({ type: "weather_impact", observedOn: "2026-10-01" }),
      report({ type: "pest_disease", farmerId: 1 }),
      report({ type: "pest_disease", farmerId: 2 }),
    ]);
    expect(groups.map((g) => g.type)).toEqual(["pest_disease", "damage", "weather_impact"]);
  });

  it("keeps only the newest notes, and never says which farm reported them", () => {
    const groups = groupAdvisory(Array.from({ length: 8 }, (_, i) => report({ observedOn: `2026-10-${10 + i}`, farmerId: i })));
    expect(groups[0].notes).toHaveLength(ADVISORY_NOTES_PER_GROUP);
    expect(groups[0].notes[0].observedOn).toBe("2026-10-17");
    expect(JSON.stringify(groups)).not.toContain("farmerId");
  });
});
