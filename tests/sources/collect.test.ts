import { afterEach, describe, expect, it, vi } from "vitest";
import type { TripBrief } from "@/features/trips/domain/trip";
import { collectTripSources } from "@/features/trips/sources";

const brief: TripBrief = {
  mode: "known-destination",
  origin: "GVA",
  destination: "ZRH",
  startDate: "2026-09-14",
  endDate: "2026-09-18",
  travelers: [{ id: "adult-1", name: "Adult", age: 35, eligibility: ["adult"] }],
  interests: ["art"],
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("collectTripSources", () => {
  it("keeps successful provider data when another provider times out", async () => {
    vi.stubEnv("AMADEUS_CLIENT_ID", "amadeus-id");
    vi.stubEnv("AMADEUS_CLIENT_SECRET", "amadeus-secret");
    vi.stubEnv("TICTACTRIP_API_TOKEN", "tictactrip-token");
    vi.spyOn(globalThis, "fetch").mockImplementation(successfulAmadeusAndHangingTictactrip);

    const snapshot = await collectTripSources(brief, { timeoutMs: 5 });

    expect(snapshot.transport).toHaveLength(1);
    expect(snapshot.transport[0]).toMatchObject({ id: "amadeus-flight-flight-1" });
    expect(snapshot.providers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "amadeus", status: "live" }),
      expect.objectContaining({ id: "tictactrip", status: "failed", message: "Source provider timed out" }),
    ]));
    expect(snapshot.checkedAt).toEqual(expect.any(String));
    expect(hangingTictactripSignal?.aborted).toBe(true);
  });

  it("returns explicit unavailable statuses without credentials", async () => {
    vi.stubEnv("AMADEUS_CLIENT_ID", "");
    vi.stubEnv("AMADEUS_CLIENT_SECRET", "");
    vi.stubEnv("TICTACTRIP_API_TOKEN", "");
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    vi.stubEnv("FOURSQUARE_API_KEY", "");
    const fetch = vi.spyOn(globalThis, "fetch");

    const snapshot = await collectTripSources(brief);

    expect(snapshot).toMatchObject({ transport: [], stays: [], places: [], localTransport: [] });
    expect(snapshot.providers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "amadeus", status: "unavailable" }),
      expect.objectContaining({ id: "tictactrip", status: "unavailable" }),
      expect.objectContaining({ id: "places", status: "unavailable" }),
    ]));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("selects the cheapest eligible normalized transport after collection", async () => {
    vi.stubEnv("AMADEUS_CLIENT_ID", "amadeus-id");
    vi.stubEnv("AMADEUS_CLIENT_SECRET", "amadeus-secret");
    vi.stubEnv("TICTACTRIP_API_TOKEN", "tictactrip-token");
    vi.spyOn(globalThis, "fetch").mockImplementation(successfulProviders);

    const snapshot = await collectTripSources(brief);

    expect(snapshot.transport).toEqual([expect.objectContaining({ id: "tictactrip-train-1", total: "20.00" })]);
  });
});

let hangingTictactripSignal: AbortSignal | undefined;

async function successfulAmadeusAndHangingTictactrip(url: string | URL, init?: RequestInit): Promise<Response> {
  if (String(url).includes("tictactrip")) {
    hangingTictactripSignal = init?.signal ?? undefined;
    return new Promise((_, reject) => {
      hangingTictactripSignal?.addEventListener("abort", () => reject(hangingTictactripSignal?.reason), { once: true });
    });
  }
  return amadeusResponse(url);
}

async function successfulProviders(url: string | URL): Promise<Response> {
  if (String(url).includes("stopClusters")) return json({ stopClusters: [{ gpuid: "stop-1", name: "Geneva" }] });
  if (String(url).includes("/v2/results")) {
    return json({ results: [{ id: "train-1", price: { total: "20.00", currency: "CHF" }, duration: 120, legs: [{ carrier: { name: "Rail" } }] }] });
  }
  return amadeusResponse(url);
}

async function amadeusResponse(url: string | URL): Promise<Response> {
  const value = String(url);
  if (value.includes("oauth2/token")) return json({ access_token: "token" });
  if (value.includes("flight-offers")) {
    return json({ data: [{ id: "flight-1", price: { total: "100.00", currency: "CHF" }, itineraries: [{ duration: "PT2H", segments: [{ carrierCode: "LX", departure: { iataCode: "GVA", at: "2026-09-14T08:00:00Z" }, arrival: { iataCode: "ZRH", at: "2026-09-14T10:00:00Z" } }] }] }], dictionaries: { carriers: { LX: "Swiss" } } });
  }
  if (value.includes("hotels/by-city")) return json({ data: [] });
  throw new Error(`Unexpected request: ${value}`);
}

function json(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
}
