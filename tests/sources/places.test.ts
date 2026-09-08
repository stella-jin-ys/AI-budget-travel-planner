import { afterEach, describe, expect, it, vi } from "vitest";
import type { TripBrief } from "@/features/trips/domain/trip";
import { searchPlaces } from "@/features/trips/sources/places";

const brief: TripBrief = { mode: "known-destination", origin: "Geneva", destination: "Zurich", startDate: "2026-09-14", endDate: "2026-09-18", travelers: [{ id: "adult-1", name: "Adult", age: 35, eligibility: ["adult"] }], interests: ["art"] };

afterEach(() => vi.unstubAllEnvs());

describe("Places adapter", () => {
  it("returns an unavailable outcome without Places credentials", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    vi.stubEnv("FOURSQUARE_API_KEY", "");
    const fetcher = vi.fn();

    const result = await searchPlaces(brief, fetcher);

    expect(result).toHaveLength(0);
    expect(result).toMatchObject({ provider: "places", status: "unavailable", reason: "Places credentials are not configured" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("queries Google Places for food and attractions and preserves useful place details", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "google-key");
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      const query = JSON.parse(String(init?.body)).textQuery;
      return json({ places: [{ id: query.startsWith("restaurants") ? "food-1" : "art-1", displayName: { text: query.startsWith("restaurants") ? "Alpine Bistro" : "Kunsthaus Zurich" }, formattedAddress: "Museumstrasse 2, Zurich", websiteUri: "https://place.example", googleMapsUri: "https://maps.example", rating: 4.7, primaryTypeDisplayName: { text: query.startsWith("restaurants") ? "Restaurant" : "Museum" }, distanceMeters: 250 }] });
    };

    const options = await searchPlaces(brief, fetcher);

    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({ url: "https://places.googleapis.com/v1/places:searchText", init: { method: "POST", headers: { "X-Goog-Api-Key": "google-key", "X-Goog-FieldMask": expect.stringContaining("places.websiteUri") } } });
    expect(JSON.parse(String(requests[0].init?.body))).toMatchObject({ textQuery: "restaurants and supermarkets in Zurich" });
    expect(JSON.parse(String(requests[1].init?.body))).toMatchObject({ textQuery: "art attractions in Zurich" });
    expect(options).toEqual(expect.arrayContaining([expect.objectContaining({ id: "google-places-food-1", supplierName: "Alpine Bistro", category: "Restaurant", sourceUrl: "https://place.example", mapsUrl: "https://maps.example", address: "Museumstrasse 2, Zurich", rating: 4.7, distanceMeters: 250, status: "live" }), expect.objectContaining({ id: "google-places-art-1", supplierName: "Kunsthaus Zurich", category: "Museum" })]));
    expect(options[0].checkedAt).toEqual(expect.any(String));
  });

  it("uses Foursquare when Google is unavailable", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    vi.stubEnv("FOURSQUARE_API_KEY", "foursquare-key");
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      return json({ results: [{ fsq_place_id: "fsq-1", name: "Corner Market", location: { formatted_address: "Marketplatz 1, Zurich" }, website: "https://market.example", link: "https://maps.example/market", rating: 8.6, distance: 120, categories: [{ name: "Supermarket" }] }] });
    };

    const options = await searchPlaces(brief, fetcher);

    expect(requests).toHaveLength(2);
    expect(new URL(requests[0].url).searchParams).toMatchObject({});
    expect(new URL(requests[0].url).searchParams.get("near")).toBe("Zurich");
    expect(requests[0].init).toMatchObject({ method: "GET", headers: { Authorization: "foursquare-key" } });
    expect(options).toEqual(expect.arrayContaining([expect.objectContaining({ id: "foursquare-fsq-1", supplierName: "Corner Market", category: "Supermarket", sourceUrl: "https://market.example", mapsUrl: "https://maps.example/market", address: "Marketplatz 1, Zurich", rating: 8.6, distanceMeters: 120 })]));
  });

  it("returns a failed provider outcome when Google response JSON is invalid", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "google-key");

    const result = await searchPlaces(brief, async () => ({ ok: true, json: async () => { throw new Error("invalid Google JSON"); } }) as Response);

    expect(result).toHaveLength(0);
    expect(result).toMatchObject({ status: "failed", reason: "invalid Google JSON" });
  });
});

function json(value: unknown) { return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } }); }
