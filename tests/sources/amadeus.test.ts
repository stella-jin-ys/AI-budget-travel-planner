import { afterEach, describe, expect, it, vi } from "vitest";
import type { TripBrief } from "@/features/trips/domain/trip";
import { searchAmadeusFlights, searchAmadeusHotels } from "@/features/trips/sources/amadeus";

const brief: TripBrief = {
  mode: "known-destination",
  origin: "GVA",
  destination: "ZRH",
  startDate: "2026-09-14",
  endDate: "2026-09-18",
  currency: "CHF",
  travelers: [
    { id: "adult-1", name: "Adult", age: 35, eligibility: ["adult"] },
    { id: "child-1", name: "Child", age: 8, eligibility: ["child", "family"] },
  ],
  interests: [],
};

afterEach(() => vi.unstubAllEnvs());

describe("Amadeus adapters", () => {
  it("requests an OAuth token and normalizes flight supplier and airport details", async () => {
    vi.stubEnv("AMADEUS_CLIENT_ID", "client-id");
    vi.stubEnv("AMADEUS_CLIENT_SECRET", "client-secret");
    vi.stubEnv("AMADEUS_BASE_URL", "https://amadeus.example");
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      if (url.endsWith("/token")) return json({ access_token: "secret-token" });
      return json({
        data: [{
          id: "offer-1",
          price: { total: "123.45", currency: "CHF" },
          itineraries: [{ duration: "PT1H15M", segments: [{
            departure: { iataCode: "GVA", at: "2026-09-14T08:00:00" },
            arrival: { iataCode: "ZRH", at: "2026-09-14T09:15:00" },
            carrierCode: "LX",
          }] }],
        }],
        dictionaries: { locations: { GVA: { detailedName: "Geneva Airport" }, ZRH: { detailedName: "Zurich Airport" } }, carriers: { LX: "Swiss International Air Lines" } },
      });
    };

    const [option] = await searchAmadeusFlights(brief, fetcher);

    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({ url: "https://amadeus.example/v1/security/oauth2/token", init: { method: "POST" } });
    expect(String(requests[0].init?.body)).toContain("grant_type=client_credentials");
    expect(String(requests[0].init?.body)).toContain("client_id=client-id");
    expect(requests[1]).toMatchObject({
      url: expect.stringContaining("/v2/shopping/flight-offers?"),
      init: { method: "GET", headers: { Authorization: "Bearer secret-token" } },
    });
    const flightUrl = new URL(requests[1].url);
    expect(Object.fromEntries(flightUrl.searchParams)).toMatchObject({
      originLocationCode: "GVA", destinationLocationCode: "ZRH", departureDate: "2026-09-14", returnDate: "2026-09-18", adults: "1", children: "1", travelClass: "ECONOMY", currencyCode: "CHF",
    });
    expect(option).toMatchObject({
      id: "amadeus-flight-offer-1", supplierName: "Swiss International Air Lines", total: "123.45", currency: "CHF", status: "live", travelerIds: ["adult-1", "child-1"], originName: "Geneva Airport", destinationName: "Zurich Airport", durationMins: 75,
    });
    expect(option.checkedAt).toEqual(expect.any(String));
  });

  it("returns an unavailable provider outcome when Amadeus credentials are absent", async () => {
    vi.stubEnv("AMADEUS_CLIENT_ID", "");
    vi.stubEnv("AMADEUS_CLIENT_SECRET", "");

    const result = await searchAmadeusFlights(brief, vi.fn());

    expect(result).toHaveLength(0);
    expect(result).toMatchObject({ status: "unavailable", reason: "Amadeus credentials are not configured" });
  });

  it("returns a failed provider outcome when an Amadeus request fails", async () => {
    vi.stubEnv("AMADEUS_CLIENT_ID", "client-id");
    vi.stubEnv("AMADEUS_CLIENT_SECRET", "client-secret");

    const result = await searchAmadeusFlights(brief, async () => {
      throw new Error("network unavailable");
    });

    expect(result).toHaveLength(0);
    expect(result).toMatchObject({ status: "failed", reason: "network unavailable" });
  });

  it("returns a failed provider outcome when Amadeus JSON is invalid", async () => {
    vi.stubEnv("AMADEUS_CLIENT_ID", "client-id");
    vi.stubEnv("AMADEUS_CLIENT_SECRET", "client-secret");

    const result = await searchAmadeusFlights(brief, async () => ({ ok: true, json: async () => { throw new Error("invalid JSON"); } }) as Response);

    expect(result).toHaveLength(0);
    expect(result).toMatchObject({ status: "failed", reason: "invalid JSON" });
  });

  it("returns a failed outcome for a non-OK Amadeus flight response", async () => {
    vi.stubEnv("AMADEUS_CLIENT_ID", "client-id");
    vi.stubEnv("AMADEUS_CLIENT_SECRET", "client-secret");
    let call = 0;

    const result = await searchAmadeusFlights(brief, async () => {
      call += 1;
      return call === 1 ? json({ access_token: "secret-token" }) : new Response(null, { status: 502 });
    });

    expect(result).toHaveLength(0);
    expect(result).toMatchObject({ status: "failed", reason: "Amadeus flight search failed (502)" });
  });

  it("returns an unavailable outcome when Amadeus flights have no price", async () => {
    vi.stubEnv("AMADEUS_CLIENT_ID", "client-id");
    vi.stubEnv("AMADEUS_CLIENT_SECRET", "client-secret");
    let call = 0;

    const result = await searchAmadeusFlights(brief, async () => {
      call += 1;
      return call === 1 ? json({ access_token: "secret-token" }) : json({ data: [{ id: "offer-without-price" }] });
    });

    expect(result).toHaveLength(0);
    expect(result).toMatchObject({ status: "unavailable", reason: "No priced Amadeus flight offers were returned" });
  });

  it("normalizes an Amadeus hotel offer with the requested stay dates and travelers", async () => {
    vi.stubEnv("AMADEUS_CLIENT_ID", "client-id");
    vi.stubEnv("AMADEUS_CLIENT_SECRET", "client-secret");
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      if (url.endsWith("/token")) return json({ access_token: "secret-token" });
      if (url.includes("/reference-data/locations/hotels/by-city")) return json({ data: [{ hotelId: "H1", name: "Lake View Hotel", cityCode: "ZRH" }] });
      return json({ data: [{ hotel: { hotelId: "H1", name: "Lake View Hotel", cityCode: "ZRH" }, offers: [{ id: "stay-1", room: { typeEstimated: { category: "DELUXE_ROOM" } }, price: { total: "800.00", currency: "CHF" } }] }] });
    };

    const [option] = await searchAmadeusHotels(brief, fetcher);

    expect(requests).toHaveLength(3);
    expect(new URL(requests[1].url).pathname).toBe("/v1/reference-data/locations/hotels/by-city");
    expect(new URL(requests[1].url).searchParams.get("cityCode")).toBe("ZRH");
    expect(requests[2].init).toMatchObject({ method: "GET", headers: { Authorization: "Bearer secret-token" } });
    const hotelUrl = new URL(requests[2].url);
    expect(hotelUrl.pathname).toBe("/v3/shopping/hotel-offers");
    expect(Object.fromEntries(hotelUrl.searchParams)).toMatchObject({ hotelIds: "H1", checkInDate: "2026-09-14", checkOutDate: "2026-09-18", adults: "1", roomQuantity: "1", currency: "CHF" });
    expect(option).toMatchObject({ id: "amadeus-hotel-H1-stay-1", supplierName: "Lake View Hotel", total: "800.00", currency: "CHF", status: "live", checkInAt: "2026-09-14", checkOutAt: "2026-09-18", nights: 4, hotelName: "Lake View Hotel", accommodationType: "DELUXE_ROOM" });
    expect(option.checkedAt).toEqual(expect.any(String));
  });

  it("returns an unavailable outcome when Amadeus hotel offers have no price", async () => {
    vi.stubEnv("AMADEUS_CLIENT_ID", "client-id");
    vi.stubEnv("AMADEUS_CLIENT_SECRET", "client-secret");
    let call = 0;
    const fetcher = async () => {
      call += 1;
      if (call === 1) return json({ access_token: "secret-token" });
      if (call === 2) return json({ data: [{ hotelId: "H1" }] });
      return json({ data: [{ hotel: { hotelId: "H1" }, offers: [{ id: "stay-without-price" }] }] });
    };

    const result = await searchAmadeusHotels(brief, fetcher);

    expect(result).toHaveLength(0);
    expect(result).toMatchObject({ status: "unavailable", reason: "No priced Amadeus hotel offers were returned" });
  });
});

function json(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
}
