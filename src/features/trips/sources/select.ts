import Decimal from "decimal.js";
import type { TripBrief } from "@/features/trips/domain/trip";
import type {
  SourceLocalTransportOption,
  SourcePlaceOption,
  SourceStayOption,
  SourceTransportOption,
  SourceOptionBase,
  TripSourceSnapshot,
} from "./types";

export type {
  SourceLocalTransportOption,
  SourcePlaceOption,
  SourceStayOption,
  SourceTransportOption,
  TripSourceSnapshot,
} from "./types";

type EligibleSourceOption = SourceOptionBase & {
  durationMins?: number;
  transfers?: number;
};

export function selectCheapestEligible<T extends EligibleSourceOption>(
  options: T[],
  brief: TripBrief,
): T | undefined {
  const eligible = options
    .filter(hasFiniteDecimalTotal)
    .filter((option) =>
      brief.travelers.every((traveler) => option.travelerIds.includes(traveler.id)),
    );

  return eligible.sort(compareEligibleOptions)[0];
}

function compareEligibleOptions(left: EligibleSourceOption, right: EligibleSourceOption) {
  const total = compareDecimal(left.total, right.total);
  if (total !== 0) return total;

  const duration = compareOptionalNumbers(left.durationMins, right.durationMins);
  if (duration !== 0) return duration;

  const transfers = compareOptionalNumbers(left.transfers, right.transfers);
  if (transfers !== 0) return transfers;

  return compareLexical(left.id, right.id);
}

function compareOptionalNumbers(left?: number, right?: number) {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return left - right;
}

function compareLexical(left: string, right: string) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function hasFiniteDecimalTotal<T extends EligibleSourceOption>(option: T): option is T {
  return parseFiniteDecimal(option.total) !== undefined;
}

function compareDecimal(left: string, right: string) {
  const leftValue = parseFiniteDecimal(left);
  const rightValue = parseFiniteDecimal(right);
  if (leftValue && rightValue) return leftValue.cmp(rightValue);
  if (leftValue) return -1;
  if (rightValue) return 1;
  return 0;
}

function parseFiniteDecimal(value: string): Decimal | undefined {
  try {
    const decimal = new Decimal(value);
    return decimal.isFinite() ? decimal : undefined;
  } catch {
    return undefined;
  }
}
