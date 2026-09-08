import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { maxDuration, POST } from "@/app/api/plan/route";

const { collectTripSourcesMock } = vi.hoisted(() => ({ collectTripSourcesMock: vi.fn() }));

vi.mock("@/features/trips/sources/collect", () => ({
  collectTripSources: collectTripSourcesMock,
}));

const supabaseInsert = vi.fn().mockResolvedValue({ error: null });
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: vi.fn(() => ({ insert: supabaseInsert })) })),
}));

function tripRequest() {
  return new Request("http://localhost/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: "Lund",
      destination: "France",
      startDate: "2027-02-20",
      endDate: "2027-02-27",
      travelers: [{ id: "adult-1", name: "Adult", age: 35, eligibility: ["adult"] }],
      interests: ["activities"],
      currency: "SEK",
      budget: { amount: "12000.00", currency: "SEK" },
      spendingPreference: "activities",
    }),
  });
}

function sourceSnapshot() {
  return {
    brief: {},
    checkedAt: "2026-09-08T10:00:00.000Z",
    providers: [
      { id: "amadeus", status: "recent" },
      { id: "tictactrip", status: "unavailable", message: "Tictactrip credentials are not configured" },
    ],
    transport: [{
      id: "sncf",
      kind: "transport",
      supplierName: "SNCF Connect",
      currency: "SEK",
      total: "2450.00",
      sourceUrl: "https://www.sncf-connect.com/",
      checkedAt: "2026-09-08T10:00:00.000Z",
      status: "recent",
      travelerIds: ["adult-1"],
    }],
    stays: [],
    places: [],
    localTransport: [],
  };
}

function groundedPlan() {
  return {
    title: "Lund to Paris travel plan",
    currency: "SEK",
    items: [{
      id: "train",
      section: "travel",
      label: "Lund to Paris rail journey",
      required: true,
      selectedAlternativeId: "sncf",
      connectionFeasible: true,
      alternatives: [{
        id: "sncf",
        label: "Train via Copenhagen and Hamburg",
        category: "transport",
        travelerCosts: { "adult-1": { amount: "2450.00", currency: "SEK" } },
        covered: false,
        optional: false,
        evidence: {
          status: "recent",
          supplierName: "SNCF Connect",
          checkedAt: "2026-09-02T10:00:00.000Z",
          sourceUrl: "https://www.sncf-connect.com/",
          reason: "Search-grounded indicative fare",
          synthetic: false,
        },
        details: [
          { label: "Departure", value: "Lund Central 07:15" },
          { label: "Arrival", value: "Paris Gare du Nord 21:05" },
        ],
        links: [{ label: "Book with SNCF Connect", url: "https://www.sncf-connect.com/" }],
      }],
    }],
    days: [{
      id: "day-1",
      date: "2027-02-20",
      title: "Travel to Paris",
      items: [
        { id: "depart", planItemId: "train", label: "Depart Lund Central", startsAt: "2027-02-20T07:15", endsAt: "2027-02-20T07:30" },
        { id: "arrive", planItemId: "train", label: "Arrive Paris Gare du Nord", startsAt: "2027-02-20T21:05", endsAt: "2027-02-20T21:20" },
      ],
    }],
    completeSections: ["overview", "travel", "stay", "days", "food", "budget"],
    contingencyRate: "0.10",
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.AI_PROVIDER;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  supabaseInsert.mockReset();
  supabaseInsert.mockResolvedValue({ error: null });
  collectTripSourcesMock.mockReset();
});

beforeEach(() => {
  collectTripSourcesMock.mockResolvedValue(sourceSnapshot());
});

