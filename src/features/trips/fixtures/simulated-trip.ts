import { money } from "@/features/trips/domain/money";
import type {
  CostCategory,
  ItineraryDay,
  PlanAlternative,
  PlanItem,
  SourceEvidence,
  Traveler,
  TripBrief,
  TripPlan,
} from "@/features/trips/domain/trip";

const categoryRatios: Array<[CostCategory, number]> = [
  ["transport", 0.28],
  ["stay", 0.3],
  ["food", 0.16],
  ["activities", 0.16],
  ["local-transit", 0.1],
];

function dayCount(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 1;
  return Math.max(1, Math.floor((end - start) / 86_400_000) + 1);
}

function dateAfter(startDate: string, offset: number) {
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function travelerCosts(amount: string, travelers: Traveler[], currency: string) {
  const ids = travelers.length ? travelers.map((traveler) => traveler.id) : ["adult-1"];
  const total = Number(amount);
  const share = total / ids.length;
  return Object.fromEntries(ids.map((id, index) => {
    const value = index === ids.length - 1 ? total - share * (ids.length - 1) : share;
    return [id, money(String(Math.max(0, value)), currency)];
  }));
}

function previewEvidence(sourceUrl: string): SourceEvidence {
  return {
    status: "typical",
    supplierName: "Spendwise preview estimate",
    checkedAt: new Date().toISOString(),
    sourceUrl,
    reason: "Preview generated from your brief; it is not live availability or a booking quote.",
    synthetic: true,
  };
}

function mapsUrl(destination: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
}

function alternative(
  id: string,
  label: string,
  category: CostCategory,
  amount: string,
  brief: TripBrief,
  currency: string,
  details: Array<{ label: string; value: string }>,
): PlanAlternative {
  const destination = brief.destination?.trim() || "your chosen destination";
  const sourceUrl = mapsUrl(destination);
  return {
    id,
    label: `Preview · ${label}`,
    category,
    travelerCosts: travelerCosts(amount, brief.travelers, currency),
    covered: false,
    optional: false,
    evidence: previewEvidence(sourceUrl),
    details,
    links: [{ label: "Explore on Google Maps", url: sourceUrl }],
  };
}

function item(
  id: string,
  section: PlanItem["section"],
  label: string,
  option: PlanAlternative,
  connectionFeasible?: boolean,
): PlanItem {
  return {
    id,
    section,
    label,
    required: true,
    selectedAlternativeId: option.id,
    alternatives: [option],
    ...(connectionFeasible === undefined ? {} : { connectionFeasible }),
  };
}

function itinerary(brief: TripBrief, destination: string, days: number, activity: string, localTransport: string): ItineraryDay[] {
  return Array.from({ length: days }, (_, index) => {
    const date = dateAfter(brief.startDate, index);
    const firstDay = index === 0;
    return {
      id: `preview-day-${index + 1}`,
      date,
      title: firstDay ? `Day ${index + 1} · Arrive and settle in` : `Day ${index + 1} · ${activity}`,
      items: [
        {
          id: `preview-day-${index + 1}-transport`,
          planItemId: "preview-local-transit",
          label: firstDay
            ? `Transfer: ${brief.origin} station → ${destination} station (${localTransport})`
            : `Local transport to ${activity}`,
          startsAt: `${date}T${firstDay ? "08:00" : "09:00"}:00Z`,
          endsAt: `${date}T${firstDay ? "11:00" : "10:00"}:00Z`,
          directionsUrl: mapsUrl(destination),
        },
        {
          id: `preview-day-${index + 1}-activity`,
          planItemId: "preview-activities",
          label: `Activity: ${activity} in ${destination}`,
          startsAt: `${date}T${firstDay ? "15:00" : "10:30"}:00Z`,
          endsAt: `${date}T${firstDay ? "17:00" : "13:00"}:00Z`,
          directionsUrl: mapsUrl(`${activity}, ${destination}`),
        },
        {
          id: `preview-day-${index + 1}-food`,
          planItemId: "preview-food",
          label: `Food: local restaurants or groceries near your stay`,
          startsAt: `${date}T18:00:00Z`,
          endsAt: `${date}T19:30:00Z`,
          directionsUrl: mapsUrl(`restaurants near ${destination}`),
        },
      ],
    };
  });
}

export function buildSimulatedTrip(brief: TripBrief): TripPlan {
  const destination = brief.destination?.trim() || "a flexible destination";
  const days = dayCount(brief.startDate, brief.endDate);
  const travelerCount = Math.max(brief.travelers.length, 1);
  const submittedBudget = Number(brief.strictBudget?.amount ?? brief.budget?.amount ?? 0);
  const planningBudget = submittedBudget > 0
    ? submittedBudget
    : Math.max(1200, days * 180 * travelerCount);
  const currency = brief.currency ?? brief.budget?.currency ?? brief.strictBudget?.currency ?? "SEK";
  const previewBrief: TripBrief = submittedBudget > 0 ? brief : { ...brief, strictBudget: undefined };
  const amounts = Object.fromEntries(categoryRatios.map(([category, ratio]) => [
    category,
    money(String(planningBudget * ratio * 0.8), currency).amount,
  ])) as Record<CostCategory, string>;
  const activity = brief.interests[0] || brief.spendingPreference || "local highlights";
  const stay = brief.accommodationType || "budget stay";
  const localTransport = brief.transitTolerance === "direct" ? "direct transfer" : "public transport or walking";

  const items = [
    item(
      "preview-transport",
      "travel",
      `Transport: ${brief.origin} → ${destination}`,
      alternative("preview-transport-option", `${brief.transitTolerance === "overnight" ? "overnight" : "flexible"} route from ${brief.origin} to ${destination}`, "transport", amounts.transport, brief, currency, [
        { label: "Route", value: `${brief.origin} station → ${destination} station` },
        { label: "Travelers", value: `${travelerCount}` },
        { label: "Timing", value: "Departure and arrival times to confirm when live search is enabled" },
        { label: "Duration", value: "Estimated from the selected route preference" },
      ]),
      true,
    ),
    item(
      "preview-stay",
      "stay",
      `Stay: ${stay} in ${destination}`,
      alternative(`${"preview-stay"}-option`, `${stay} near the main attractions`, "stay", amounts.stay, brief, currency, [
        { label: "City", value: destination },
        { label: "Accommodation", value: stay },
        { label: "Duration", value: `${days} night${days === 1 ? "" : "s"}` },
        { label: "Rate", value: "Estimated nightly share" },
      ]),
    ),
    item(
      "preview-food",
      "food",
      `Food near your stay in ${destination}`,
      alternative("preview-food-option", `Supermarkets and local restaurants around ${destination}`, "food", amounts.food, brief, currency, [
        { label: "City", value: destination },
        { label: "Suggestions", value: "Nearby supermarket and restaurant search" },
        { label: "Preference", value: brief.spendingPreference === "food" ? "Spend more on food" : "Balanced food allowance" },
        { label: "Distance", value: "Choose places within a short walk of the stay" },
      ]),
    ),
    item(
      "preview-activities",
      "days",
      `Activities matching ${activity} in ${destination}`,
      alternative("preview-activities-option", `${activity} and local attractions`, "activities", amounts.activities, brief, currency, [
        { label: "City", value: destination },
        { label: "Focus", value: brief.interests.length ? brief.interests.join(", ") : "Local highlights" },
        { label: "Plan", value: "One main activity plus flexible time each day" },
      ]),
    ),
    item(
      "preview-local-transit",
      "travel",
      `Local transport in ${destination}`,
      alternative("preview-local-transit-option", localTransport, "local-transit", amounts["local-transit"], brief, currency, [
        { label: "City", value: destination },
        { label: "Mode", value: localTransport },
        { label: "Price", value: "Estimated per-person local allowance" },
        { label: "Transfers", value: "Included in each day’s preview route" },
      ]),
    ),
  ];

  return {
    id: `preview-${brief.origin.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
    title: `${brief.origin} to ${destination} travel plan`,
    currency,
    brief: previewBrief,
    items,
    days: itinerary(brief, destination, days, activity, localTransport),
    completeSections: ["overview", "travel", "stay", "days", "food", "budget", "checks"],
    contingencyRate: "0.10",
  };
}
