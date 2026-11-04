import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { createCropType, createPlanting, createUser, request, type SessionUser } from "@/test-utils/integration/helpers";

const content = {
  overview: "Flooding hit ampalaya.",
  items: [{ crop: "Ampalaya", kind: "weather_impact", farms: 1, assessment: "Rows flooded.", trend: "new", urgency: "medium" }],
  actions: ["Check drainage with affected farms."],
  draft: { title: "Flooding on ampalaya", body: "Clear drainage canals." },
  translations: [{ id: 999_999, english: "not one of the notes" }],
};
const gemini = () =>
  vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(content) }] } }] }), { status: 200 }));

const get = (as?: SessionUser) => GET(request("/api/admin/advisory/report", { as }));
const post = (as?: SessionUser) => POST(request("/api/admin/advisory/report", { method: "POST", as }));

async function someReports() {
  const farmer = await createUser({ role: "farmer", name: "Juan Farmer" });
  const crop = await createCropType({ name: "Ampalaya" });
  const planting = await createPlanting(farmer.id, { cropTypeId: crop.id });
  return prisma.cropLog.create({ data: { plantingId: planting.id, type: "weather_impact", note: "Binaha ang mga hanay", observedOn: new Date() } });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AI crop report", () => {
  it("says it isn't set up without a Gemini key, and asks nothing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const fetchMock = gemini();
    vi.stubGlobal("fetch", fetchMock);
    const admin = await createUser({ role: "admin" });

    expect(await (await get(admin)).json()).toEqual({ enabled: false, report: null });
    expect((await post(admin)).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads the last 30 days of reports, saves and audits the result, then makes staff wait a minute", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = gemini();
    vi.stubGlobal("fetch", fetchMock);
    const manager = await createUser({ role: "manager", name: "Maria Manager" });

    expect((await post(manager)).status).toBe(400); // nothing reported yet

    const log = await someReports();
    const res = await post(manager);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.report).toMatchObject({ model: "gemini-3.5-flash-lite", reportCount: 1, createdBy: "Maria Manager", newer: 0 });
    expect(body.report.content.overview).toBe("Flooding hit ampalaya.");
    expect(body.report.content.translations).toEqual([]); // only notes that were sent

    const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    const text = JSON.stringify(sent);
    expect(text).toContain("Binaha ang mga hanay");
    expect(text).not.toContain("Juan Farmer");

    expect(await prisma.auditLog.findFirst({ where: { action: "GENERATE_AI_REPORT" } })).toMatchObject({ entityType: "AI_REPORT", userId: manager.id });
    expect((await post(manager)).status).toBe(429);

    // A report that comes in later is counted as new.
    await prisma.cropLog.create({ data: { plantingId: log.plantingId, type: "damage", note: "Wind", observedOn: new Date() } });
    expect((await (await get(manager)).json()).report.newer).toBe(1);
  });

  it("is for staff only", async () => {
    expect((await get()).status).toBe(401);
    expect((await post()).status).toBe(401);
    for (const role of ["customer", "farmer"] as const) {
      const user = await createUser({ role });
      expect((await get(user)).status).toBe(403);
      expect((await post(user)).status).toBe(403);
    }
  });
});