describe("POST /api/plan", () => {
  it("allows enough time for a free-model response on Vercel", () => {
    expect(maxDuration).toBe(300);
  });

  it("makes one Gemini request without falling back to another provider", async () => {
    process.env.GEMINI_API_KEY = "gemini-test-key";
    process.env.OPENROUTER_API_KEY = "openrouter-test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: { message: "Provider unavailable" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(tripRequest());

    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent");
  });

  it("makes one capability-filtered OpenRouter free-router request when Gemini is not configured", async () => {
    process.env.OPENROUTER_API_KEY = "openrouter-test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: "Provider rate limit reached" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(tripRequest());
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "AI model is overloaded. Try again later." });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(requestBody.model).toBe("openrouter/free");
    expect(requestBody.max_tokens).toBe(4500);
    expect(requestBody.provider).toEqual({ require_parameters: true });
    expect(requestBody.response_format).toEqual({
      type: "json_schema",
      json_schema: {
        name: "travel_plan",
        strict: true,
        schema: expect.objectContaining({
          type: "object",
          properties: expect.objectContaining({
            title: expect.objectContaining({ type: "string" }),
            items: expect.objectContaining({ type: "array" }),
            days: expect.objectContaining({ type: "array" }),
          }),
          required: expect.arrayContaining(["title", "currency", "items", "days", "completeSections", "contingencyRate"]),
        }),
      },
    });
  });

  it("uses configured OpenRouter as the single provider when Gemini is also configured", async () => {
    process.env.AI_PROVIDER = "openrouter";
    process.env.GEMINI_API_KEY = "gemini-test-key";
    process.env.OPENROUTER_API_KEY = "openrouter-test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: "Provider rate limit reached" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await POST(tripRequest());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://openrouter.ai/api/v1/chat/completions");
  });

  it("accepts the first complete plan when OpenRouter adds trailing text", async () => {
    process.env.OPENROUTER_API_KEY = "openrouter-test-key";
    const plan = { ...groundedPlan(), title: "Lund to Paris {family} plan" };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        model: "free-model",
        choices: [{ message: { content: `${JSON.stringify(plan)}\nCompleted. {"status":"done"}` } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(tripRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({
      plan: expect.objectContaining({ title: "Lund to Paris {family} plan" }),
    }));
  });

  it("retries malformed or empty OpenRouter content without parsing reasoning", async () => {
    process.env.OPENROUTER_API_KEY = "openrouter-test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: "", reasoning: '{"title":"draft"' } }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: JSON.stringify(groundedPlan()) } }] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(tripRequest());

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not heuristically repair malformed OpenRouter JSON", async () => {
    process.env.OPENROUTER_API_KEY = "openrouter-test-key";
    const malformedPlan = `${JSON.stringify(groundedPlan()).slice(0, -1)},}`;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: malformedPlan } }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: JSON.stringify(groundedPlan()) } }] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(tripRequest());

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("grounds Gemini generateContent in a collected source snapshot without exposing raw provider data", async () => {
    process.env.GEMINI_API_KEY = "gemini-test-key";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        modelVersion: "gemini-3.7-flash",
        candidates: [{ content: { parts: [{ text: JSON.stringify(groundedPlan()) }] } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(tripRequest());
    const result = await response.json();
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(collectTripSourcesMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent");
    expect(requestBody.contents).toEqual([{ role: "user", parts: [{ text: expect.any(String) }] }]);
    expect(requestBody.generationConfig).toEqual(expect.objectContaining({
      responseMimeType: "application/json",
      responseJsonSchema: expect.any(Object),
    }));
    const prompt = requestBody.contents[0].parts[0].text;
    expect(prompt).toContain("Lund");
    expect(prompt).toContain("2027-02-20");
    expect(prompt).toContain("adult-1");
    expect(prompt).toContain("activities");
    expect(prompt).toContain("12000.00");
    expect(prompt).toContain("sncf");
    expect(prompt).toContain("2450.00");
    expect(prompt).toContain("https://www.sncf-connect.com/");
    expect(prompt).toContain("tictactrip");
    expect(prompt).toContain("unavailable");
    expect(prompt).toContain("credentials are not configured");
    expect(result.plan.items[0].alternatives[0]).toEqual(expect.objectContaining({
      details: [{ label: "Departure", value: "Lund Central 07:15" }, { label: "Arrival", value: "Paris Gare du Nord 21:05" }],
      links: [{ label: "Book with SNCF Connect", url: "https://www.sncf-connect.com/" }],
    }));
    expect(result).not.toHaveProperty("raw");
    expect(result.providers).toEqual([
      { id: "amadeus", status: "recent" },
      { id: "tictactrip", status: "unavailable" },
    ]);
    expect(supabaseInsert).toHaveBeenCalledWith(expect.objectContaining({
      source_snapshot: expect.objectContaining({
        checkedAt: "2026-09-08T10:00:00.000Z",
        providers: expect.arrayContaining([expect.objectContaining({ id: "amadeus" })]),
      }),
    }));
  });

  it("retries a Gemini plan whose selected source ID is absent from the snapshot", async () => {
    process.env.GEMINI_API_KEY = "gemini-test-key";
    const ungroundedPlan = groundedPlan();
    ungroundedPlan.items[0].selectedAlternativeId = "unknown-source";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(ungroundedPlan) }] } }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(groundedPlan()) }] } }] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(tripRequest());

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(collectTripSourcesMock).toHaveBeenCalledTimes(1);
  });

  it("returns a valid AI plan when configured persistence fails", async () => {
    process.env.GEMINI_API_KEY = "gemini-test-key";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    supabaseInsert.mockResolvedValueOnce({ error: { message: "database unavailable" } });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        modelVersion: "gemini-3.7-flash",
        candidates: [{ content: { parts: [{ text: JSON.stringify(groundedPlan()) }] } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(tripRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({
      plan: expect.objectContaining({ title: "Lund to Paris travel plan" }),
      saved: false,
    }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a valid AI plan when Supabase persistence is not configured", async () => {
    process.env.GEMINI_API_KEY = "gemini-test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        modelVersion: "gemini-3.7-flash",
        candidates: [{ content: { parts: [{ text: JSON.stringify(groundedPlan()) }] } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(tripRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({
      plan: expect.objectContaining({ title: "Lund to Paris travel plan" }),
      saved: false,
    }));
  });

  it("identifies the missing trip fields before calling an AI provider", async () => {
    process.env.GEMINI_API_KEY = "gemini-test-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(new Request("http://localhost/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Please complete the trip brief: origin, start date, end date, and travelers.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
