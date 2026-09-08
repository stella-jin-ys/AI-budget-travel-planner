import type { TripPlan } from "../domain/trip";
import { useTripWorkspace } from "../state/use-trip-workspace";
import { ManualShell } from "./manual-shell";
import { OverviewLeaf } from "./overview-leaf";
import { AppNav, type AppNavProps } from "./app-nav";

export function TripWorkspace({ initialPlan, onEditBrief, navigation }: { initialPlan: TripPlan; onEditBrief?: () => void; navigation?: AppNavProps }) {
  const { state, dispatch } = useTripWorkspace(initialPlan);

  return (
    <div className="workspace-with-nav">
      <AppNav {...navigation} context="AI plan" />
      <ManualShell
        state={state}
        leaf={<OverviewLeaf state={state} dispatch={dispatch} onEditBrief={onEditBrief} />}
      />
    </div>
  );
}
