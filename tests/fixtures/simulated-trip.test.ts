import { describe, expect, it } from "vitest";
import { calculateBudget } from "@/features/trips/domain/budget";
import { money } from "@/features/trips/domain/money";
import type { TripBrief } from "@/features/trips/domain/trip";
import { buildSimulatedTrip } from "@/features/trips/fixtures/simulated-trip";

const brief: TripBrief = {
  mode: "known-destination",
  origin: "Lund",
  destination: "Paris",
  startDate: "2026-10-10",
  endDate: "2026-10-12",
  travelers: [
    { id: "adult-1", name: "Adult", age: 35, eligibility: ["adult"] },
    { id: "child-1", name: "Child", age: 8, eligibility: ["child", "family"] },
  ],
  interests: ["activities"],
  currency: "EUR",
  budget: money("1200", "EUR"),
  budgetMode: "total",
  spendingPreference: "activities",
  transitTolerance: "flexible",
  accommodationType: "hostel",
  strictBudget: money("1200", "EUR"),
};

describe("buildSimulatedTrip", () => {
  it("uses the submitted route, preferences, travelers, and dates", () => {
    const plan = buildSimulatedTrip(brief);

    expect(plan.title).toContain("Lund to Paris");
    expect(plan.brief).toEqual(brief);
    expect(plan.items.some((item) => item.label.includes("Lund") && item.label.includes("Paris"))).toBe(true);
    expect(plan.items.some((item) => item.label.includes("hostel"))).toBe(true);
    expect(plan.days).toHaveLength(3);
    expect(plan.days.every((day) => day.items.length >= 3)).toBe(true);
    expect(plan.days.map((day) => day.date)).toEqual(["2026-10-10", "2026-10-11", "2026-10-12"]);
  });

  it("keeps the preview total within a submitted budget", () => {
    const plan = buildSimulatedTrip(brief);
    const summary = calculateBudget(plan);

    expect(summary.total.currency).toBe("EUR");
    expect(summary.withinStrictLimit).toBe(true);
    expect(Number(summary.total.amount)).toBeGreaterThan(0);
    expect(Number(summary.total.amount)).toBeLessThanOrEqual(1200);
  });

  it("treats the default zero budget as an open preview without losing the input", () => {
    const zeroBudgetBrief = { ...brief, budget: money("0", "EUR"), strictBudget: money("0", "EUR") };
    const plan = buildSimulatedTrip(zeroBudgetBrief);

    expect(plan.brief.budget).toEqual(money("0", "EUR"));
    expect(plan.brief.strictBudget).toBeUndefined();
    expect(Number(calculateBudget(plan).total.amount)).toBeGreaterThan(0);
  });
});
