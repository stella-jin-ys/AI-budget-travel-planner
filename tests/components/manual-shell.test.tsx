import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManualShell } from "@/features/trips/components/manual-shell";
import { SectionTabs } from "@/features/trips/components/section-tabs";
import { SourceBadge } from "@/features/trips/components/source-badge";
import { createWorkspace } from "@/features/trips/state/trip-reducer";
import { makeTripPlan } from "../support/make-trip-plan";

afterEach(cleanup);

describe("SectionTabs", () => {
  it("names the tab list and exposes the selected section", () => {
    render(<SectionTabs active="travel" onChange={() => undefined} />);

    expect(screen.getByRole("tablist", { name: "Trip sections" })).toBeVisible();
    expect(screen.getByRole("tablist", { name: "Trip sections" })).not.toHaveAttribute(
      "aria-orientation",
      "vertical",
    );
    expect(screen.getByRole("tab", { name: "Travel" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("reports a selected section when its tab is activated", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SectionTabs active="overview" onChange={onChange} />);

    await user.click(screen.getByRole("tab", { name: "Budget" }));

    expect(onChange).toHaveBeenCalledWith("budget");
  });

  it("moves focus and selection through tabs with arrow keys", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SectionTabs active="overview" onChange={onChange} />);

    const overview = screen.getByRole("tab", { name: "Overview" });
    const travel = screen.getByRole("tab", { name: "Travel" });
    overview.focus();
    await user.keyboard("{ArrowDown}");

    expect(travel).toHaveFocus();
    expect(onChange).toHaveBeenCalledWith("travel");
  });
});

describe("ManualShell", () => {
  it("does not render a duplicate mobile header below the navigation", () => {
    const state = createWorkspace(makeTripPlan());
    render(
      <ManualShell
        state={state}
        leaf={<h1>Trip overview</h1>}
      />,
    );

    expect(screen.queryByRole("banner", { name: "Mobile trip summary" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit brief" })).not.toBeInTheDocument();
  });

  it("keeps the mobile status summary readable without a tab rail", () => {
    const state = createWorkspace(makeTripPlan());
    render(
      <ManualShell
        state={state}
        leaf={<h1>Trip overview</h1>}
      />,
    );

    expect(screen.queryByRole("banner", { name: "Trip status" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist", { name: "Trip sections" })).not.toBeInTheDocument();
  });

  it("labels the workspace regions and reports budget readiness in text", () => {
    const state = createWorkspace(makeTripPlan());
    render(
      <ManualShell
        state={state}
        leaf={<h1>Trip overview</h1>}
      />,
    );

    expect(screen.getByRole("main", { name: "Spendwise AI trip workspace" })).toBeVisible();
    expect(screen.queryByRole("complementary", { name: "Trip conversation" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Trip plan" })).toBeVisible();
    expect(screen.queryByText("Conversation")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Trip status")).not.toBeInTheDocument();
  });

  it("counts selected evidence checks and every unresolved issue", () => {
    const state = createWorkspace(makeTripPlan());
    const blockingIssue = {
      ...state.readiness.issues[0],
      severity: "blocking" as const,
    };
    render(
      <ManualShell
        state={{
          ...state,
          readiness: { state: "draft", issues: [blockingIssue] },
        }}
        leaf={<h1>Trip overview</h1>}
      />,
    );

    expect(screen.getByRole("main", { name: "Spendwise AI trip workspace" })).toBeVisible();
  });

  it("preserves exact decimal money with Swiss grouping and two fraction digits", () => {
    const state = createWorkspace(makeTripPlan());
    render(
      <ManualShell
        state={{
          ...state,
          budget: {
            ...state.budget,
            total: { amount: "9007199254740993.10", currency: "CHF" },
            perPerson: { amount: "0.10", currency: "CHF" },
          },
        }}
        leaf={<h1>Trip overview</h1>}
      />,
    );

    expect(screen.getByRole("main", { name: "Spendwise AI trip workspace" })).toBeVisible();
  });

  it("mounts one recommendation region instead of hidden tab panels", () => {
    const state = createWorkspace(makeTripPlan());
    render(
      <ManualShell
        state={state}
        leaf={<h1>Trip overview</h1>}
      />,
    );

    expect(screen.getAllByRole("region", { name: "Trip plan" })).toHaveLength(1);
    expect(screen.queryByRole("tabpanel")).not.toBeInTheDocument();
  });
});

describe("SourceBadge", () => {
  it.each([
    ["live", "Live source"],
    ["recent", "Recent estimate"],
    ["typical", "Typical estimate"],
    ["stale", "Stale source"],
    ["conflicting", "Conflicting sources"],
    ["unavailable", "Source unavailable"],
    ["failed", "Source failed"],
  ] as const)("names the %s source status", (status, label) => {
    render(<SourceBadge status={status} />);

    expect(screen.getByText(label)).toBeVisible();
  });
});
