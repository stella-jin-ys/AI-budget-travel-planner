import { describe, expect, it } from "vitest";
import type { TripBrief } from "@/features/trips/domain/trip";
import {
  selectCheapestEligible,
  type SourceTransportOption,
} from "@/features/trips/sources/select";

const brief: TripBrief = {
  mode: "known-destination",
  origin: "Geneva",
  destination: "Zurich",
  startDate: "2026-09-14",
  endDate: "2026-09-18",
  travelers: [
    { id: "adult-1", name: "Adult", age: 35, eligibility: ["adult"] },
    { id: "child-1", name: "Child", age: 8, eligibility: ["child", "family"] },
  ],
  interests: [],
};

function transport(
  id: string,
  total: string,
  travelerIds: string[],
  details: Pick<SourceTransportOption, "durationMins" | "transfers"> = {},
): SourceTransportOption {
  return {
    id,
    kind: "transport",
    supplierName: "Supplier",
    currency: "CHF",
    total,
    sourceUrl: "https://example.com",
    checkedAt: "2026-09-08T00:00:00.000Z",
    status: "live",
    travelerIds,
    ...details,
  };
}

describe("selectCheapestEligible", () => {
  it("selects the cheapest valid transport for all travelers", () => {
    const selected = selectCheapestEligible(
      [
        transport("cheap", "40.00", ["adult-1", "child-1"]),
        transport("expensive", "80.00", ["adult-1", "child-1"]),
      ],
      brief,
    );

    expect(selected?.id).toBe("cheap");
  });

  it("returns undefined when no option covers every traveler", () => {
    const selected = selectCheapestEligible(
      [transport("adult-only", "1.00", ["adult-1"])],
      brief,
    );

    expect(selected).toBeUndefined();
  });

  it("ignores an option that does not cover every traveler", () => {
    const selected = selectCheapestEligible(
      [
        transport("adult-only", "1.00", ["adult-1"]),
        transport("family", "40.00", ["adult-1", "child-1"]),
      ],
      brief,
    );

    expect(selected?.id).toBe("family");
  });

  it("prefers a known duration over an unknown one when totals tie", () => {
    const selected = selectCheapestEligible(
      [
        transport("missing-duration", "40.00", ["adult-1", "child-1"]),
        transport("known-duration", "40.00", ["adult-1", "child-1"], {
          durationMins: 30,
        }),
      ],
      brief,
    );

    expect(selected?.id).toBe("known-duration");
  });

  it("prefers the lower duration when durations tie", () => {
    const selected = selectCheapestEligible(
      [
        transport("longer", "40.00", ["adult-1", "child-1"], {
          durationMins: 45,
        }),
        transport("shorter", "40.00", ["adult-1", "child-1"], {
          durationMins: 30,
        }),
      ],
      brief,
    );

    expect(selected?.id).toBe("shorter");
  });

  it("prefers a known transfer count over an unknown one when duration ties", () => {
    const selected = selectCheapestEligible(
      [
        transport("missing-transfers", "40.00", ["adult-1", "child-1"], {
          durationMins: 30,
        }),
        transport("known-transfers", "40.00", ["adult-1", "child-1"], {
          durationMins: 30,
          transfers: 1,
        }),
      ],
      brief,
    );

    expect(selected?.id).toBe("known-transfers");
  });

  it("prefers the lower transfer count when transfer counts tie", () => {
    const selected = selectCheapestEligible(
      [
        transport("more-transfers", "40.00", ["adult-1", "child-1"], {
          durationMins: 30,
          transfers: 2,
        }),
        transport("fewer-transfers", "40.00", ["adult-1", "child-1"], {
          durationMins: 30,
          transfers: 1,
        }),
      ],
      brief,
    );

    expect(selected?.id).toBe("fewer-transfers");
  });

  it("prefers the lexical id when totals, duration, and transfer counts tie", () => {
    const selected = selectCheapestEligible(
      [
        transport("zulu", "40.00", ["adult-1", "child-1"], {
          durationMins: 30,
          transfers: 1,
        }),
        transport("alpha", "40.00", ["adult-1", "child-1"], {
          durationMins: 30,
          transfers: 1,
        }),
      ],
      brief,
    );

    expect(selected?.id).toBe("alpha");
  });

  it("skips invalid decimal totals without throwing", () => {
    const selected = selectCheapestEligible(
      [
        transport("invalid", "not-a-number", ["adult-1", "child-1"]),
        transport("valid", "40.00", ["adult-1", "child-1"]),
      ],
      brief,
    );

    expect(selected?.id).toBe("valid");
  });

  it("skips non-finite decimal totals without throwing", () => {
    const selected = selectCheapestEligible(
      [
        transport("nan", "NaN", ["adult-1", "child-1"]),
        transport("infinity", "Infinity", ["adult-1", "child-1"]),
        transport("valid", "40.00", ["adult-1", "child-1"]),
      ],
      brief,
    );

    expect(selected?.id).toBe("valid");
  });
});
