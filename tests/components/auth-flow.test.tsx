import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { buildSwitzerlandFamilyTrip } from "@/features/trips/fixtures/switzerland-family";

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

async function signIn(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Start planning" }));
  const dialog = screen.getByRole("dialog", { name: "Sign in to Spendwise Trip" });
  await user.type(within(dialog).getByRole("textbox", { name: "Email" }), "traveller@example.com");
  await user.type(within(dialog).getByLabelText("Password"), "demo-pass");
  await user.click(within(dialog).getByRole("button", { name: "Sign in" }));
}

async function reachReview(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole("textbox", { name: "Origin" }), "Lund");
  await user.type(screen.getByRole("textbox", { name: "Destination" }), "France");
  await user.click(screen.getByRole("button", { name: "Next: travelers & budget" }));
  await user.click(screen.getByRole("button", { name: "Next: priorities" }));
  await user.click(screen.getByRole("button", { name: "Review trip" }));
}

describe("planner access", () => {
  it("opens the seeded demo travel plan without calling the AI provider", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<Home />);

    await user.click(screen.getByRole("button", { name: "View demo trip" }));

    expect(screen.getByRole("main", { name: "Spendwise AI trip workspace" })).toBeVisible();
    expect(screen.getByRole("heading", { name: /Basel to Bernese Oberland travel plan/i })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Transportation" }));
    expect(screen.getByText("Basel to Interlaken rail schedule")).toBeVisible();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("resets the page scroll when authentication opens the input pages", async () => {
    const user = userEvent.setup();
    render(<Home />);
    document.documentElement.scrollTop = 24;

    await signIn(user);

    expect(document.documentElement.scrollTop).toBe(0);
  });

  it("keeps input pages locked until sign in succeeds", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByRole("button", { name: "Start planning" }));

    expect(screen.getByRole("dialog", { name: "Sign in to Spendwise Trip" })).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Origin" })).not.toBeInTheDocument();

    const dialog = screen.getByRole("dialog", { name: "Sign in to Spendwise Trip" });
    await user.type(within(dialog).getByRole("textbox", { name: "Email" }), "traveller@example.com");
    await user.type(within(dialog).getByLabelText("Password"), "demo-pass");
    await user.click(within(dialog).getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("heading", { name: "Where to?" })).toBeVisible();
    const navigation = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(navigation).getByRole("button", { name: "Signed in as traveller@example.com. Open account menu" })).toHaveTextContent("T");
    expect(within(navigation).queryByText("traveller@example.com")).not.toBeInTheDocument();
    expect(within(navigation).queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  it("clears the email field before authentication is reopened", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await signIn(user);
    await user.click(screen.getByRole("button", { name: "Signed in as traveller@example.com. Open account menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("");
  });

  it("allows account creation to unlock the input pages", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await user.click(screen.getByRole("tab", { name: "Sign up" }));
    await user.type(screen.getByRole("textbox", { name: "Full name" }), "Alex Rivera");
    await user.type(screen.getByRole("textbox", { name: "Email" }), "alex@example.com");
    await user.type(screen.getByLabelText("Password"), "demo-pass");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await user.click(screen.getByRole("button", { name: "Start planning" }));

    expect(screen.getByRole("heading", { name: "Where to?" })).toBeVisible();
  });

  it("opens the reviewed trip after one AI request", async () => {
    const user = userEvent.setup();
    const plan = buildSwitzerlandFamilyTrip();
    plan.brief.origin = "Lund";
    plan.brief.destination = "France";
    plan.title = "Lund to France travel plan";
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ plan, retrievedAt: "2026-08-31T08:00:00.000Z", providerId: "openrouter-free" }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    render(<Home />);

    await signIn(user);
    await reachReview(user);

    expect(screen.getByRole("heading", { name: "Your trip, in the making." })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Generate travel plan" }));

    expect(await screen.findByRole("main", { name: "Spendwise AI trip workspace" })).toBeVisible();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(within(screen.getByRole("navigation", { name: "Primary navigation" })).getByText("AI plan")).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  });

  it("shows the overload state when the single AI request is unavailable", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "AI model is overloaded. Try again later." }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    render(<Home />);

    await signIn(user);
    await reachReview(user);
    await user.click(screen.getByRole("button", { name: "Generate travel plan" }));

    expect(await screen.findByRole("main", { name: "AI travel plan unavailable" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "AI model is overloaded. Try again later." })).toBeVisible();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
