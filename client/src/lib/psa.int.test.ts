import { afterEach, describe, expect, it, vi } from "vitest";
import { syncPsaMarket } from "./psa";
import { GET as cronRoute } from "@/app/api/cron/psa-market/route";
import { POST as staffSync } from "@/app/api/admin/market/psa/route";
import { GET as market } from "@/app/api/market/route";
import { GET as reference } from "@/app/api/market/reference/route";
import { prisma } from "@/lib/prisma";
import { createCropType, createUser, request } from "@/test-utils/integration/helpers";

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
    const tomato = await createCropType({ name: "Tomato" });
    const eggplant = await createCropType({ name: "Eggplant" });
    await createCropType({ name: "Other vegetable" }); // no PSA series: never asked for
    const psa = fakePsa();

    const result = await syncPsaMarket(psa.impl);
    expect(result).toEqual({ prices: 4, production: 3, errors: [] });

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
    await createCropType({ name: "Tomato" });
    await createCropType({ name: "Eggplant" });
    const result = await syncPsaMarket(fakePsa({ failTable: "0082E4EVCP3" }).impl);
    expect(result.prices).toBe(4);
    expect(result.production).toBe(0);
    expect(result.errors[0]).toMatch(/0082E4EVCP3/);
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
    await createCropType({ name: "Tomato" });
    for (const role of ["customer", "farmer"] as const)
      expect((await staffSync(request("/api/admin/market/psa", { method: "POST", as: await createUser({ role }) }))).status).toBe(403);
    for (const role of ["manager", "admin"] as const)
      expect((await staffSync(request("/api/admin/market/psa", { method: "POST", as: await createUser({ role }) }))).status).toBe(200);
  });

  it("the Market data and the price reference carry the PSA figures", async () => {
    const tomato = await createCropType({ name: "Tomato" });
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
