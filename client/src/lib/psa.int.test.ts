import { afterEach, describe, expect, it, vi } from "vitest";
import { restoreCatalogueCrops, syncPsaMarket } from "./psa";
import catalogue from "./cropCatalogue.json";
import { GET as cronRoute } from "@/app/api/cron/psa-market/route";
import { POST as staffSync } from "@/app/api/admin/market/psa/route";
import { GET as market } from "@/app/api/market/route";
import { GET as reference } from "@/app/api/market/reference/route";
import { prisma } from "@/lib/prisma";
import { createCropType, createUser, request } from "@/test-utils/integration/helpers";

/** A crop with the PSA series the fake PSA below serves. */
const SERIES: Record<string, { psaPriceTable: string; psaPrice: string; psaProductionTable: string; psaProduction: string }> = {
  Tomato: { psaPriceTable: "2M/NFG/0032M4AFN05.px", psaPrice: "Tomato", psaProductionTable: "2E/CS/0082E4EVCP3.px", psaProduction: "Tomato" },
  Eggplant: { psaPriceTable: "2M/NFG/0032M4AFN05.px", psaPrice: "Eggplant, long, purple", psaProductionTable: "2E/CS/0082E4EVCP3.px", psaProduction: "Eggplant" },
};
async function psaCrop(name: string) {
  const crop = await createCropType({ name });
  return SERIES[name] ? prisma.cropType.update({ where: { id: crop.id }, data: SERIES[name] }) : crop;
}

