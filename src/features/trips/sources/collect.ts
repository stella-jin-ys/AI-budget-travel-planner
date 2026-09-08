import type { SourceStatus, TripBrief } from "@/features/trips/domain/trip";
import { searchAmadeusFlights, searchAmadeusHotels } from "./amadeus";
import { searchPlaces } from "./places";
import { selectCheapestEligible } from "./select";
import { searchTictactrip } from "./tictactrip";
import type {
  SourceLocalTransportOption,
  SourcePlaceOption,
  SourceStayOption,
  SourceTransportOption,
  TripSourceSnapshot,
} from "./types";

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export interface ProviderStatus {
  id: string;
  status: SourceStatus;
  message?: string;
}

export type CollectedTripSourceSnapshot = TripSourceSnapshot;

export interface CollectTripSourcesOptions {
  timeoutMs?: number;
}

interface ProviderResult {
  provider: ProviderStatus;
  transport?: SourceTransportOption[];
  stays?: SourceStayOption[];
  places?: SourcePlaceOption[];
  localTransport?: SourceLocalTransportOption[];
}

interface ProviderJob {
  id: string;
  collect: (brief: TripBrief, signal: AbortSignal) => Promise<ProviderResult>;
}

export function providerRegistry(fetcher: Fetcher = globalThis.fetch): ProviderJob[] {
  return [
    {
      id: "amadeus",
      async collect(brief, signal) {
        if (!process.env.AMADEUS_CLIENT_ID || !process.env.AMADEUS_CLIENT_SECRET) {
          return unavailable("amadeus", "Amadeus credentials are not configured");
        }

        const [flights, hotels] = await Promise.all([
          searchAmadeusFlights(brief, fetcher, signal),
          searchAmadeusHotels(brief, fetcher, signal),
        ]);
        return {
          provider: combinedStatus("amadeus", [flights, hotels]),
          transport: flights,
          stays: hotels,
        };
      },
    },
    {
      id: "tictactrip",
      async collect(brief, signal) {
        if (!process.env.TICTACTRIP_API_TOKEN) {
          return unavailable("tictactrip", "Tictactrip credentials are not configured");
        }

        const transport = await searchTictactrip(brief, fetcher, signal);
        return { provider: resultStatus("tictactrip", transport), transport };
      },
    },
    {
      id: placesProviderId(),
      async collect(brief, signal) {
        if (!process.env.GOOGLE_PLACES_API_KEY && !process.env.FOURSQUARE_API_KEY) {
          return unavailable("places", "Places credentials are not configured");
        }

        const places = await searchPlaces(brief, fetcher, signal);
        return { provider: resultStatus(placesProviderId(), places), places };
      },
    },
  ];
}

export async function collectTripSources(
  brief: TripBrief,
  options: CollectTripSourcesOptions = {},
): Promise<CollectedTripSourceSnapshot> {
  const timeoutMs = options.timeoutMs ?? Number(process.env.SOURCE_TIMEOUT_MS ?? 8000);
  const jobs = providerRegistry();
  const results = await Promise.allSettled(
    jobs.map(async (job) => withTimeout((signal) => job.collect(brief, signal), timeoutMs)),
  );
  const successful = results.flatMap((result, index) =>
    result.status === "fulfilled"
      ? [result.value]
      : [{ provider: failed(jobs[index].id, result.reason) }],
  );
  const transport = successful.flatMap((result) => result.transport ?? []);
  const stays = successful.flatMap((result) => result.stays ?? []);
  const places = successful.flatMap((result) => result.places ?? []);
  const localTransport = successful.flatMap((result) => result.localTransport ?? []);

  return {
    brief,
    checkedAt: new Date().toISOString(),
    providers: successful.map((result) => result.provider),
    transport: choose(transport, brief),
    stays: choose(stays, brief),
    places: choose(places, brief),
    localTransport: choose(localTransport, brief),
  };
}

function choose<T extends SourceTransportOption | SourceStayOption | SourcePlaceOption | SourceLocalTransportOption>(
  options: T[],
  brief: TripBrief,
) {
  const selected = selectCheapestEligible(options, brief);
  return selected ? [selected] : [];
}

function withTimeout<T>(collect: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const signal = AbortSignal.timeout(timeoutMs);
  return Promise.race([
    collect(signal),
    new Promise<T>((_, reject) => {
      signal.addEventListener("abort", () => reject(new Error("Source provider timed out")), { once: true });
    }),
  ]);
}

function combinedStatus(id: string, outcomes: Array<{ status: SourceStatus; reason?: string }>): ProviderStatus {
  if (outcomes.some((outcome) => outcome.status === "live")) return { id, status: "live" };
  if (outcomes.some((outcome) => outcome.status === "failed")) return { id, status: "failed", message: outcomes.find((outcome) => outcome.reason)?.reason };
  return { id, status: "unavailable", message: outcomes.find((outcome) => outcome.reason)?.reason };
}

function resultStatus(id: string, outcome: { status: SourceStatus; reason?: string }): ProviderStatus {
  return { id, status: outcome.status, ...(outcome.reason ? { message: outcome.reason } : {}) };
}

function unavailable(id: string, message: string): ProviderResult {
  return { provider: { id, status: "unavailable", message } };
}

function failed(id: string, reason: unknown): ProviderStatus {
  return { id, status: "failed", message: reason instanceof Error ? reason.message : "Source provider failed" };
}

function placesProviderId() {
  if (process.env.GOOGLE_PLACES_API_KEY) return "google-places";
  if (process.env.FOURSQUARE_API_KEY) return "foursquare";
  return "places";
}
