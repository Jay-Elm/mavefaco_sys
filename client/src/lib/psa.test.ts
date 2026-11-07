import { describe, expect, it } from "vitest";
import { areaOf, csvLine, parsePsaCsv, psaNumber } from "./psa";

describe("PSA parsing", () => {
  it("knows Albay and the Bicol region by their PSA names", () => {
    expect(areaOf("....Albay")).toBe("albay");
    expect(areaOf("..REGION V (BICOL REGION)")).toBe("bicol");
    expect(areaOf("....Camarines Sur")).toBeNull();
    expect(areaOf("..REGION VI (WESTERN VISAYAS)")).toBeNull();
  });

  it("treats '..', blanks and 0.00 as no figure", () => {
    expect(psaNumber("58.61")).toBe(58.61);
    expect(psaNumber("..")).toBeNull();
    expect(psaNumber("")).toBeNull();
    expect(psaNumber("0.00")).toBeNull();
  });

  it("splits quoted CSV fields, commas and quotes inside", () => {
    expect(csvLine('"Okra [Lady\'s finger]","....Albay",1.5,..')).toEqual(["Okra [Lady's finger]", "....Albay", "1.5", ".."]);
    expect(csvLine('"Patola, Native","a ""b""",2')).toEqual(["Patola, Native", 'a "b"', "2"]);
  });

  it("reads monthly prices in commodity-then-place order", () => {
    const csv = [
      '﻿"Geolocation","Commodity","2026 May","2026 June","2026 July"',
      '"..REGION V (BICOL REGION)","Tomato",40.00,42.50,..',
      '"....Albay","Tomato",0.00,45.10,..',
      '"....Sorsogon","Tomato",30.00,31.00,..',
    ].join("\r\n");
    expect(parsePsaCsv(csv)).toEqual([
      { commodity: "Tomato", area: "bicol", year: 2026, period: "May", value: 40 },
      { commodity: "Tomato", area: "bicol", year: 2026, period: "June", value: 42.5 },
      { commodity: "Tomato", area: "albay", year: 2026, period: "June", value: 45.1 },
    ]);
  });

  it("reads quarterly production with the crop first and dotted names", () => {
    const csv = ['"Crop","Geolocation","2026 Quarter1","2026 Quarter2"', '"..Pechay, native","....Albay",590.32,1420.16'].join("\n");
    expect(parsePsaCsv(csv)).toEqual([
      { commodity: "Pechay, native", area: "albay", year: 2026, period: "Quarter1", value: 590.32 },
      { commodity: "Pechay, native", area: "albay", year: 2026, period: "Quarter2", value: 1420.16 },
    ]);
  });
});
