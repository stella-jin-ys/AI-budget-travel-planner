import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LaunchScreen } from "@/features/trips/components/launch-screen";

afterEach(cleanup);

describe("LaunchScreen", () => {
  it("uses the shared navigation sign-in action", async () => {
    const user = userEvent.setup();
    const onRequestAuth = vi.fn();

    render(<LaunchScreen onStart={vi.fn()} navigation={{ onRequestAuth }} />);

    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(onRequestAuth).toHaveBeenCalledOnce();
  });

  it("starts planning from the intro and explains the three-step flow", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();

    render(<LaunchScreen onStart={onStart} />);

    expect(screen.getByRole("heading", { name: /travel further.*without overspending/i })).toBeVisible();
    expect(screen.getByRole("img", { name: "Budget Trip logo" })).toHaveAttribute("src", expect.stringContaining("spendwise-butterfly-logo-icon-transparent.png"));
    expect(screen.getByRole("img", { name: "Budget Trip logo" })).toHaveAttribute("sizes", "24px");
    expect(screen.getByText("Budget", { selector: ".spendwise-logo__name" })).toBeVisible();
    expect(screen.getByText("TRIP", { selector: ".spendwise-logo__trip" })).toBeVisible();
    expect(screen.getByText("Tell us where you’re starting, who’s coming, and what matters most.")).toBeVisible();
    expect(screen.getByRole("list", { name: "How it works" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Start planning" }));
    expect(onStart).toHaveBeenCalledOnce();
  });
});
