# Provider-Grounded Travel Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect configured live travel and destination data, pass a normalized evidence snapshot to Gemini, and persist the grounded plan without exposing provider credentials.

**Architecture:** Add server-only provider adapters behind a small normalized source interface. `/api/plan` validates the brief, collects partial provider data in parallel, embeds the compact snapshot in the existing Gemini prompt, validates the model’s selected source IDs, and persists both snapshot and plan. Existing UI cards consume the current `PlanAlternative` details/evidence/links fields, so provider warnings remain visible without a client-side provider SDK.

**Tech Stack:** Next.js 16 route handlers, TypeScript, Zod 4, native `fetch`, Vitest, Supabase.

**Spec:** `docs/superpowers/specs/2026-09-07-provider-grounded-travel-planning-design.md`

## Global Constraints

- Keep the existing Next.js `/api/plan` entry point and existing client `TripDataProvider` contract.
- Keep Gemini as the planning model; provider integrations supply evidence rather than replacing the model.
- Keep all provider credentials on the server.
- A missing provider credential must not fabricate data or fail the whole plan.
- Airbnb listing search and Booking.com inventory remain partner-gated adapters; no scraping.
- The initial release is recommendation/deep-link oriented and does not take payment or create bookings.
- External providers are never called by tests; tests use deterministic `fetch` fixtures.

---

### Task 1: Define normalized source contracts and deterministic selection

**Files:**
- Create: `src/features/trips/sources/types.ts`
- Create: `src/features/trips/sources/select.ts`
- Test: `tests/sources/select.test.ts`

**Interfaces:**
- Consumes: `TripBrief` from `src/features/trips/domain/trip.ts` and raw normalized source option types.
- Produces: `TripSourceSnapshot`, `SourceTransportOption`, `SourceStayOption`, `SourcePlaceOption`, `SourceLocalTransportOption`, and `selectCheapestEligible(options, brief)`.

- [ ] **Step 1: Write the failing tests**

```ts
it("selects the cheapest valid transport for all travelers", () => {
  const selected = selectCheapestEligible([
    transport("cheap", "40.00", ["adult-1", "child-1"]),
    transport("expensive", "80.00", ["adult-1", "child-1"]),
  ], brief);
  expect(selected?.id).toBe("cheap");
});

it("ignores an option that does not cover every traveler", () => {
  const selected = selectCheapestEligible([
    transport("adult-only", "1.00", ["adult-1"]),
    transport("family", "40.00", ["adult-1", "child-1"]),
  ], brief);
  expect(selected?.id).toBe("family");
});
```

- [ ] **Step 2: Run the source test and verify it fails**

Run: `node /Users/stella/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run tests/sources/select.test.ts --maxWorkers=1`

Expected: FAIL because the source types and selection function do not exist.

- [ ] **Step 3: Implement the minimal contracts and selector**

Define source options with stable `id`, `supplierName`, `currency`, `total`, `sourceUrl`, `checkedAt`, `status`, and category-specific detail fields. Implement selection by filtering to the brief traveler IDs, then sorting by numeric total, duration/transfers where present, and stable ID. Return `undefined` for an empty eligible set.

- [ ] **Step 4: Run the source test and verify it passes**

Run the same Vitest command. Expected: PASS.

### Task 2: Implement provider adapters with fixture-driven normalization

**Files:**
- Create: `src/features/trips/sources/amadeus.ts`
- Create: `src/features/trips/sources/tictactrip.ts`
- Create: `src/features/trips/sources/places.ts`
- Create: `tests/sources/amadeus.test.ts`
- Create: `tests/sources/tictactrip.test.ts`
- Create: `tests/sources/places.test.ts`

**Interfaces:**
- Consumes: `TripBrief`, server environment variables, and provider JSON responses.
- Produces: `searchAmadeusFlights(brief, fetcher)`, `searchAmadeusHotels(brief, fetcher)`, `searchTictactrip(brief, fetcher)`, and `searchPlaces(brief, fetcher)` returning normalized source options.

- [ ] **Step 1: Write failing adapter tests**

Each test supplies a `fetcher` stub and asserts the request URL, method, headers, traveler/date parameters, and normalized supplier details. Include one Amadeus OAuth-plus-flight fixture, one hotel fixture, one Tictactrip stop/results fixture, and one Google Places fixture. Assert that provider prices, station/airport names, accommodation details, place website URLs, and checked timestamps survive normalization.

- [ ] **Step 2: Run adapter tests and verify they fail**