/** A stand-in for PSA OpenSTAT: metadata on GET, CSV on POST, per table. */
function fakePsa({ failTable }: { failTable?: string } = {}) {
  const geo = { code: "Geolocation", text: "Geolocation", values: ["0", "41", "42", "43"], valueTexts: ["PHILIPPINES", "..REGION V (BICOL REGION)", "....Albay", "....Camarines Norte"] };
  const years = { code: "Year", text: "Year", values: ["15", "16"], valueTexts: ["2025", "2026"] };
  const calls: { url: string; body?: unknown }[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (failTable && u.includes(failTable)) return new Response("busy", { status: 503 });
    const production = u.includes("0082E4EVCP3");
    if (!init?.method || init.method === "GET") {
      return Response.json({
        variables: production
          ? [{ code: "Crop", text: "Crop", values: ["6", "13"], valueTexts: ["Eggplant", "Tomato"] }, geo, years, { code: "Period", text: "Period", values: ["0", "1", "2"], valueTexts: ["Quarter1", "Quarter2", "Semester1"] }]
          : [geo, { code: "Commodity", text: "Commodity", values: ["4", "13"], valueTexts: ["Eggplant, long, purple", "Tomato"] }, years, { code: "Period", text: "Period", values: ["4", "5", "12"], valueTexts: ["May", "June", "Annual"] }],
      });
    }
    if (production)
      return new Response(['"Crop","Geolocation","2026 Quarter1","2026 Quarter2"', '"Eggplant","....Albay",830.49,1285.77', '"Eggplant","..REGION V (BICOL REGION)",1131.88,..'].join("\n"));
    if (u.includes("0032M4AFN05"))
      return new Response(['"Geolocation","Commodity","2026 May","2026 June"', '"..REGION V (BICOL REGION)","Tomato",40.00,42.50', '"....Albay","Tomato",0.00,45.10', '"....Albay","Eggplant, long, purple",60.00,..'].join("\n"));
    return new Response('"Geolocation","Commodity"\n');
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

afterEach(() => vi.unstubAllGlobals());

describe("syncPsaMarket", () => {
  it("saves Albay and Bicol farmgate prices and production, skipping missing figures", async () => {
    const tomato = await psaCrop("Tomato");
    const eggplant = await psaCrop("Eggplant");
    await createCropType({ name: "Other vegetable" }); // no PSA series: never asked for
    const psa = fakePsa();

    const result = await syncPsaMarket(psa.impl);
    expect(result).toMatchObject({ prices: 4, production: 3, errors: [] });

    const prices = await prisma.marketPrice.findMany({ orderBy: [{ cropTypeId: "asc" }, { area: "asc" }, { month: "asc" }] });
    expect(prices.map((p) => [p.cropTypeId, p.area, p.month, p.pricePerKg])).toEqual([
      [tomato.id, "albay", 6, 45.1], // May's 0.00 skipped
      [tomato.id, "bicol", 5, 40],
      [tomato.id, "bicol", 6, 42.5],
      [eggplant.id, "albay", 5, 60],
    ]);
    expect(await prisma.marketProduction.count({ where: { cropTypeId: eggplant.id, area: "albay" } })).toBe(2);

    // The query asked only for our places, crops and months (not Annual).
    const post = psa.calls.find((c) => c.body && c.url.includes("0032M4AFN05"))!.body as { query: { code: string; selection: { values: string[] } }[] };
    const sel = Object.fromEntries(post.query.map((q) => [q.code, q.selection.values]));
    expect(sel.Geolocation).toEqual(["41", "42"]);
    expect(sel.Commodity).toEqual(["4", "13"]);
    expect(sel.Period).toEqual(["4", "5"]);

    // Running again updates in place.
    await syncPsaMarket(psa.impl);
    expect(await prisma.marketPrice.count()).toBe(4);
  });

  it("keeps what arrived when one PSA table fails", async () => {
    await psaCrop("Tomato");
    await psaCrop("Eggplant");
    const result = await syncPsaMarket(fakePsa({ failTable: "0082E4EVCP3" }).impl);
    expect(result.prices).toBe(4);
    expect(result.production).toBe(0);
    expect(result.errors[0]).toMatch(/0082E4EVCP3/);
  });
});

describe("restoreCatalogueCrops", () => {
  it("puts back deleted catalogue crops and leaves staff edits alone", async () => {
    // First run fills an empty table with the whole catalogue.
    expect(await restoreCatalogueCrops()).toHaveLength(catalogue.length);
    expect(await prisma.cropType.count()).toBe(catalogue.length);
    expect(await prisma.cropType.findUnique({ where: { name: "Garlic" } })).toMatchObject({ category: "Herbs and spices", psaPrice: "Garlic, dried bulb" });

    // Staff delete Ampalaya and change Eggplant's growing time.
    await prisma.cropType.delete({ where: { name: "Ampalaya" } });
    await prisma.cropType.update({ where: { name: "Eggplant" }, data: { daysToHarvestMin: 70, daysToHarvestMax: 80, source: "Our farmers" } });

    expect(await restoreCatalogueCrops()).toEqual(["Ampalaya"]);
    expect(await prisma.cropType.findUnique({ where: { name: "Ampalaya" } })).toMatchObject({ daysToHarvestMin: 60, daysToHarvestMax: 75, psaProduction: "Ampalaya fruit [Bitter gourd]" });
    expect(await prisma.cropType.findUnique({ where: { name: "Eggplant" } })).toMatchObject({ daysToHarvestMin: 70, source: "Our farmers" });
    expect(await restoreCatalogueCrops()).toEqual([]);
  });

  it("does not add a crop again after staff renamed it", async () => {
    await restoreCatalogueCrops();
    await prisma.cropType.update({ where: { name: "Tomato" }, data: { name: "Kamatis" } });
    await prisma.cropType.update({ where: { name: "Garlic" }, data: { name: "Bawang (Garlic)" } });
    expect(await restoreCatalogueCrops()).toEqual([]);
    expect(await prisma.cropType.count({ where: { name: { in: ["Tomato", "Garlic"] } } })).toBe(0);
  });

  it("the PSA update reports the crops it put back", async () => {
    await restoreCatalogueCrops();
    await prisma.cropType.delete({ where: { name: "Ampalaya" } });
    vi.stubGlobal("fetch", fakePsa().impl);
    const res = await staffSync(request("/api/admin/market/psa", { method: "POST", as: await createUser({ role: "manager" }) }));
    expect((await res.json()).restored).toEqual(["Ampalaya"]);
  });
});

describe("PSA routes", () => {
  it("the weekly job needs the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await cronRoute(request("/api/cron/psa-market"))).status).toBe(401);
    vi.stubGlobal("fetch", fakePsa().impl);
    const res = await cronRoute(request("/api/cron/psa-market", { headers: { authorization: "Bearer s3cret" } }));
    expect(res.status).toBe(200);
    vi.unstubAllEnvs();
  });

  it("staff can fetch now; farmers and customers can't", async () => {
    vi.stubGlobal("fetch", fakePsa().impl);
    await psaCrop("Tomato");
    for (const role of ["customer", "farmer"] as const)
      expect((await staffSync(request("/api/admin/market/psa", { method: "POST", as: await createUser({ role }) }))).status).toBe(403);
    for (const role of ["manager", "admin"] as const)
      expect((await staffSync(request("/api/admin/market/psa", { method: "POST", as: await createUser({ role }) }))).status).toBe(200);
  });

  it("the Market data and the price reference carry the PSA figures", async () => {
    const tomato = await psaCrop("Tomato");
    await prisma.marketPrice.createMany({
      data: [
        { cropTypeId: tomato.id, area: "albay", year: 2026, month: 5, pricePerKg: 44 },
        { cropTypeId: tomato.id, area: "albay", year: 2026, month: 6, pricePerKg: 45.1 },
        { cropTypeId: tomato.id, area: "bicol", year: 2026, month: 6, pricePerKg: 42.5 },
      ],
    });
    const farmer = await createUser({ role: "farmer" });

    const body = await (await market(request("/api/market", { as: farmer }))).json();
    const row = body.rows.find((r: { crop: { id: number } }) => r.crop.id === tomato.id);
    expect(row.psa.latest).toEqual({ albay: { month: "2026-06", pricePerKg: 45.1 }, bicol: { month: "2026-06", pricePerKg: 42.5 } });
    expect(body.psa.latestMonth).toBe("2026-06");

    const ref = await (await reference(request(`/api/market/reference?cropTypeId=${tomato.id}`, { as: farmer }))).json();
    expect(ref).toMatchObject({ crop: { name: "Tomato" }, albay: { pricePerKg: 45.1 }, bicol: { pricePerKg: 42.5 } });
    expect((await reference(request(`/api/market/reference?cropTypeId=${tomato.id}`, { as: await createUser() }))).status).toBe(403);
  });
});
