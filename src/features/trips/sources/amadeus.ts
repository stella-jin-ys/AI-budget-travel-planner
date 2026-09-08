import type { SourceStatus, TripBrief } from "@/features/trips/domain/trip";
import type { SourceStayOption, SourceTransportOption } from "./types";

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export type AmadeusFlightOption = SourceTransportOption & {
  carrier?: string;
  originName?: string;
  destinationName?: string;
};

export type AmadeusHotelOption = SourceStayOption & {
  hotelName?: string;
  accommodationType?: string;
};

export type AmadeusFlightResult = ProviderOutcome<AmadeusFlightOption>;
export type AmadeusHotelResult = ProviderOutcome<AmadeusHotelOption>;
type ProviderOutcome<T> = T[] & { provider: "amadeus"; status: SourceStatus; reason?: string };

export async function searchAmadeusFlights(
  brief: TripBrief,
  fetcher: Fetcher,
  signal?: AbortSignal,
): Promise<AmadeusFlightResult> {
  if (!brief.destination) return outcome([], "unavailable", "Destination is required");
  if (!hasCredentials()) return outcome([], "unavailable", "Amadeus credentials are not configured");
  try {
    const token = await getAccessToken(fetcher, signal);
    if (!token) return outcome([], "failed", "Amadeus authentication failed");

  const query = new URLSearchParams({
    originLocationCode: brief.origin,
    destinationLocationCode: brief.destination,
    departureDate: brief.startDate,
    returnDate: brief.endDate,
    adults: String(brief.travelers.filter((traveler) => traveler.age >= 12).length),
    children: String(brief.travelers.filter((traveler) => traveler.age < 12).length),
    travelClass: "ECONOMY",
    currencyCode: brief.currency ?? "USD",
  });
  const response = await fetcher(`${amadeusBaseUrl()}/v2/shopping/flight-offers?${query}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!response.ok) return outcome([], "failed", `Amadeus flight search failed (${response.status})`);

  const payload = (await response.json()) as AmadeusFlightResponse;
  const checkedAt = new Date().toISOString();
  const options = (payload.data ?? []).flatMap((offer) => {
    if (!offer.id || !offer.price?.total) return [];
    const itinerary = offer.itineraries?.[0];
    const firstSegment = itinerary?.segments?.[0];
    const lastSegment = itinerary?.segments?.at(-1);
    const carrierCode = firstSegment?.carrierCode;
    const originCode = firstSegment?.departure?.iataCode;
    const destinationCode = lastSegment?.arrival?.iataCode;
    return [{
      id: `amadeus-flight-${offer.id}`,
      kind: "transport" as const,
      supplierName: carrierCode ? payload.dictionaries?.carriers?.[carrierCode] ?? carrierCode : "Amadeus",
      carrier: carrierCode,
      currency: offer.price.currency ?? brief.currency ?? "USD",
      total: offer.price.total,
      checkedAt,
      status: "live" as const,
      travelerIds: brief.travelers.map((traveler) => traveler.id),
      departureAt: firstSegment?.departure?.at,
      arrivalAt: lastSegment?.arrival?.at,
      durationMins: parseDuration(itinerary?.duration),
      transfers: itinerary?.segments ? Math.max(0, itinerary.segments.length - 1) : undefined,
      originName: originCode ? payload.dictionaries?.locations?.[originCode]?.detailedName ?? originCode : undefined,
      destinationName: destinationCode ? payload.dictionaries?.locations?.[destinationCode]?.detailedName ?? destinationCode : undefined,
    }];
  });
  return options.length > 0 ? outcome(options, "live") : outcome([], "unavailable", "No priced Amadeus flight offers were returned");
  } catch (error) {
    return outcome([], "failed", errorReason(error));
  }
}

export async function searchAmadeusHotels(
  brief: TripBrief,
  fetcher: Fetcher,
  signal?: AbortSignal,
): Promise<AmadeusHotelResult> {
  if (!brief.destination) return outcome([], "unavailable", "Destination is required");
  if (!hasCredentials()) return outcome([], "unavailable", "Amadeus credentials are not configured");
  try {
  const token = await getAccessToken(fetcher, signal);
  if (!token) return outcome([], "failed", "Amadeus authentication failed");

  const headers = { Authorization: `Bearer ${token}` };
  const hotelsResponse = await fetcher(
    `${amadeusBaseUrl()}/v1/reference-data/locations/hotels/by-city?${new URLSearchParams({ cityCode: brief.destination })}`,
    { method: "GET", headers, signal },
  );
  if (!hotelsResponse.ok) return outcome([], "failed", `Amadeus hotel list search failed (${hotelsResponse.status})`);
  const hotels = (await hotelsResponse.json()) as AmadeusHotelListResponse;
  const hotelIds = (hotels.data ?? []).map((hotel) => hotel.hotelId).filter(Boolean).slice(0, 20);
  if (hotelIds.length === 0) return outcome([], "unavailable", "No Amadeus hotels were returned for the destination");

  const adults = brief.travelers.filter((traveler) => traveler.age >= 12).length;
  const query = new URLSearchParams({
    hotelIds: hotelIds.join(","),
    checkInDate: brief.startDate,
    checkOutDate: brief.endDate,
    adults: String(adults),
    roomQuantity: "1",
    currency: brief.currency ?? "USD",
  });
  const offersResponse = await fetcher(`${amadeusBaseUrl()}/v3/shopping/hotel-offers?${query}`, { method: "GET", headers, signal });
  if (!offersResponse.ok) return outcome([], "failed", `Amadeus hotel offer search failed (${offersResponse.status})`);

  const payload = (await offersResponse.json()) as AmadeusHotelOffersResponse;
  const checkedAt = new Date().toISOString();
  const nights = nightsBetween(brief.startDate, brief.endDate);
  const options = (payload.data ?? []).flatMap((hotel) =>
    (hotel.offers ?? []).flatMap((offer) => {
      if (!hotel.hotel?.hotelId || !offer.id || !offer.price?.total) return [];
      return [{
        id: `amadeus-hotel-${hotel.hotel.hotelId}-${offer.id}`,
        kind: "stay" as const,
        supplierName: hotel.hotel.name ?? "Amadeus hotel",
        hotelName: hotel.hotel.name,
        accommodationType: offer.room?.typeEstimated?.category,
        currency: offer.price.currency ?? brief.currency ?? "USD",
        total: offer.price.total,
        checkedAt,
        status: "live" as const,
        travelerIds: brief.travelers.map((traveler) => traveler.id),
        checkInAt: brief.startDate,
        checkOutAt: brief.endDate,
        nights,
      }];
    }),
  );
  return options.length > 0 ? outcome(options, "live") : outcome([], "unavailable", "No priced Amadeus hotel offers were returned");
  } catch (error) {
    return outcome([], "failed", errorReason(error));
  }
}

async function getAccessToken(fetcher: Fetcher, signal?: AbortSignal): Promise<string | undefined> {
  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return undefined;
  const response = await fetcher(`${amadeusBaseUrl()}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }).toString(),
    signal,
  });
  if (!response.ok) return undefined;
  const payload = (await response.json()) as { access_token?: string };
  return payload.access_token;
}