Run: `node /Users/stella/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run tests/sources/amadeus.test.ts tests/sources/tictactrip.test.ts tests/sources/places.test.ts --maxWorkers=1`

Expected: FAIL because the adapter modules do not exist.

- [ ] **Step 3: Implement Amadeus normalization**

Use `AMADEUS_BASE_URL` with default `https://test.api.amadeus.com`. Request an OAuth token from `/v1/security/oauth2/token`, then call Flight Offers Search and Hotel List/Offers Search with dates, traveler count/ages, destination, and currency. Do not log tokens or raw responses. Return `status: "live"` only when the response includes an offer price; otherwise use `unavailable` or `failed` with a reason.

- [ ] **Step 4: Implement Tictactrip normalization**

When `TICTACTRIP_API_TOKEN` is present, resolve origin and destination stop clusters and call the results endpoint with outbound date and passengers. Normalize each itinerary into transport alternatives with carrier, stops, departure, arrival, duration, traveler total, and provider URL. When the token is absent, return an empty result with a provider status handled by the collector.

- [ ] **Step 5: Implement Places normalization**

Use Google Places Text Search (New) when `GOOGLE_PLACES_API_KEY` is present; send destination-specific food and attraction queries and request only required fields. If Google is absent and `FOURSQUARE_API_KEY` is present, use Foursquare Place Search with `near` and query/category. Normalize restaurants, supermarkets, attractions, distance, address, website/maps links, and ratings without inventing missing values.

- [ ] **Step 6: Run adapter tests and verify they pass**

Run the same Vitest command. Expected: all adapter tests PASS with no network calls.

### Task 3: Add provider registry, collection, timeouts, and partial failures

**Files:**
- Create: `src/features/trips/sources/collect.ts`
- Create: `src/features/trips/sources/index.ts`
- Test: `tests/sources/collect.test.ts`

**Interfaces:**
- Consumes: adapter functions from Task 2 and `selectCheapestEligible` from Task 1.
- Produces: `collectTripSources(brief): Promise<TripSourceSnapshot>` and a provider registry selected from server environment variables.

- [ ] **Step 1: Write failing collector tests**

```ts
it("keeps successful provider data when another provider times out", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementationOnce(successfulAmadeus).mockImplementationOnce(() => new Promise(() => {}));
  const snapshot = await collectTripSources(brief, { timeoutMs: 5 });
  expect(snapshot.transport).toHaveLength(1);
  expect(snapshot.providers).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "amadeus", status: "live" }),
    expect.objectContaining({ id: "tictactrip", status: "failed" }),
  ]));
});
```

- [ ] **Step 2: Run the collector test and verify it fails**

Run: `node /Users/stella/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run tests/sources/collect.test.ts --maxWorkers=1`

Expected: FAIL because collection does not exist.

- [ ] **Step 3: Implement the collector**

Run configured provider jobs with `Promise.allSettled`, wrap each job in `AbortSignal.timeout(Number(process.env.SOURCE_TIMEOUT_MS ?? 8000))`, record one provider status, and merge successful options. Call the selector for each category only after normalization. Return empty arrays plus explicit provider statuses for missing credentials.

- [ ] **Step 4: Run the collector test and verify it passes**

Run the same Vitest command. Expected: PASS.

### Task 4: Ground Gemini generation in the source snapshot

**Files:**
- Modify: `src/app/api/plan/route.ts`
- Modify: `tests/api/plan-route.test.ts`

**Interfaces:**
- Consumes: `collectTripSources` and `TripSourceSnapshot`.
- Produces: an API response containing the generated `TripPlan`, `retrievedAt`, `providerId`, `saved`, and non-sensitive provider status metadata.

- [ ] **Step 1: Add failing route tests**

Add tests asserting that the Gemini request contains the origin, dates, traveler IDs, preference, budget, source supplier IDs, prices, links, and unavailable-provider statuses. Add a test where Gemini selects an unknown source ID and assert the route retries/rejects instead of returning an ungrounded plan.

- [ ] **Step 2: Run route tests and verify they fail**

Run: `node /Users/stella/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run tests/api/plan-route.test.ts --maxWorkers=1`

Expected: FAIL because the route does not collect or include source snapshots.

- [ ] **Step 3: Integrate collection and fix Gemini request shape**

Call `collectTripSources(brief)` once before the model retry loop. Add a compact serialized snapshot to the prompt and require selected alternatives to use supplied source IDs. Keep the existing Zod response schema, add reference validation against the snapshot, and preserve the current one-retry behavior. When Gemini is selected, call `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` with `contents`, `parts`, and the existing structured JSON instruction; extract text from `candidates[0].content.parts`. Keep OpenRouter behavior unchanged except for the added evidence prompt.

