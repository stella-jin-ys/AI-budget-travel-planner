# Provider-Grounded Travel Planning Design

## Goal

Use live provider data, when configured, to find affordable transport, stays, food, attractions, and activities for a validated trip brief, then pass that evidence to the existing Gemini planning route so the generated itinerary is grounded in the returned options and remains persistable in Supabase.

## Scope and constraints

- Keep the existing Next.js `/api/plan` entry point and existing client `TripDataProvider` contract.
- Keep Gemini as the planning model; provider integrations supply evidence rather than replacing the model.
- Keep all provider credentials on the server. Never expose API keys to browser code or include them in persisted user-visible plan data.
- Treat live availability and prices as time-sensitive. Every normalized result carries supplier, checked time, status, source URL, and an uncertainty reason when it is not a directly confirmed price.
- A missing provider credential must not fabricate data or fail the whole plan. The route returns a valid plan with an explicit unavailable-provider warning and any configured sources.
- Airbnb listing search and Booking.com inventory require partner access; the first implementation exposes adapters behind environment variables and does not scrape either site.
- The initial release is recommendation/deep-link oriented. It does not take payment, create bookings, or store passenger identity documents.

## Provider strategy

### Transport

- Amadeus Self-Service Flight Offers Search supplies flight offers for the origin, destination, dates, passenger ages, and currency.
- Tictactrip supplies European train and bus itineraries through one partner API when `TICTACTRIP_API_TOKEN` is configured. Its city/stop resolution and results calls are isolated behind one adapter so a later approved provider can be substituted without changing the route.
- Transport options are normalized into supplier, mode, origin/destination stations or airports, departure/arrival, duration, total traveler cost, source URL, and provider evidence.

### Stays

- Amadeus Hotel Search supplies hotel offers when configured.
- A partner-approved accommodation adapter is reserved for Booking.com, Airbnb, and hostel inventory. Its interface returns the same normalized stay shape; unavailable credentials produce an unavailable source rather than a fake listing.
- Stay results include supplier, city, accommodation type, nightly cost, nights, total traveler cost, cancellation/availability note when supplied, and booking/deep-link URL.

### Local places

- Google Places API (New) is the default place adapter when `GOOGLE_PLACES_API_KEY` is configured.
- Foursquare Places is the optional alternative when `FOURSQUARE_API_KEY` is configured.
- The adapter searches destination food and attractions using the destination, stay area when available, and the user’s interests. It returns place name, category, distance when supplied or calculable, address, rating when supplied, website/maps URL, and source evidence.

## Normalized source snapshot

Add a server-side `TripSourceSnapshot` model with these fields:

```ts
type SourceStatus = "live" | "recent" | "typical" | "unavailable" | "failed";

interface TripSourceSnapshot {
  checkedAt: string;
  providers: Array<{
    id: string;
    status: SourceStatus;
    message?: string;
  }>;
  transport: SourceTransportOption[];
  stays: SourceStayOption[];
  food: SourcePlaceOption[];
  activities: SourcePlaceOption[];
  localTransport: SourceLocalTransportOption[];
}
```

Each option has a stable provider-scoped ID, supplier name, currency, traveler-total price where applicable, source URL, and provider metadata needed to render the existing recommendation cards. The normalizer removes malformed options, converts prices to the brief currency when a supported exchange-rate source is available, and otherwise retains the supplier currency with a warning. Cheapest selection is deterministic: only options valid for the requested dates and traveler count are eligible; ties prefer fewer transfers, shorter duration, or higher provider confidence in that order.

## Request flow

1. `/api/plan` validates the existing `TripBrief` requirements.
2. A server-only `collectTripSources(brief)` calls configured adapters in parallel with per-provider timeouts.
3. The collector returns a partial `TripSourceSnapshot`; one provider failure does not discard successful providers.
4. The route builds the Gemini prompt from the brief plus a compact, sanitized source snapshot. The model must select from supplied option IDs, preserve supplier URLs, distinguish live versus typical prices, and create detailed daily itinerary entries using the selected transport, stay, food, local transport, and preference-led activities.
5. The existing response schema validation remains the final guard. A plan referencing an unknown source ID or missing required supplier detail is rejected and retried once.
6. Supabase persists `brief`, `source_snapshot`, `plan`, `created_at`, and provider metadata in the existing trip-plan record. Existing records remain readable because the new snapshot column is nullable.
7. The UI continues to render the existing plan cards. Provider warnings appear in the existing warning/evidence areas, while unavailable categories remain clearly marked rather than silently replaced with synthetic data.

## Server modules

- `src/features/trips/sources/types.ts`: normalized source interfaces and provider result types.
- `src/features/trips/sources/collect.ts`: parallel collection, timeouts, partial-failure handling, and deterministic cheapest-option selection.
- `src/features/trips/sources/amadeus.ts`: OAuth token caching for the server request lifetime plus flight and hotel searches.
- `src/features/trips/sources/tictactrip.ts`: stop resolution and train/bus search adapter.
- `src/features/trips/sources/places.ts`: Google Places and optional Foursquare normalization.
- `src/features/trips/sources/index.ts`: environment-gated provider registry.
- `src/app/api/plan/route.ts`: invoke collection, pass the snapshot to Gemini, validate references, and persist the snapshot.
- `src/lib/supabase/persistence.ts` and `supabase/schema.sql`: persist the nullable source snapshot.
- `.env.example`: document server-only credentials and provider selection without values.

## Environment contract

```text
AMADEUS_CLIENT_ID=
AMADEUS_CLIENT_SECRET=
AMADEUS_BASE_URL=https://test.api.amadeus.com
TICTACTRIP_API_TOKEN=
GOOGLE_PLACES_API_KEY=
FOURSQUARE_API_KEY=
SOURCE_TIMEOUT_MS=8000
```

The route still uses the existing `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_PROVIDER`, Supabase variables, and OpenRouter variables. The Gemini request must use the correct `generateContent` endpoint and `contents`/`parts` request shape when Gemini is selected; the old `/interactions` fallback shape is not part of this design.

## Testing strategy

- Unit-test each adapter’s request parameters and normalization using provider fixtures; tests never call external services.
- Test collector behavior for cheapest valid selection, traveler/date propagation, provider timeout, malformed result, and partial provider failure.
- Test `/api/plan` prompt construction to ensure source IDs, prices, suppliers, links, user preference, and budget reach Gemini while credentials remain server-only.
- Test route rejection of plans that reference unknown sources and successful persistence of the source snapshot.
- Keep existing UI tests and add assertions that supplier details, warnings, and booking links remain visible in expanded recommendation cards.
- Run targeted tests first, then typecheck, lint, full unit tests, build, and the existing desktop/mobile Playwright flow with provider requests mocked.

## Acceptance criteria

- With configured credentials, the plan contains real provider-derived transport and stay options plus destination food/activity suggestions, each with supplier provenance and links.
- The model receives the normalized provider data and returns a plan whose selected alternatives match those source IDs.
- The cheapest eligible options are selected according to the deterministic selection rule and traveler/date constraints.
- Missing or failed providers produce visible warnings and do not create invented booking data.
- The existing plan UI, Supabase persistence, and one-request client flow continue to work.
