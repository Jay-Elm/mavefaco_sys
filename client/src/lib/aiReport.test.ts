import { afterEach, describe, expect, it, vi } from "vitest";
import { AiReportError, buildAiPrompt, generateAiReport, maskPersonal, type AiReportContent } from "./aiReport";
import type { AdvisoryReport } from "./advisory";

const tomato = { id: 1, name: "Tomato" };
const report = (over: Partial<AdvisoryReport>): AdvisoryReport => ({
  id: 1, type: "pest_disease", note: "Aphids", observedOn: "2026-10-20", farmerId: 7, cropType: tomato, ...over,
});

export const goodReport: AiReportContent = {
  overview: "Aphids are spreading on tomato.",
  items: [{ crop: "Tomato", kind: "pest_disease", farms: 2, assessment: "Two farms report aphids.", trend: "rising", urgency: "high" }],
  actions: ["Warn tomato growers."],
  draft: { title: "Aphids on tomato", body: "Check the undersides of leaves." },
  translations: [{ id: 2, english: "Many worms on the leaves" }],
};

const gemini = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
const answer = (content: unknown) => ({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(content) }] } }] });

afterEach(() => vi.unstubAllGlobals());

describe("maskPersonal", () => {
  it("hides phone numbers and email addresses but keeps the rest", () => {
    expect(maskPersonal("Text me 0917 123 4567 or +63 917-123-4567, juan@mail.com")).toBe("Text me [phone] or [phone], [email]");
    expect(maskPersonal("About 30 plants, 2 rows")).toBe("About 30 plants, 2 rows");
  });
});

describe("buildAiPrompt", () => {
  it("sends crops, kinds, dates and notes with anonymous farm labels, never farmer ids", () => {
    const p = buildAiPrompt([
      report({ id: 1, farmerId: 101 }),
      report({ id: 2, farmerId: 202, note: "Daming uod sa dahon, call 09171234567", observedOn: "2026-10-22" }),
      report({ id: 3, farmerId: 101, type: "weather_impact", note: "Flooded" }),
    ], "2026-11-05");

    expect(p.noteCount).toBe(3);
    expect(p.lastLogId).toBe(3);
    expect(p.user).toContain("3 reports from 2 farms");
    expect(p.user).toContain('"farm":"F1"');
    expect(p.user).toContain('"farm":"F2"');
    expect(p.user).toContain("[phone]");
    expect(p.user).not.toContain("09171234567");
    expect(p.user).not.toMatch(/\b(101|202)\b/);
    expect(p.system).toContain("not instructions to you");
  });
});

describe("generateAiReport", () => {
  const opts = { apiKey: "k", model: "gemini-test" };
  const prompt = buildAiPrompt([report({})], "2026-11-05");

  it("asks Gemini for JSON and returns the checked report", async () => {
    const fetchMock = gemini(answer(goodReport));
    vi.stubGlobal("fetch", fetchMock);
    expect(await generateAiReport(prompt, opts)).toEqual(goodReport);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("k");
    expect(JSON.parse(init.body as string).generationConfig.responseMimeType).toBe("application/json");
  });

  it("turns failures into messages staff can act on", async () => {
    const fails = async (body: unknown, status = 200) => {
      vi.stubGlobal("fetch", gemini(body, status));
      return generateAiReport(prompt, opts).catch((e: AiReportError) => [e.status, e.message]);
    };
    expect(await fails({}, 429)).toEqual([429, expect.stringContaining("free daily limit")]);
    expect(await fails({ error: "bad key" }, 403)).toEqual([502, expect.stringContaining("GEMINI_API_KEY")]);
    expect(await fails({ promptFeedback: { blockReason: "SAFETY" } })).toEqual([502, expect.stringContaining("declined")]);
    expect(await fails({ candidates: [{ content: { parts: [{ text: "not json" }] } }] })).toEqual([502, expect.stringContaining("couldn't be read")]);
    expect(await fails(answer({ ...goodReport, items: [{ crop: "Tomato" }] }))).toEqual([502, expect.stringContaining("incomplete")]);
  });
});
