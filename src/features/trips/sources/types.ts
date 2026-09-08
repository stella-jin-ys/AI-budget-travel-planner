import type { SourceStatus, TripBrief } from "@/features/trips/domain/trip";

export interface SourceOptionBase {
  id: string;
  supplierName: string;
  currency: string;
  total: string;
  sourceUrl?: string;
  checkedAt: string;
  status: SourceStatus;
  travelerIds: string[];
}

export interface SourceTransportOption extends SourceOptionBase {
  kind: "transport";
  departureAt?: string;
  arrivalAt?: string;
  durationMins?: number;
  transfers?: number;
}

export interface SourceStayOption extends SourceOptionBase {
  kind: "stay";
  checkInAt?: string;
  checkOutAt?: string;
  nights?: number;
}

export interface SourcePlaceOption extends SourceOptionBase {
  kind: "place";
  category?: string;
  startsAt?: string;
  endsAt?: string;
  durationMins?: number;
}

export interface SourceLocalTransportOption extends SourceOptionBase {
  kind: "local-transport";
  mode?: string;
  durationMins?: number;
  transfers?: number;
}

export interface TripSourceSnapshot {
  brief: TripBrief;
  checkedAt: string;
  providers: Array<{
    id: string;
    status: SourceStatus;
    message?: string;
  }>;
  transport: SourceTransportOption[];
  stays: SourceStayOption[];
  places: SourcePlaceOption[];
  localTransport: SourceLocalTransportOption[];
}