function amadeusBaseUrl() {
  return (process.env.AMADEUS_BASE_URL ?? "https://test.api.amadeus.com").replace(/\/$/, "");
}

function hasCredentials() {
  return Boolean(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET);
}

function outcome<T>(options: T[], status: SourceStatus, reason?: string): ProviderOutcome<T> {
  return Object.assign(options, { provider: "amadeus" as const, status, ...(reason ? { reason } : {}) });
}

function errorReason(error: unknown) {
  return error instanceof Error ? error.message : "Amadeus request failed";
}

function parseDuration(value?: string) {
  const match = value?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/);
  return match ? Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0) : undefined;
}

function nightsBetween(checkIn: string, checkOut: string) {
  return Math.max(0, Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86_400_000));
}

interface AmadeusFlightResponse { data?: Array<{ id?: string; price?: { total?: string; currency?: string }; itineraries?: Array<{ duration?: string; segments?: Array<{ carrierCode?: string; departure?: { iataCode?: string; at?: string }; arrival?: { iataCode?: string; at?: string } }> }> }>; dictionaries?: { carriers?: Record<string, string>; locations?: Record<string, { detailedName?: string }> }; }
interface AmadeusHotelListResponse { data?: Array<{ hotelId?: string }>; }
interface AmadeusHotelOffersResponse { data?: Array<{ hotel?: { hotelId?: string; name?: string }; offers?: Array<{ id?: string; price?: { total?: string; currency?: string }; room?: { typeEstimated?: { category?: string } } }> }>; }
