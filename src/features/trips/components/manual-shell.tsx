"use client";

import type { ReactNode } from "react";
import type { TripWorkspaceState } from "../state/trip-reducer";

export function ManualShell(props: {
  state: TripWorkspaceState;
  leaf: ReactNode;
}) {
  return (
    <main className="manual-shell" aria-label="Spendwise AI trip workspace">
      <section className="active-leaf" aria-label="Trip plan">
        {props.leaf}
      </section>
    </main>
  );
}
