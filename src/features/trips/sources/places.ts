import type { SourceStatus, TripBrief } from "@/features/trips/domain/trip";
import type { SourcePlaceOption } from "./types";

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export type PlaceOption = SourcePlaceOption & { address?: string; mapsUrl?: string; rating?: number; distanceMeters?: number };
export type PlacesResult = PlaceOption[] & { provider: "google-places" | "foursquare" | "places"; status: SourceStatus; reason?: string };
const googleFieldMask = "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.googleMapsUri,places.rating,places.primaryTypeDisplayName,places.distanceMeters";

export async function searchPlaces(brief: TripBrief, fetcher: Fetcher, signal?: AbortSignal): Promise<PlacesResult> {
  if (!brief.destination) return outcome([], "places", "unavailable", "Destination is required");
  const foodQuery = `restaurants and supermarkets in ${brief.destination}`;
  const attractionQuery = `${brief.interests.join(" ") || "attractions"} attractions in ${brief.destination}`;
  if (process.env.GOOGLE_PLACES_API_KEY) return searchGoogle([foodQuery, attractionQuery], brief, fetcher, signal);
  if (process.env.FOURSQUARE_API_KEY) return searchFoursquare([foodQuery, attractionQuery], brief, fetcher, signal);
  return outcome([], "places", "unavailable", "Places credentials are not configured");
}

async function searchGoogle(queries: string[], brief: TripBrief, fetcher: Fetcher, signal?: AbortSignal): Promise<PlacesResult> {
  try {
  const response = await Promise.all(queries.map((textQuery) => fetcher("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!, "X-Goog-FieldMask": googleFieldMask },
    body: JSON.stringify({ textQuery }),
    signal,
  })));
  const checkedAt = new Date().toISOString();
  if (response.some((result) => !result.ok)) return outcome([], "google-places", "failed", "Google Places search failed");
  const payloads = await Promise.all(response.map(async (result) => (await result.json()) as GooglePlacesResponse));
  const options = payloads.flatMap((payload) => (payload.places ?? []).flatMap((place) => normalizePlace("google-places", place.id, place.displayName?.text, place, brief, checkedAt)));
  return options.length > 0 ? outcome(options, "google-places", "live") : outcome([], "google-places", "unavailable", "No Google Places results were returned");
  } catch (error) {
    return outcome([], "google-places", "failed", error instanceof Error ? error.message : "Google Places request failed");
  }
}

async function searchFoursquare(queries: string[], brief: TripBrief, fetcher: Fetcher, signal?: AbortSignal): Promise<PlacesResult> {
  try {
  const headers = { Authorization: process.env.FOURSQUARE_API_KEY! };
  const responses = await Promise.all(queries.map((query) => fetcher(`https://places-api.foursquare.com/places/search?${new URLSearchParams({ near: brief.destination!, query })}`, { method: "GET", headers, signal })));
  const checkedAt = new Date().toISOString();
  if (responses.some((response) => !response.ok)) return outcome([], "foursquare", "failed", "Foursquare search failed");
  const payloads = await Promise.all(responses.map(async (response) => (await response.json()) as FoursquareResponse));
  const options = payloads.flatMap((payload) => (payload.results ?? []).flatMap((place) => normalizePlace("foursquare", place.fsq_place_id, place.name, { formattedAddress: place.location?.formatted_address, websiteUri: place.website, googleMapsUri: place.link, rating: place.rating, distanceMeters: place.distance, primaryTypeDisplayName: { text: place.categories?.[0]?.name } }, brief, checkedAt)));
  return options.length > 0 ? outcome(options, "foursquare", "live") : outcome([], "foursquare", "unavailable", "No Foursquare results were returned");
  } catch (error) {
    return outcome([], "foursquare", "failed", error instanceof Error ? error.message : "Foursquare request failed");
  }
}

function outcome(options: PlaceOption[], provider: PlacesResult["provider"], status: SourceStatus, reason?: string): PlacesResult {
  return Object.assign(options, { provider, status, ...(reason ? { reason } : {}) });
}

function normalizePlace(provider: string, id: string | undefined, name: string | undefined, place: GooglePlace, brief: TripBrief, checkedAt: string): PlaceOption[] {
  if (!id || !name) return [];
  return [{ id: `${provider}-${id}`, kind: "place", supplierName: name, category: place.primaryTypeDisplayName?.text, currency: brief.currency ?? "USD", total: "0", sourceUrl: place.websiteUri, mapsUrl: place.googleMapsUri, address: place.formattedAddress, rating: place.rating, distanceMeters: place.distanceMeters, checkedAt, status: "live", travelerIds: brief.travelers.map((traveler) => traveler.id) }];
}

interface GooglePlace { id?: string; displayName?: { text?: string }; formattedAddress?: string; websiteUri?: string; googleMapsUri?: string; rating?: number; primaryTypeDisplayName?: { text?: string }; distanceMeters?: number; }
interface GooglePlacesResponse { places?: GooglePlace[]; }
interface FoursquareResponse { results?: Array<{ fsq_place_id?: string; name?: string; location?: { formatted_address?: string }; website?: string; link?: string; rating?: number; distance?: number; categories?: Array<{ name?: string }> }>; }
