import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { TripWorkspace } from "@/features/trips/components/trip-workspace";
import { buildSwitzerlandFamilyTrip } from "@/features/trips/fixtures/switzerland-family";

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("TripWorkspace", () => {
  it("opens the overview card with the trip summary and expands each other card in place", async () => {
    const user = userEvent.setup();
    render(<TripWorkspace initialPlan={buildSwitzerlandFamilyTrip()} />);

    const overviewTrigger = screen.getByRole("button", { name: "Overview" });
    const overviewCard = overviewTrigger.closest("article");
    expect(screen.queryByRole("heading", { name: "Recommendations" })).not.toBeInTheDocument();
    expect(screen.queryByText("Origin · Basel")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Basel to Bernese Oberland travel plan" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Trip plan summary" })).toHaveClass("trip-plan-summary-card");
    expect(screen.getByRole("img", { name: "Trip budget breakdown" })).toBeVisible();
    expect(within(screen.getByRole("list", { name: "Budget categories" })).getByText("Transportation")).toBeVisible();
    expect(screen.getByText("Daily allowance")).toBeVisible();
    expect(overviewTrigger).toHaveAttribute("aria-expanded", "true");
    expect(within(overviewCard!).getByText("Trip brief")).toBeVisible();
    expect(within(overviewCard!).getByText("Total cost")).toBeVisible();
    expect(within(overviewCard!).getByText("Balanced spending")).toBeVisible();

    const details = [
      ["Transportation", "Supplier source:"],
      ["Stay", "Supplier source:"],
      ["Food", "Supplier source:"],
      ["Activities", "Supplier source:"],
      ["Local transport", "Supplier source:"],
      ["Itinerary", "2026-09-10"],
    ] as const;

    for (const [label, detail] of details) {
      const trigger = screen.getByRole("button", { name: label });
      const card = trigger.closest("article");
      expect(card).not.toBeNull();
      expect(trigger).toHaveAttribute("aria-expanded", "false");

      await user.click(trigger);

      expect(trigger).toHaveAttribute("aria-expanded", "true");
      expect(within(card!).getAllByText(detail, { exact: false }).length).toBeGreaterThan(0);
    }

    expect(screen.queryByRole("region", { name: "Itinerary details" })).not.toBeInTheDocument();
  });

  it("uses the submitted spending preference in the overview summary", () => {
    const plan = buildSwitzerlandFamilyTrip();
    plan.brief.spendingPreference = "activities";
    render(<TripWorkspace initialPlan={plan} />);

    const overviewCard = screen.getByRole("button", { name: "Overview" }).closest("article");
    expect(within(overviewCard!).getByText("Activities")).toBeVisible();
    expect(within(overviewCard!).queryByText("Balanced spending")).not.toBeInTheDocument();
  });

  it("keeps the overview as the only location for total cost", () => {
    render(<TripWorkspace initialPlan={buildSwitzerlandFamilyTrip()} />);

    expect(screen.queryByRole("banner", { name: "Planner identity" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Total cost")).toHaveLength(1);
    expect(screen.getByText("Trip brief")).toBeVisible();
    const overviewCard = screen.getByRole("button", { name: "Overview" }).closest("article");
    expect(within(overviewCard!).getAllByText(/CHF/)).toHaveLength(1);
    expect(screen.queryByRole("tablist", { name: "Trip sections" })).not.toBeInTheDocument();
    expect(screen.queryByText("ACTIVE LEDGER")).not.toBeInTheDocument();
    expect(screen.queryByText("View details")).not.toBeInTheDocument();
    expect(screen.queryByText(/Synthetic Alpenblick/)).not.toBeInTheDocument();
  });

  it("shows the calculated total instead of a zero placeholder", () => {
    render(<TripWorkspace initialPlan={buildSwitzerlandFamilyTrip()} />);

    const overviewCard = screen.getByRole("button", { name: "Overview" }).closest("article");
    expect(within(overviewCard!).getByText(/1'688\.50/)).toBeVisible();
    expect(within(overviewCard!).queryByText(/0\.00/)).not.toBeInTheDocument();
  });

  it("keeps each warning once and expands itinerary details beyond one item", async () => {
    const user = userEvent.setup();
    render(<TripWorkspace initialPlan={buildSwitzerlandFamilyTrip()} />);

    const food = screen.getByRole("button", { name: "Food" });
    await user.click(food);
    const foodCard = food.closest("article");
    expect(within(foodCard!).getAllByRole("alert")).toHaveLength(1);

    const itinerary = screen.getByRole("button", { name: "Itinerary" });
    await user.click(itinerary);
    const itineraryCard = itinerary.closest("article");
    expect(within(itineraryCard!).getAllByText("Basel SBB", { exact: false })).toHaveLength(2);
    expect(within(itineraryCard!).getAllByText("Interlaken Ost", { exact: false })).toHaveLength(3);
    expect(within(itineraryCard!).getByText("Family lunch", { exact: false })).toBeVisible();
    expect(within(itineraryCard!).getByText("Mountain activity", { exact: false })).toBeVisible();
  });

  it("shows useful supplier and location details in each recommendation card", async () => {
    const user = userEvent.setup();
    render(<TripWorkspace initialPlan={buildSwitzerlandFamilyTrip()} />);

    const checks = [
      ["Transportation", "Alpine Rail", "Basel SBB", "Book with Alpine Rail"],
      ["Stay", "Alpenblick Lodge", "Hotel", "Book with Alpenblick Lodge"],
      ["Food", "Supermarket", "500 m", "Bernese Dining Demo"],
      ["Activities", "Harder Kulm", "Interlaken", "Local attractions"],
      ["Local transport", "public transport", "CHF 66.00 per person", "Bernese Pass Demo"],
    ] as const;

    for (const [label, detail, secondary, linkName] of checks) {
      const trigger = screen.getByRole("button", { name: label });
      await user.click(trigger);
      const card = trigger.closest("article");
      expect(within(card!).getAllByText(detail, { exact: false }).length).toBeGreaterThan(0);
      expect(within(card!).getByText(secondary, { exact: false })).toBeVisible();
      expect(within(card!).getByRole("link", { name: linkName })).toBeVisible();
    }
  });

  it("shows a provider warning reason alongside unavailable source evidence", async () => {
    const user = userEvent.setup();
    const plan = buildSwitzerlandFamilyTrip();
    const transport = plan.items.find((item) => item.section === "travel");
    transport!.alternatives[0].evidence = {
      ...transport!.alternatives[0].evidence,
      status: "unavailable",
      reason: "Amadeus credentials are not configured",
      synthetic: false,
    };

    render(<TripWorkspace initialPlan={plan} />);
    const trigger = screen.getByRole("button", { name: "Transportation" });
    await user.click(trigger);

    expect(within(trigger.closest("article")!).getByText("Amadeus credentials are not configured")).toBeVisible();
  });

  it("keeps expanded plan details without lock and replace actions", async () => {
    const user = userEvent.setup();
    render(<TripWorkspace initialPlan={buildSwitzerlandFamilyTrip()} />);

    const transportation = screen.getByRole("button", { name: "Transportation" });
    await user.click(transportation);
    const card = transportation.closest("article");

    expect(within(card!).getAllByText("Alpine Rail", { exact: false }).length).toBeGreaterThan(0);
    expect(within(card!).getByRole("link", { name: "Book with Alpine Rail" })).toBeVisible();
    expect(within(card!).queryByRole("button", { name: /^lock /i })).not.toBeInTheDocument();
    expect(within(card!).queryByRole("button", { name: /^replace /i })).not.toBeInTheDocument();
  });
});

describe("trip route", () => {
  async function fillGuidedBrief(user: ReturnType<typeof userEvent.setup>, origin: string, destination: string) {
    const plan = buildSwitzerlandFamilyTrip();
    plan.brief.origin = origin;
    plan.brief.destination = destination;
    plan.title = `${origin} to ${destination} travel plan`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ plan, retrievedAt: "2026-08-31T08:00:00.000Z", providerId: "openrouter-free" }),
    }));
    await user.click(screen.getByRole("button", { name: "Start planning" }));
    const dialog = screen.getByRole("dialog", { name: "Sign in to Spendwise Trip" });
    await user.type(within(dialog).getByRole("textbox", { name: "Email" }), "traveller@example.com");
    await user.type(within(dialog).getByLabelText("Password"), "demo-pass");
    await user.click(within(dialog).getByRole("button", { name: "Sign in" }));
    await user.type(screen.getByRole("textbox", { name: "Origin" }), origin);
    await user.type(screen.getByRole("textbox", { name: "Destination" }), destination);
    await user.click(screen.getByRole("button", { name: "Next: travelers & budget" }));
    await user.click(screen.getByRole("button", { name: "Next: priorities" }));
    await user.click(screen.getByRole("button", { name: "Review trip" }));
    await user.click(screen.getByRole("button", { name: "Generate travel plan" }));
  }

  it("opens the generated known-destination plan and keeps its AI context in navigation", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await fillGuidedBrief(user, "Basel", "Bernese Oberland");

    expect(await screen.findByRole("main", { name: "Spendwise AI trip workspace" })).toBeVisible();
    expect(within(screen.getByRole("navigation", { name: "Primary navigation" })).getByText("AI plan")).toBeVisible();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual(expect.objectContaining({
      origin: "Basel",
      destination: "Bernese Oberland",
    }));
  });

  it("returns to the editable brief from the generated plan", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await fillGuidedBrief(user, "Basel", "Interlaken");

    await user.click(screen.getAllByRole("button", { name: "Edit brief" }).at(-1)!);
    expect(screen.getByRole("heading", { name: "Your trip, in the making." })).toBeVisible();
    expect(screen.getByText("4 / 4")).toBeVisible();
  });

  it("accepts a user-entered known destination", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await fillGuidedBrief(user, "Stockholm", "Paris");

    expect(await screen.findByRole("heading", { name: "Stockholm to Paris travel plan" })).toBeVisible();
  });
});