- [ ] **Step 4: Run route tests and verify they pass**

Run the same Vitest command. Expected: all route tests PASS, including current malformed-output and provider-selection tests.

### Task 5: Persist source snapshots and expose provider configuration

**Files:**
- Modify: `src/lib/supabase/persistence.ts`
- Modify: `supabase/schema.sql`
- Modify: `.env.example`
- Modify: `tests/lib/supabase-persistence.test.ts`

**Interfaces:**
- Consumes: `TripSourceSnapshot` from Task 1.
- Produces: `persistTripPlan(brief, plan, sourceSnapshot?)` and a nullable `source_snapshot` JSONB column.

- [ ] **Step 1: Write failing persistence tests**

Assert that persistence inserts `brief`, `plan`, `source_snapshot`, and `created_at`; assert that omitting a snapshot remains valid for compatibility with existing callers.

- [ ] **Step 2: Run persistence tests and verify they fail**

Run: `node /Users/stella/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run tests/lib/supabase-persistence.test.ts --maxWorkers=1`

Expected: FAIL because the insert does not include `source_snapshot`.

- [ ] **Step 3: Implement persistence and environment documentation**

Add the nullable JSONB column and update the insert payload. Document `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`, `AMADEUS_BASE_URL`, `TICTACTRIP_API_TOKEN`, `GOOGLE_PLACES_API_KEY`, `FOURSQUARE_API_KEY`, and `SOURCE_TIMEOUT_MS` with empty values except the Amadeus test base URL.

- [ ] **Step 4: Run persistence tests and verify they pass**

Run the same Vitest command. Expected: PASS.

### Task 6: Verify plan-card compatibility and provider warnings

**Files:**
- Modify: `tests/components/workspace.test.tsx`
- Modify: `tests/components/leaves.test.tsx`
- Modify: `src/features/trips/components/source-badge.tsx` only if the existing evidence rendering cannot show unavailable-provider reasons.

**Interfaces:**
- Consumes: normalized `PlanAlternative` details/evidence/links produced by the route.
- Produces: regression coverage for supplier details, prices, warnings, and booking/deep links in expanded cards.

- [ ] **Step 1: Add failing UI assertions**

Render a plan with one live transport supplier, one stay booking link, one food website link, one attraction link, and one unavailable provider warning. Assert that the expanded cards show each supplier, cost, link, and warning without adding new nested panels.

- [ ] **Step 2: Run the workspace and leaves tests and verify failures**

Run: `node /Users/stella/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run tests/components/workspace.test.tsx tests/components/leaves.test.tsx --maxWorkers=1`

Expected: FAIL only if the current evidence component cannot render the new warning shape.

- [ ] **Step 3: Make the smallest rendering change**

Reuse existing details, links, and evidence markup. If a provider status reason is not visible, render it through the existing source-badge/evidence region with the supplier name and status; do not add a second card hierarchy.

- [ ] **Step 4: Run the workspace and leaves tests and verify they pass**

Run the same Vitest command. Expected: PASS.

### Task 7: Full verification and deployment configuration review

**Files:**
- Modify: `README.md` only if the new server environment contract is not documented there.
- Test: existing unit, e2e, typecheck, lint, and build commands.

- [ ] **Step 1: Run all unit tests**

Run: `node /Users/stella/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run --maxWorkers=1`

Expected: PASS with no external network calls.

- [ ] **Step 2: Run typecheck and lint**

Run: `/Users/stella/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/typescript/bin/tsc --noEmit` and `./node_modules/.bin/eslint .`.

Expected: no new errors. Existing unrelated errors must be reported separately rather than hidden.

- [ ] **Step 3: Run the production build**

Run: `/Users/stella/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/next/dist/bin/next build --webpack`.

Expected: successful production build with provider keys omitted.

- [ ] **Step 4: Run the existing desktop/mobile Playwright flow with mocked provider endpoints**

Run: `./node_modules/.bin/playwright test e2e/trip-planning.spec.ts` with route interception for provider and Gemini requests. Verify the user brief appears in the prompt payload, expanded cards show supplier data, and provider failure warnings do not prevent the plan from rendering.

- [ ] **Step 5: Inspect the final diff and deployment variables**

Run: `git diff --check` and `git status --short`. Confirm no API key values, raw provider tokens, or external response dumps are committed. Confirm the deployment environment receives the same server-only variables documented in `.env.example`.

