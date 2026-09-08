import type { SourceStatus, TripBrief } from "@/features/trips/domain/trip";
import type { SourceTransportOption } from "./types";

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export type TictactripOption = SourceTransportOption & { carrier?: string; originName?: string; destinationName?: string };
export type TictactripResult = TictactripOption[] & { provider: "tictactrip"; status: SourceStatus; reason?: string };

export async function searchTictactrip(brief: TripBrief, fetcher: Fetcher, signal?: AbortSignal): Promise<TictactripResult> {
  const token = process.env.TICTACTRIP_API_TOKEN;
  if (!token) return outcome([], "unavailable", "Tictactrip credentials are not configured");
  if (!brief.destination) return outcome([], "unavailable", "Destination is required");
  try {
  const headers = { Authorization: `Bearer ${token}` };
  const [origin, destination] = await Promise.all([resolveStop(brief.origin, fetcher, headers, signal), resolveStop(brief.destination, fetcher, headers, signal)]);
  if (!origin || !destination) return outcome([], "unavailable", "Tictactrip could not resolve the requested stops");

  const response = await fetcher("https://api.tictactrip.eu/v2/results", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ originGpuid: origin.gpuid, destinationGpuid: destination.gpuid, outboundDate: `${brief.startDate}T00:00:00Z`, passengers: brief.travelers.map((traveler) => ({ age: traveler.age })) }),
    signal,
  });
  if (!response.ok) return outcome([], "failed", `Tictactrip results search failed (${response.status})`);
  const payload = (await response.json()) as TictactripResponse;
  const checkedAt = new Date().toISOString();
  const options = (payload.results ?? []).flatMap((itinerary) => {
    if (!itinerary.id || !itinerary.price?.total) return [];
    const firstLeg = itinerary.legs?.[0];
    const lastLeg = itinerary.legs?.at(-1);
    return [{
      id: `tictactrip-${itinerary.id}`,
      kind: "transport" as const,
      supplierName: firstLeg?.carrier?.name ?? "Tictactrip",
      carrier: firstLeg?.carrier?.name,
      currency: itinerary.price.currency ?? brief.currency ?? "EUR",
      total: itinerary.price.total,
      sourceUrl: itinerary.bookingUrl,
      checkedAt,
      status: "live" as const,
      travelerIds: brief.travelers.map((traveler) => traveler.id),
      departureAt: firstLeg?.departure?.time,
      arrivalAt: lastLeg?.arrival?.time,
      durationMins: itinerary.duration,
      transfers: itinerary.legs ? Math.max(0, itinerary.legs.length - 1) : undefined,
      originName: firstLeg?.departure?.station?.name ?? origin.name,
      destinationName: lastLeg?.arrival?.station?.name ?? destination.name,
    }];
  });
  return options.length > 0 ? outcome(options, "live") : outcome([], "unavailable", "No priced Tictactrip itineraries were returned");
  } catch (error) {
    return outcome([], "failed", error instanceof Error ? error.message : "Tictactrip request failed");
  }
}

async function resolveStop(query: string, fetcher: Fetcher, headers: HeadersInit, signal?: AbortSignal) {
  const response = await fetcher(`https://api.tictactrip.eu/v2/stopClusters?${new URLSearchParams({ query })}`, { method: "GET", headers, signal });
  if (!response.ok) return undefined;
  const payload = (await response.json()) as { stopClusters?: Array<{ gpuid?: string; name?: string }> };
  return payload.stopClusters?.find((stop) => stop.gpuid);
}

function outcome(options: TictactripOption[], status: SourceStatus, reason?: string): TictactripResult {
  return Object.assign(options, { provider: "tictactrip" as const, status, ...(reason ? { reason } : {}) });
}

interface TictactripResponse { results?: Array<{ id?: string; price?: { total?: string; currency?: string }; duration?: number; bookingUrl?: string; legs?: Array<{ carrier?: { name?: string }; departure?: { station?: { name?: string }; time?: string }; arrival?: { station?: { name?: string }; time?: string } }> }>; }
