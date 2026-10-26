import { describe, expect, it } from "vitest";
import { ADVISORY_NOTES_PER_GROUP, groupAdvisory, type AdvisoryReport } from "./advisory";

const tomato = { id: 1, name: "Tomato" };
const pechay = { id: 2, name: "Pechay" };
let id = 0;
const report = (over: Partial<AdvisoryReport>): AdvisoryReport => ({
  id: ++id, type: "pest_disease", note: "seen", observedOn: "2026-10-20", severity: "low", pest: "aphids", farmerId: 1, cropType: tomato, ...over,
});

describe("groupAdvisory", () => {
  it("groups by crop and problem, counting distinct farms, reports and high-severity ones", () => {
    const groups = groupAdvisory([
      report({ farmerId: 1, severity: "high", observedOn: "2026-10-24" }),
      report({ farmerId: 1 }),
      report({ farmerId: 2 }),
      report({ farmerId: 3, pest: "whitefly" }),
      report({ farmerId: 3, cropType: pechay }),
      report({ farmerId: 4, type: "weather_impact", pest: null }),
    ]);

    expect(groups[0]).toMatchObject({ cropType: "Tomato", pest: "aphids", farms: 2, reports: 3, high: 1, latest: "2026-10-24" });
    expect(groups).toHaveLength(4);
    expect(groups.find((g) => g.type === "weather_impact")).toMatchObject({ pest: null, farms: 1 });
  });

  it("puts problems seen on more farms first, then more high-severity, then the most recent", () => {
    const groups = groupAdvisory([
      report({ pest: "thrips", observedOn: "2026-10-25" }),
      report({ pest: "armyworm", severity: "high", observedOn: "2026-10-01" }),
      report({ pest: "cutworm", farmerId: 1 }),
      report({ pest: "cutworm", farmerId: 2 }),
    ]);
    expect(groups.map((g) => g.pest)).toEqual(["cutworm", "armyworm", "thrips"]);
  });

  it("keeps only the newest notes, and never says which farm reported them", () => {
    const groups = groupAdvisory(Array.from({ length: 8 }, (_, i) => report({ observedOn: `2026-10-${10 + i}`, farmerId: i })));
    expect(groups[0].notes).toHaveLength(ADVISORY_NOTES_PER_GROUP);
    expect(groups[0].notes[0].observedOn).toBe("2026-10-17");
    expect(JSON.stringify(groups)).not.toContain("farmerId");
  });
});
