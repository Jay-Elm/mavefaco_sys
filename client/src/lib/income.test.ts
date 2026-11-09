import { describe, expect, it } from "vitest";
import { bestAmount, estimateBasis, expectedIncomeTotal, incomeEstimate } from "./income";

const growing = { status: "growing", expectedYield: 120, actualYield: null };
const own = { listing: { id: 7, name: "Native tomatoes" }, pricePerKg: 60 };
const psa = { area: "albay" as const, month: "2026-09", pricePerKg: 42.5 };

describe("estimateBasis", () => {
  it("uses the expected yield while growing and the actual yield once harvested", () => {
    expect(estimateBasis(growing)).toEqual({ kg: 120, basis: "expected" });
    expect(estimateBasis({ status: "harvested", expectedYield: 120, actualYield: 95.5 })).toEqual({ kg: 95.5, basis: "actual" });
  });

  it("falls back to the expected yield for a harvest recorded without a yield", () => {
    expect(estimateBasis({ status: "harvested", expectedYield: 120, actualYield: null })).toEqual({ kg: 120, basis: "expected" });
  });

  it("has nothing to estimate for a failed planting or one without a yield", () => {
    expect(estimateBasis({ status: "failed", expectedYield: 120, actualYield: null })).toBeNull();
    expect(estimateBasis({ status: "growing", expectedYield: null, actualYield: null })).toBeNull();
    expect(estimateBasis({ status: "growing", expectedYield: 0, actualYield: null })).toBeNull();
  });
});

describe("incomeEstimate", () => {
  it("multiplies the kilos by each price known", () => {
    expect(incomeEstimate(growing, own, psa)).toEqual({
      kg: 120,
      basis: "expected",
      own: { listing: own.listing, pricePerKg: 60, amount: 7200 },
      psa: { area: "albay", month: "2026-09", pricePerKg: 42.5, amount: 5100 },
    });
  });

  it("rounds to the centavo", () => {
    expect(incomeEstimate({ ...growing, expectedYield: 3.333 }, null, psa)!.psa!.amount).toBe(141.65);
  });

  it("leaves out a price that is missing or zero", () => {
    expect(incomeEstimate(growing, null, psa)!.own).toBeNull();
    expect(incomeEstimate(growing, { ...own, pricePerKg: 0 }, null)).toMatchObject({ own: null, psa: null });
  });

  it("is null when there is no yield to price", () => {
    expect(incomeEstimate({ ...growing, expectedYield: null }, own, psa)).toBeNull();
  });
});

describe("totals", () => {
  it("prefers the farmer's own price and falls back to PSA's", () => {
    expect(bestAmount(incomeEstimate(growing, own, psa))).toBe(7200);
    expect(bestAmount(incomeEstimate(growing, null, psa))).toBe(5100);
    expect(bestAmount(incomeEstimate(growing, null, null))).toBeNull();
    expect(bestAmount(null)).toBeNull();
  });

  it("adds up growing plantings only and counts those it couldn't price", () => {
    const rows = [
      { status: "growing", income: incomeEstimate(growing, own, psa) }, // 7,200
      { status: "growing", income: incomeEstimate({ ...growing, expectedYield: 10 }, null, psa) }, // 425
      { status: "growing", income: null }, // no expected yield
      { status: "growing", income: incomeEstimate(growing, null, null) }, // no price
      { status: "harvested", income: incomeEstimate({ status: "harvested", expectedYield: 50, actualYield: 50 }, own, null) },
    ];
    expect(expectedIncomeTotal(rows)).toEqual({ total: 7625, counted: 2, missing: 2 });
    expect(expectedIncomeTotal([])).toEqual({ total: 0, counted: 0, missing: 0 });
  });
});
