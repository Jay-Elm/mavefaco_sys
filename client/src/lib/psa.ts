import { prisma } from "@/lib/prisma";
import catalogue from "@/lib/cropCatalogue.json";

/**
 * Outside market data from the Philippine Statistics Authority's OpenSTAT
 * database (openstat.psa.gov.ph, PX-Web API): monthly farmgate prices and
 * quarterly production volumes for Albay and the whole Bicol region
 * (Region V). Copied into MarketPrice / MarketProduction by a weekly job, so
 * pages read our own copy and never call PSA.
 *
 * Places and commodities are looked up by name from each table's metadata
 * on every run, since PSA numbers them differently from table to table.
 * PSA publishes about two months behind, marks missing figures "..", and
 * sometimes records a month it couldn't price as 0.00; both are skipped.
 */

export const PSA_API = "https://openstat.psa.gov.ph/PXWeb/api/v1/en/DB";
export const PSA_CREDIT = "Philippine Statistics Authority, OpenSTAT";
export const AREAS = ["albay", "bicol"] as const;
export type Area = (typeof AREAS)[number];

/**
 * Each crop type stores its PSA series (CropType.psaProductionTable /
 * psaProduction, psaPriceTable / psaPrice), filled from
 * src/lib/cropCatalogue.json; staff-added crops have none until set.
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** PSA indents names with dots ("....Albay", "..Pechay, native"). */
const clean = (s: string) => s.replace(/^\.+/, "").trim();

/** Which of our areas a PSA place name is, if either. */
export function areaOf(name: string): Area | null {
  const n = clean(name);
  if (/^albay$/i.test(n)) return "albay";
  if (/^region v\b.*bicol/i.test(n)) return "bicol";
  return null;
}

