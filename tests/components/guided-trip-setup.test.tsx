import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuidedTripSetup } from "@/features/trips/components/guided-trip-setup";

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("GuidedTripSetup", () => {
  it("defaults dates and budget to today and zero", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T12:00:00+02:00"));
    render(<GuidedTripSetup onSubmit={vi.fn()} />);

    expect(screen.getByLabelText("Start date")).toHaveValue("2026-09-02");
    expect(screen.getByLabelText("End date")).toHaveValue("2026-09-02");
    cleanup();
    render(<GuidedTripSetup onSubmit={vi.fn()} initialStep={1} />);
    expect(screen.getByRole("spinbutton", { name: "Budget" })).toHaveValue(0);
    expect(screen.getByRole("spinbutton", { name: "Budget" })).toHaveAttribute("placeholder", "0");
    expect(screen.getByRole("combobox", { name: "Currency" })).toHaveValue("SEK");
  });

  it("clears the zero budget on focus and restores it when left empty", async () => {
    const user = userEvent.setup();
    render(<GuidedTripSetup onSubmit={vi.fn()} initialStep={1} />);

    const budget = screen.getByRole("spinbutton", { name: "Budget" });
    await user.click(budget);
    expect(budget).toHaveValue(null);

    await user.tab();
    expect(budget).toHaveValue(0);
  });

  it("keeps the end date on or after the selected start date", () => {
    render(<GuidedTripSetup onSubmit={vi.fn()} />);

    const startDate = screen.getByLabelText("Start date");
    const endDate = screen.getByLabelText("End date");
    fireEvent.change(startDate, { target: { value: "2026-09-10" } });

    expect(endDate).toHaveAttribute("min", "2026-09-10");
    expect(endDate).toHaveValue("2026-09-10");
  });

  it("removes a child and keeps the remaining child age", async () => {
    const user = userEvent.setup();
    render(<GuidedTripSetup onSubmit={vi.fn()} />);

    await user.type(screen.getByRole("textbox", { name: "Origin" }), "Lund");
    await user.click(screen.getByRole("button", { name: "Next: travelers & budget" }));
    await user.click(screen.getByRole("button", { name: "Add a child" }));
    await user.click(screen.getByRole("button", { name: "Add a child" }));
    await user.clear(screen.getByLabelText("Child 2 age"));
    await user.type(screen.getByLabelText("Child 2 age"), "7");

    await user.click(screen.getByRole("button", { name: "Remove child 1" }));

    expect(screen.getByLabelText("Child 1 age")).toHaveValue(7);
    expect(screen.queryByLabelText("Child 2 age")).not.toBeInTheDocument();
  });

  it("moves through focused pages and submits the complete brief from review", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<GuidedTripSetup onSubmit={onSubmit} />);

    expect(screen.getByRole("heading", { name: "Where to?" })).toBeVisible();
    await user.type(screen.getByRole("textbox", { name: "Origin" }), "Lund");
    await user.type(screen.getByRole("textbox", { name: "Destination" }), "France");
    await user.click(screen.getByRole("button", { name: "Next: travelers & budget" }));

    expect(screen.getByRole("heading", { name: "Who’s coming?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add a child" }));
    await user.clear(screen.getByLabelText("Child 1 age"));
    await user.type(screen.getByLabelText("Child 1 age"), "10");
    await user.type(screen.getByRole("spinbutton", { name: "Budget" }), "16000");
    await user.selectOptions(screen.getByRole("combobox", { name: "Currency" }), "EUR");
    await user.click(screen.getByRole("button", { name: "Next: priorities" }));

    expect(screen.getByRole("heading", { name: "What matters most?" })).toBeVisible();
    await user.click(screen.getByRole("radio", { name: "Activities" }));
    document.documentElement.scrollTop = 157;
    await user.click(screen.getByRole("button", { name: "Review trip" }));

    expect(screen.getByRole("heading", { name: "Your trip, in the making." })).toBeVisible();
    expect(document.documentElement.scrollTop).toBe(0);
    expect(screen.getByText("Lund → France")).toBeVisible();
    expect(screen.getByText("Spendwise will make one AI request and validate the result before building your plan.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Generate travel plan" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      origin: "Lund",
      destination: "France",
      currency: "EUR",
      budget: { amount: "16000.00", currency: "EUR" },
      spendingPreference: "activities",
      travelers: expect.arrayContaining([
        expect.objectContaining({ name: "Adult" }),
        expect.objectContaining({ name: "Child", age: 10 }),
      ]),
    }));
  });

  it("shows a disabled generation state while the AI plan is being created", () => {
    render(<GuidedTripSetup onSubmit={vi.fn()} busy initialStep={3} />);

    expect(screen.getByRole("button", { name: "Generating plan…" })).toBeDisabled();
  });
});
