import { prisma } from "@/lib/prisma";

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

// Farmgate prices (new series), pesos per kilo.
const T = {
  legumes: "2M/NFG/0032M4AFN03.px",
  condiments: "2M/NFG/0032M4AFN04.px",
  fruitVeg: "2M/NFG/0032M4AFN05.px",
  leafyVeg: "2M/NFG/0032M4AFN06.px",
} as const;
// Vegetables and root crops: volume of production, metric tons.
const PRODUCTION_TABLE = "2E/CS/0082E4EVCP3.px";

/** Each crop type (by name) and its PSA series. */
export const PSA_SERIES: Record<string, { priceTable: string; price: string; production: string }> = {
  Ampalaya: { priceTable: T.fruitVeg, price: "Ampalaya fruit [Bitter gourd]", production: "Ampalaya fruit [Bitter gourd]" },
  Eggplant: { priceTable: T.fruitVeg, price: "Eggplant, long, purple", production: "Eggplant" },
  Kangkong: { priceTable: T.leafyVeg, price: "Kangkong [Swamp cabbage]", production: "Kangkong [Swamp cabbage]" },
  Lettuce: { priceTable: T.leafyVeg, price: "Lettuce", production: "Lettuce" },
  Mustasa: { priceTable: T.leafyVeg, price: "Mustard", production: "Mustard" },
  Okra: { priceTable: T.fruitVeg, price: "Okra [Lady's finger]", production: "Okra [Lady's finger]" },
  Patola: { priceTable: T.fruitVeg, price: "Patola, Native", production: "Patola" },
  Pechay: { priceTable: T.leafyVeg, price: "Pechay, native", production: "Pechay, native" },
  "Siling Labuyo": { priceTable: T.condiments, price: "Chili pepper fruit (Siling labuyo)", production: "Chili pepper fruit (Siling labuyo)" },
  Sitaw: { priceTable: T.legumes, price: "Sitao [Stringbeans]", production: "Sitao [Stringbeans]" },
  Squash: { priceTable: T.fruitVeg, price: "Squash fruit", production: "Squash fruit" },
  Tomato: { priceTable: T.fruitVeg, price: "Tomato", production: "Tomato" },
  Upo: { priceTable: T.fruitVeg, price: "Upo [Bottle gourd]", production: "Upo [Bottle gourd]" },
};

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

/**
 * PX-Web CSV with two label columns (commodity, place) and one column per
 * "YEAR Period" ("2026 June", "2026 Quarter2"). Returns every number, in
 * either label order.
 */
export function parsePsaCsv(text: string): PsaCell[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = csvLine(lines[0]);
  const cols = header.slice(2).map((h) => {
    const m = /^(\d{4})\s+(.+)$/.exec(h.trim());
    return m ? { year: Number(m[1]), period: m[2].trim() } : null;
  });
  const cells: PsaCell[] = [];
  for (const line of lines.slice(1)) {
    const f = csvLine(line);
    const [a, b] = [f[0], f[1]];
    const area = areaOf(b) ?? areaOf(a);
    if (!area) continue;
    const commodity = clean(areaOf(b) ? a : b);
    f.slice(2).forEach((raw, i) => {
      const col = cols[i];
      const value = psaNumber(raw);
      if (col && value !== null) cells.push({ commodity, area, year: col.year, period: col.period, value });
    });
  }
  return cells;
}

type Fetch = typeof fetch;

interface PxVariable { code: string; text: string; values: string[]; valueTexts: string[] }

/** Builds the PX-Web query for these commodities, our two areas and the last `years` years. */
async function query(fetchImpl: Fetch, table: string, commodities: string[], periodFilter: (p: string) => boolean, years = 2) {
  const meta = await fetchImpl(`${PSA_API}/${table}`, { cache: "no-store" });
  if (!meta.ok) throw new Error(`PSA ${table}: metadata ${meta.status}`);
  const vars = ((await meta.json()) as { variables: PxVariable[] }).variables;
  const pick = (v: PxVariable, keep: (text: string) => boolean) => v.values.filter((_, i) => keep(v.valueTexts[i]));

  const selection = vars.map((v) => {
    const code = v.code.toLowerCase();
    let values: string[];
    if (code === "commodity" || code === "crop") values = pick(v, (t) => commodities.includes(clean(t)));
    else if (code === "geolocation" || code.startsWith("region")) values = pick(v, (t) => areaOf(t) !== null);
    else if (code === "year") values = v.values.slice(-years);
    else if (code === "period") values = pick(v, periodFilter);
    else values = v.values;
    return { code: v.code, selection: { filter: "item", values } };
  });

  const res = await fetchImpl(`${PSA_API}/${table}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: selection, response: { format: "csv" } }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PSA ${table}: data ${res.status}`);
  return parsePsaCsv(await res.text());
}

/**
 * Fetches the last two years of farmgate prices and production for every
 * crop type with a PSA series, and saves them. Returns how many figures were
 * saved; a table that fails is reported and the rest still saved.
 */
export async function syncPsaMarket(fetchImpl: Fetch = fetch) {
  const crops = await prisma.cropType.findMany({ select: { id: true, name: true } });
  const known = crops.filter((c) => PSA_SERIES[c.name]);
  const errors: string[] = [];
  let prices = 0;
  let production = 0;

  const priceTables = [...new Set(known.map((c) => PSA_SERIES[c.name].priceTable))];
  for (const table of priceTables) {
    const inTable = known.filter((c) => PSA_SERIES[c.name].priceTable === table);
    try {
      const cells = await query(fetchImpl, table, inTable.map((c) => PSA_SERIES[c.name].price), (p) => MONTHS.includes(p));
      for (const cell of cells) {
        const crop = inTable.find((c) => PSA_SERIES[c.name].price === cell.commodity);
        const month = MONTHS.indexOf(cell.period) + 1;
        if (!crop || month < 1) continue;
        await prisma.marketPrice.upsert({
          where: { cropTypeId_area_year_month: { cropTypeId: crop.id, area: cell.area, year: cell.year, month } },
          create: { cropTypeId: crop.id, area: cell.area, year: cell.year, month, pricePerKg: cell.value },
          update: { pricePerKg: cell.value },
        });
        prices++;
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  try {
    const cells = await query(fetchImpl, PRODUCTION_TABLE, known.map((c) => PSA_SERIES[c.name].production), (p) => /^Quarter[1-4]$/.test(p));
    for (const cell of cells) {
      const crop = known.find((c) => PSA_SERIES[c.name].production === cell.commodity);
      const quarter = Number(cell.period.replace("Quarter", ""));
      if (!crop) continue;
      await prisma.marketProduction.upsert({
        where: { cropTypeId_area_year_quarter: { cropTypeId: crop.id, area: cell.area, year: cell.year, quarter } },
        create: { cropTypeId: crop.id, area: cell.area, year: cell.year, quarter, tonnes: cell.value },
        update: { tonnes: cell.value },
      });
      production++;
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return { prices, production, errors };
}
