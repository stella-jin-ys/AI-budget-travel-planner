import { afterEach, describe, expect, it, vi } from "vitest";
import type { TripBrief, TripPlan } from "@/features/trips/domain/trip";
import type { TripSourceSnapshot } from "@/features/trips/sources/types";

const insert = vi.fn().mockResolvedValue({ error: null });
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: vi.fn(() => ({ insert })) })),
}));

const brief = {
  mode: "known-destination",
  origin: "Lund",
  destination: "Paris",
  startDate: "2027-02-20",
  endDate: "2027-02-27",
  travelers: [{ id: "adult-1", name: "Adult", age: 35, eligibility: ["adult"] }],
  interests: ["museums"],
} as TripBrief;

const plan = { id: "ai-1", title: "Lund to Paris", currency: "SEK", brief, items: [], days: [], completeSections: [], contingencyRate: "0.1" } as TripPlan;

const sourceSnapshot = {
  brief,
  checkedAt: "2026-09-07T09:30:00Z",
  providers: [{ id: "amadeus", status: "live" }],
  transport: [],
  stays: [],
  places: [],
  localTransport: [],
} as TripSourceSnapshot;

afterEach(() => {
  insert.mockClear();
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe("persistTripPlan", () => {
  it("does not fail when Supabase is not configured", async () => {
    const { persistTripPlan } = await import("@/lib/supabase/persistence");
    await expect(persistTripPlan(brief, plan)).resolves.toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("stores the brief, plan, and creation timestamp", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    const { persistTripPlan } = await import("@/lib/supabase/persistence");

    await expect(persistTripPlan(brief, plan)).resolves.toBe(true);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ brief, plan, created_at: expect.any(String) }));
  });

  it("stores a source snapshot when one is provided", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    const { persistTripPlan } = await import("@/lib/supabase/persistence");

    await expect(persistTripPlan(brief, plan, sourceSnapshot)).resolves.toBe(true);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        brief,
        plan,
        source_snapshot: sourceSnapshot,
        created_at: expect.any(String),
      }),
    );
  });

  it("surfaces a configured Supabase insert failure", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    insert.mockResolvedValueOnce({ error: { message: "database unavailable" } });
    const { persistTripPlan } = await import("@/lib/supabase/persistence");

    await expect(persistTripPlan(brief, plan)).rejects.toThrow("Supabase trip persistence failed");
  });
});
