import { createClient } from "@supabase/supabase-js";
import type { TripBrief, TripPlan } from "@/features/trips/domain/trip";
import type { TripSourceSnapshot } from "@/features/trips/sources/types";

const persistenceErrorMessage = "Supabase trip persistence failed";

export async function persistTripPlan(brief: TripBrief, plan: TripPlan, sourceSnapshot?: TripSourceSnapshot): Promise<boolean> {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return false;

  try {
    const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await supabase
      .from("trip_plans")
      .insert({ brief, plan, source_snapshot: sourceSnapshot ?? null, created_at: new Date().toISOString() });
    if (error) {
      console.error("Supabase trip persistence failed", error.message);
      throw new Error(persistenceErrorMessage);
    }
    return true;
  } catch (error) {
    console.error("Supabase trip persistence failed", error);
    if (error instanceof Error && error.message === persistenceErrorMessage) throw error;
    throw new Error(persistenceErrorMessage);
  }
}
