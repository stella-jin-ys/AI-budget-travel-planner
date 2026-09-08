import { afterEach, describe, expect, it, vi } from "vitest";
import type { TripBrief } from "@/features/trips/domain/trip";
import { searchTictactrip } from "@/features/trips/sources/tictactrip";

const brief: TripBrief = { mode: "known-destination", origin: "Geneva", destination: "Zurich", startDate: "2026-09-14", endDate: "2026-09-18", currency: "CHF", travelers: [{ id: "adult-1", name: "Adult", age: 35, eligibility: ["adult"] }, { id: "child-1", name: "Child", age: 8, eligibility: ["child"] }], interests: [] };

afterEach(() => vi.unstubAllEnvs());

describe("Tictactrip adapter", () => {
  it("resolves stop clusters and normalizes an itinerary", async () => {
    vi.stubEnv("TICTACTRIP_API_TOKEN", "tictactrip-token");
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      if (url.includes("Geneva")) return json({ stopClusters: [{ gpuid: "geneva-id", name: "Geneva Cornavin" }] });
      if (url.includes("Zurich")) return json({ stopClusters: [{ gpuid: "zurich-id", name: "Zurich HB" }] });
      return json({ results: [{ id: "trip-1", price: { total: "42.50", currency: "CHF" }, duration: 184, legs: [{ carrier: { name: "SBB" }, departure: { station: { name: "Geneva Cornavin" }, time: "2026-09-14T08:00:00Z" }, arrival: { station: { name: "Zurich HB" }, time: "2026-09-14T11:04:00Z" } }], bookingUrl: "https://book.example/trip-1" }] });
    };

    const [option] = await searchTictactrip(brief, fetcher);

    expect(requests).toHaveLength(3);
    expect(requests[0]).toMatchObject({ url: expect.stringContaining("/v2/stopClusters?"), init: { headers: { Authorization: "Bearer tictactrip-token" } } });
    expect(new URL(requests[0].url).searchParams.get("query")).toBe("Geneva");
    expect(new URL(requests[1].url).searchParams.get("query")).toBe("Zurich");
    expect(requests[2]).toMatchObject({ url: "https://api.tictactrip.eu/v2/results", init: { method: "POST", headers: { Authorization: "Bearer tictactrip-token" } } });
    expect(JSON.parse(String(requests[2].init?.body))).toEqual({ originGpuid: "geneva-id", destinationGpuid: "zurich-id", outboundDate: "2026-09-14T00:00:00Z", passengers: [{ age: 35 }, { age: 8 }] });
    expect(option).toMatchObject({ id: "tictactrip-trip-1", supplierName: "SBB", carrier: "SBB", total: "42.50", currency: "CHF", status: "live", departureAt: "2026-09-14T08:00:00Z", arrivalAt: "2026-09-14T11:04:00Z", durationMins: 184, transfers: 0, originName: "Geneva Cornavin", destinationName: "Zurich HB", sourceUrl: "https://book.example/trip-1" });
    expect(option.checkedAt).toEqual(expect.any(String));
  });

  it("does not call a provider when its token is absent", async () => {
    vi.stubEnv("TICTACTRIP_API_TOKEN", "");
    const fetcher = vi.fn();
    const result = await searchTictactrip(brief, fetcher);
    expect(result).toHaveLength(0);
    expect(result).toMatchObject({ status: "unavailable", reason: "Tictactrip credentials are not configured" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns a failed provider outcome when stop resolution throws", async () => {
    vi.stubEnv("TICTACTRIP_API_TOKEN", "tictactrip-token");

    const result = await searchTictactrip(brief, async () => { throw new Error("stop lookup failed"); });

    expect(result).toHaveLength(0);
    expect(result).toMatchObject({ status: "failed", reason: "stop lookup failed" });
  });
});

function json(value: unknown) { return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } }); }
