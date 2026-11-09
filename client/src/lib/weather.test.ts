import { describe, expect, it } from "vitest";
import { WEATHER_URL, dayLabel, describeWeather, isRainy, parseWeather, rainOutlook, type ForecastDay } from "./weather";

const sample = {
  current: { temperature_2m: 29.6, relative_humidity_2m: 78, wind_speed_10m: 11.4, weather_code: 2 },
  daily: {
    time: ["2026-11-09", "2026-11-10", "2026-11-11"],
    weather_code: [2, 61, 95],
    temperature_2m_max: [31.2, 29.5, 28.4],
    temperature_2m_min: [24.1, 23.8, 23.2],
    precipitation_probability_max: [20, 75, 90],
    precipitation_sum: [0, 8.26, 32.04],
  },
};

const day = (over: Partial<ForecastDay>): ForecastDay => ({
  date: "2026-11-10", code: 2, max: 30, min: 24, rainChance: 10, rainMm: 0, ...over,
});

describe("the Open-Meteo request", () => {
  it("asks for Tabaco City's current weather and a 7-day daily forecast in Philippine time", () => {
    expect(WEATHER_URL).toContain("latitude=13.3594");
    expect(WEATHER_URL).toContain("longitude=123.7331");
    expect(WEATHER_URL).toContain("forecast_days=7");
    expect(WEATHER_URL).toContain("daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum");
    expect(WEATHER_URL).toContain("timezone=Asia%2FManila");
  });
});

describe("parseWeather", () => {
  it("rounds the current conditions and reads each forecast day", () => {
    const w = parseWeather(sample);
    expect(w.current).toEqual({ temperature: 30, humidity: 78, windSpeed: 11, code: 2 });
    expect(w.days).toHaveLength(3);
    expect(w.days[2]).toEqual({ date: "2026-11-11", code: 95, max: 28, min: 23, rainChance: 90, rainMm: 32 });
  });

  it("skips days with missing figures and keeps an unknown rain chance as null", () => {
    const w = parseWeather({
      current: sample.current,
      daily: { ...sample.daily, temperature_2m_max: [31, null, 28], precipitation_probability_max: [null, 1, 2] },
    });
    expect(w.days.map((d) => d.date)).toEqual(["2026-11-09", "2026-11-11"]);
    expect(w.days[0].rainChance).toBeNull();
  });

  it("still gives the current weather when the forecast is missing", () => {
    expect(parseWeather({ current: sample.current }).days).toEqual([]);
  });

  it("refuses an answer without current conditions", () => {
    expect(() => parseWeather({ error: true, reason: "bad request" })).toThrow();
    expect(() => parseWeather(null)).toThrow();
  });
});

describe("describeWeather", () => {
  it("names the WMO weather codes", () => {
    expect(describeWeather(0)).toEqual({ label: "Clear sky", kind: "clear" });
    expect(describeWeather(3).kind).toBe("cloudy");
    expect(describeWeather(45).kind).toBe("fog");
    expect(describeWeather(63).kind).toBe("rain");
    expect(describeWeather(81).kind).toBe("showers");
    expect(describeWeather(96).kind).toBe("thunder");
  });
});

describe("rain ahead", () => {
  it("calls a day rainy from a 60% chance or 20 mm of rain", () => {
    expect(isRainy(day({ rainChance: 59, rainMm: 5 }))).toBe(false);
    expect(isRainy(day({ rainChance: 60 }))).toBe(true);
    expect(isRainy(day({ rainChance: null, rainMm: 20 }))).toBe(true);
  });

  it("labels today, tomorrow and later days by weekday", () => {
    expect(dayLabel("2026-11-09", "2026-11-09")).toBe("Today");
    expect(dayLabel("2026-11-10", "2026-11-09")).toBe("Tomorrow");
    expect(dayLabel("2026-11-11", "2026-11-09")).toBe("Wed");
    expect(dayLabel("2027-01-01", "2026-12-31")).toBe("Tomorrow");
  });

  it("names the rainy days and the heavy ones, or says nothing for a dry week", () => {
    expect(rainOutlook(parseWeather(sample).days, "2026-11-09")).toBe(
      "Rain likely: Tomorrow, Wed. Heavy rain (20 mm or more): Wed. Plan harvests and drying around it.",
    );
    expect(rainOutlook([day({ rainChance: 70, rainMm: 4 })], "2026-11-10")).toBe(
      "Rain likely: Today. Plan harvests and drying around it.",
    );
    expect(rainOutlook([day({}), day({ date: "2026-11-11" })], "2026-11-10")).toBeNull();
  });
});