/** "58.61" → 58.61; "..", "", "0.00" → null (PSA's marks for no figure). */
export function psaNumber(raw: string): number | null {
  const v = raw.trim().replace(/^"|"$/g, "");
  if (v === "" || /^\.+$/.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Splits one CSV line, honouring quoted fields. */
export function csvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export interface PsaCell { commodity: string; area: Area; year: number; period: string; value: number }

/** 1–4 from "Quarter2" or "Quarter 2"; null otherwise. */
export const quarterOf = (period: string) => {
  const m = /^Quarter\s?([1-4])$/.exec(period.trim());
  return m ? Number(m[1]) : null;
};

const PERIOD = /^(January|February|March|April|May|June|July|August|September|October|November|December|Quarter\s?[1-4]|Semester\s?[12]|Annual)\b\s*/;

/**
 * PX-Web CSV. Most tables have two label columns (commodity and place) and
 * one column per "YEAR Period" ("2026 June", "2026 Quarter2"); some put the
 * commodity in the column heading instead ("2026 January Coconut matured")
 * with the place as the only label. Returns every number, either way.
 */
export function parsePsaCsv(text: string): PsaCell[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = csvLine(lines[0]);
  const labelCount = header.findIndex((h) => /^\d{4}\s/.test(h.trim()));
  if (labelCount < 1) return [];
  const cols = header.slice(labelCount).map((h) => {
    const m = /^(\d{4})\s+(.+)$/.exec(h.trim());
    if (!m) return null;
    const p = PERIOD.exec(m[2]);
    if (!p) return null;
    return { year: Number(m[1]), period: p[1], commodity: clean(m[2].slice(p[0].length)) };
  });
  const cells: PsaCell[] = [];
  for (const line of lines.slice(1)) {
    const f = csvLine(line);
    const labels = f.slice(0, labelCount);
    const areaLabel = labels.find((l) => areaOf(l) !== null);
    if (!areaLabel) continue;
    const area = areaOf(areaLabel)!;
    const rowCommodity = labels.filter((l) => l !== areaLabel).map(clean)[0] ?? "";
    f.slice(labelCount).forEach((raw, i) => {
      const col = cols[i];
      const value = psaNumber(raw);
      const commodity = col?.commodity || rowCommodity;
      if (col && value !== null && commodity) cells.push({ commodity, area, year: col.year, period: col.period, value });
    });
  }
  return cells;
}

type Fetch = typeof fetch;

/** Each PSA request gives up after this long (the whole run must fit in 60 s). */
export const PSA_TIMEOUT_MS = 15_000;

const describe = (table: string, what: string, err: unknown) => {
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError"))
    return `PSA ${table}: ${what} took over ${PSA_TIMEOUT_MS / 1000} s`;
  return `PSA ${table}: ${what} failed (${err instanceof Error ? err.message : String(err)})`;
};

interface PxVariable { code: string; text: string; values: string[]; valueTexts: string[] }

/** Builds the PX-Web query for these commodities, our two areas and the last `years` years. */
async function query(fetchImpl: Fetch, table: string, commodities: string[], periodFilter: (p: string) => boolean, years = 2) {
  let vars: PxVariable[];
  try {
    const meta = await fetchImpl(`${PSA_API}/${table}`, { cache: "no-store", signal: AbortSignal.timeout(PSA_TIMEOUT_MS) });
    if (!meta.ok) throw new Error(`HTTP ${meta.status}`);
    vars = ((await meta.json()) as { variables: PxVariable[] }).variables;
  } catch (err) {
    throw new Error(describe(table, "metadata", err));
  }
  const pick = (v: PxVariable, keep: (text: string) => boolean) => v.values.filter((_, i) => keep(v.valueTexts[i]));

  const selection = vars.map((v) => {
    const code = v.code.toLowerCase();
    let values: string[];
    if (code === "geolocation" || code.startsWith("region")) values = pick(v, (t) => areaOf(t) !== null);
    else if (code === "year") values = v.values.slice(-years);
    else if (code === "period") values = pick(v, periodFilter);
    // The commodity, whatever the table calls it (Commodity, Crop, Ecosystem/Croptype).
    else values = pick(v, (t) => commodities.includes(clean(t)));
    return { code: v.code, selection: { filter: "item", values } };
  });

  try {
    const res = await fetchImpl(`${PSA_API}/${table}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: selection, response: { format: "csv" } }),
      cache: "no-store",
      signal: AbortSignal.timeout(PSA_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parsePsaCsv(await res.text());
  } catch (err) {
    throw new Error(describe(table, "data", err));
  }
}

/** Saves farmgate prices in one statement (insert, or update the price). */
async function savePrices(rows: { cropTypeId: number; area: string; year: number; month: number; value: number }[]) {
  if (rows.length === 0) return;
  await prisma.$executeRaw`
    INSERT INTO "MarketPrice" ("cropTypeId", "area", "year", "month", "pricePerKg", "fetchedAt")
    SELECT * , now() FROM unnest(
      ${rows.map((r) => r.cropTypeId)}::int[], ${rows.map((r) => r.area)}::text[],
      ${rows.map((r) => r.year)}::int[], ${rows.map((r) => r.month)}::int[], ${rows.map((r) => r.value)}::float8[])
    ON CONFLICT ("cropTypeId", "area", "year", "month")
    DO UPDATE SET "pricePerKg" = EXCLUDED."pricePerKg", "fetchedAt" = now()`;
}

/** Saves production volumes in one statement. */
async function saveProduction(rows: { cropTypeId: number; area: string; year: number; quarter: number; value: number }[]) {
  if (rows.length === 0) return;
  await prisma.$executeRaw`
    INSERT INTO "MarketProduction" ("cropTypeId", "area", "year", "quarter", "tonnes", "fetchedAt")
    SELECT * , now() FROM unnest(
      ${rows.map((r) => r.cropTypeId)}::int[], ${rows.map((r) => r.area)}::text[],
      ${rows.map((r) => r.year)}::int[], ${rows.map((r) => r.quarter)}::int[], ${rows.map((r) => r.value)}::float8[])
    ON CONFLICT ("cropTypeId", "area", "year", "quarter")
    DO UPDATE SET "tonnes" = EXCLUDED."tonnes", "fetchedAt" = now()`;
}

type CatalogueCrop = (typeof catalogue)[number];
const seriesKeys = (c: { psaPriceTable: string | null; psaPrice: string | null; psaProductionTable: string | null; psaProduction: string | null }) =>
  [c.psaPrice && `${c.psaPriceTable}|${c.psaPrice}`, c.psaProduction && `${c.psaProductionTable}|${c.psaProduction}`].filter(Boolean) as string[];

/**
 * Puts back every crop from the catalogue (src/lib/cropCatalogue.json) that
 * is no longer in Crop Types, e.g. one staff deleted. Crops already there are
 * left exactly as staff edited them, and a catalogue crop that staff renamed
 * (another name, same PSA series) is not added a second time. Returns the
 * names added.
 */
export async function restoreCatalogueCrops(): Promise<string[]> {
  const existing = await prisma.cropType.findMany({
    select: { name: true, psaPriceTable: true, psaPrice: true, psaProductionTable: true, psaProduction: true },
  });
  const catalogueNames = new Set(catalogue.map((c) => c.name.toLowerCase()));
  const names = new Set(existing.map((c) => c.name.toLowerCase()));
  const renamed = new Set(existing.filter((c) => !catalogueNames.has(c.name.toLowerCase())).flatMap(seriesKeys));
  const missing = (catalogue as CatalogueCrop[]).filter(
    (c) => !names.has(c.name.toLowerCase()) && !seriesKeys(c).some((k) => renamed.has(k)),
  );
  if (missing.length === 0) return [];
  await prisma.cropType.createMany({
    data: missing.map((c) => ({
      name: c.name,
      category: c.category,
      aliases: c.aliases,
      daysToHarvestMin: c.days?.[0] ?? null,
      daysToHarvestMax: c.days?.[1] ?? null,
      source: c.source,
      psaProductionTable: c.psaProductionTable,
      psaProduction: c.psaProduction,
      psaPriceTable: c.psaPriceTable,
      psaPrice: c.psaPrice,
    })),
    skipDuplicates: true,
  });
  return missing.map((c) => c.name);
}

/**
 * Puts back missing catalogue crops, then fetches the last two years of
 * farmgate prices and production for every crop type with a PSA series, and
 * saves them. Returns how many figures were saved and which crops came back;
 * a table that fails is reported and the rest still saved. Tables are
 * fetched side by side.
 */
export async function syncPsaMarket(fetchImpl: Fetch = fetch) {
  const restored = await restoreCatalogueCrops();
  const crops = await prisma.cropType.findMany({
    select: { id: true, psaProductionTable: true, psaProduction: true, psaPriceTable: true, psaPrice: true },
  });
  const errors: string[] = [];
  let prices = 0;
  let production = 0;
  const fail = (err: unknown) => errors.push(err instanceof Error ? err.message : String(err));

  // table -> PSA name -> crop ids (two crops may share a series).
  const group = (pick: (c: (typeof crops)[number]) => [string | null, string | null]) => {
    const tables = new Map<string, Map<string, number[]>>();
    for (const c of crops) {
      const [table, name] = pick(c);
      if (!table || !name) continue;
      const names = tables.get(table) ?? tables.set(table, new Map()).get(table)!;
      names.set(name, [...(names.get(name) ?? []), c.id]);
    }
    return tables;
  };

  const priceJobs = [...group((c) => [c.psaPriceTable, c.psaPrice])].map(async ([table, names]) => {
    try {
      const cells = await query(fetchImpl, table, [...names.keys()], (p) => MONTHS.includes(p));
      const rows = cells.flatMap((cell) => {
        const month = MONTHS.indexOf(cell.period) + 1;
        return month < 1 ? [] : (names.get(cell.commodity) ?? []).map((cropTypeId) => ({ cropTypeId, area: cell.area, year: cell.year, month, value: cell.value }));
      });
      await savePrices(rows);
      prices += rows.length;
    } catch (err) {
      fail(err);
    }
  });

  const productionJobs = [...group((c) => [c.psaProductionTable, c.psaProduction])].map(async ([table, names]) => {
    try {
      const cells = await query(fetchImpl, table, [...names.keys()], (p) => quarterOf(p) !== null);
      const rows = cells.flatMap((cell) =>
        (names.get(cell.commodity) ?? []).map((cropTypeId) => ({ cropTypeId, area: cell.area, year: cell.year, quarter: quarterOf(cell.period)!, value: cell.value })),
      );
      await saveProduction(rows);
      production += rows.length;
    } catch (err) {
      fail(err);
    }
  });

  await Promise.all([...priceJobs, ...productionJobs]);
  return { prices, production, errors, restored };
}
