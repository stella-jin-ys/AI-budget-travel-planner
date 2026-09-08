"use client";

import { useEffect, useState, type ReactNode } from "react";
import { money } from "../domain/money";
import type { Traveler, TripBrief } from "../domain/trip";
import { AppNav, type AppNavProps } from "./app-nav";

type GuidedTripSetupProps = { onSubmit: (brief: TripBrief) => void; busy?: boolean; navigation?: AppNavProps; initialStep?: number; initialBrief?: TripBrief };
type Priority = NonNullable<TripBrief["spendingPreference"]>;

const steps = ["Destination", "Travelers & budget", "Priorities", "Review"];

function today() {
  const current = new Date();
  return [current.getFullYear(), current.getMonth() + 1, current.getDate()]
    .map((part, index) => index === 0 ? String(part) : String(part).padStart(2, "0"))
    .join("-");
}

export function GuidedTripSetup({ onSubmit, busy = false, navigation, initialStep = 0, initialBrief }: GuidedTripSetupProps) {
  const [step, setStep] = useState(initialStep);
  const [origin, setOrigin] = useState(initialBrief?.origin ?? "");
  const [destination, setDestination] = useState(initialBrief?.destination ?? "");
  const [startDate, setStartDate] = useState(initialBrief?.startDate ?? today());
  const [endDate, setEndDate] = useState(initialBrief?.endDate ?? today());
  const [adults, setAdults] = useState(initialBrief?.travelers.filter((traveler) => !traveler.eligibility.includes("child")).length || 1);
  const [childAges, setChildAges] = useState<number[]>(initialBrief?.travelers.filter((traveler) => traveler.eligibility.includes("child")).map((traveler) => traveler.age) ?? []);
  const [currency, setCurrency] = useState(initialBrief?.budget?.currency ?? initialBrief?.currency ?? "SEK");
  const [budget, setBudget] = useState(initialBrief?.budget?.amount ?? "0");
  const [priority, setPriority] = useState<Priority>(initialBrief?.spendingPreference ?? "balanced");
  const [accommodationType, setAccommodationType] = useState<NonNullable<TripBrief["accommodationType"]>>(initialBrief?.accommodationType ?? "hotel");
  const [transitTolerance, setTransitTolerance] = useState<NonNullable<TripBrief["transitTolerance"]>>(initialBrief?.transitTolerance ?? "flexible");

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [step]);

  const routeReady = Boolean(origin.trim() && (destination.trim() || step < 2) && startDate && endDate && endDate >= startDate);
  const budgetValid = !budget || /^\d+(?:\.\d{1,2})?$/.test(budget);
  const canContinue = step === 0 ? routeReady : step === 1 ? budgetValid : true;

  function addChild() {
    setChildAges((current) => [...current, 10]);
  }

  function removeChild(index: number) {
    setChildAges((current) => current.filter((_, childIndex) => childIndex !== index));
  }

  function buildBrief(): TripBrief {
    return {
      mode: "known-destination",
      origin: origin.trim(),
      destination: destination.trim() || undefined,
      startDate,
      endDate,
      travelers: [
        ...Array.from({ length: adults }, (_, index) => ({
          id: `adult-${index + 1}`,
          name: index === 0 ? "Adult" : `Traveller ${index + 1}`,
          age: 35,
          eligibility: ["adult"] as Traveler["eligibility"],
        })),
        ...childAges.map((age, index) => ({
          id: `child-${index + 1}`,
          name: childAges.length === 1 ? "Child" : `Child ${index + 1}`,
          age,
          eligibility: ["child", "family"] as Traveler["eligibility"],
        })),
      ],
      interests: priority === "activities" ? ["activities"] : [],
      currency,
      purpose: priority === "activities" ? "activities" : undefined,
      budget: budget ? money(budget, currency) : undefined,
      budgetMode: "total",
      spendingPreference: priority,
      transitTolerance,
      accommodationType,
      strictBudget: budget ? money(budget, currency) : undefined,
    };
  }

  function submit() {
    if (!busy) onSubmit(buildBrief());
  }

  return (
    <main className="guided-setup" aria-labelledby="guided-title">
      <div className="guided-setup__backdrop" aria-hidden="true" />
      <AppNav {...navigation} context={`${step + 1} / ${steps.length}`} />
      <section className="guided-card">
        <div className="guided-progress" aria-label="Trip planning progress">
          {steps.map((label, index) => <span key={label} className={index <= step ? "is-active" : ""}>{index + 1}<b>{label}</b></span>)}
        </div>

        {step === 0 ? <Page title="Where to?" copy="Start with the place you’ve been dreaming about.">
          <div className="guided-fields guided-fields--route">
            <label><span>Origin</span><input aria-label="Origin" value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="e.g. Lund" autoFocus /></label>
            <label><span>Destination <small>(optional)</small></span><input aria-label="Destination" value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="France, Ski in the Alps…" /></label>
          </div>
          <div className="guided-fields guided-fields--dates">
            <label><span>Start date</span><input aria-label="Start date" type="date" value={startDate} placeholder={today()} onChange={(event) => { const nextStartDate = event.target.value; setStartDate(nextStartDate); if (nextStartDate && endDate < nextStartDate) setEndDate(nextStartDate); }} /></label>
            <label><span>End date</span><input aria-label="End date" type="date" min={startDate || undefined} value={endDate} placeholder={today()} onChange={(event) => setEndDate(event.target.value)} /></label>
          </div>
        </Page> : null}

        {step === 1 ? <Page title="Who’s coming?" copy="We’ll use this to find fares and stays that fit everyone.">
          <div className="traveler-row"><span>Adults</span><div className="stepper"><button type="button" aria-label="Remove adult" onClick={() => setAdults(Math.max(1, adults - 1))}>−</button><strong>{adults}</strong><button type="button" aria-label="Add adult" onClick={() => setAdults(adults + 1)}>+</button></div></div>
          <div className="traveler-row"><span>Children</span><button type="button" className="ghost-action" onClick={addChild}>Add a child <span aria-hidden="true">+</span></button></div>
          <div className="child-age-list">{childAges.map((age, index) => <div className="child-age-row" key={index}><label className="child-age-field"><span>Child {index + 1} age</span><input aria-label={`Child ${index + 1} age`} type="number" min="0" max="17" value={age} onChange={(event) => setChildAges((current) => current.map((value, childIndex) => childIndex === index ? Number(event.target.value) : value))} /></label><button type="button" className="child-remove-action" aria-label={`Remove child ${index + 1}`} onClick={() => removeChild(index)}>×</button></div>)}</div>
          <label className="budget-field"><span>Total trip budget</span><div className="budget-field__controls"><input aria-label="Budget" type="number" inputMode="decimal" value={budget} onFocus={() => { if (!budget || Number(budget) === 0) setBudget(""); }} onBlur={() => { if (!budget) setBudget("0"); }} onChange={(event) => setBudget(event.target.value)} placeholder="0" /><select aria-label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="CHF">CHF · Swiss franc</option><option value="EUR">EUR · Euro</option><option value="GBP">GBP · Pound sterling</option><option value="SEK">SEK · Swedish krona</option></select></div></label>
        </Page> : null}

        {step === 2 ? <Page title="What matters most?" copy="Your priority helps us make the right trade-offs for your budget.">
          <fieldset className="guided-choice-group"><legend>Spend more on</legend>{(["balanced", "activities", "stays", "food"] as const).map((value) => <label key={value} className={priority === value ? "is-selected" : ""}><input type="radio" name="priority" value={value} checked={priority === value} onChange={() => setPriority(value)} /><span>{value === "balanced" ? "Keep it balanced" : value[0].toUpperCase() + value.slice(1)}</span></label>)}</fieldset>
          <label className="guided-select"><span>Stay preference</span><select value={accommodationType} onChange={(event) => setAccommodationType(event.target.value as typeof accommodationType)}><option value="hotel">Hotel</option><option value="hostel">Hostel</option><option value="apartment">Apartment</option><option value="camping">Camping</option></select></label>
          <label className="guided-select"><span>Travel time</span><select value={transitTolerance} onChange={(event) => setTransitTolerance(event.target.value as typeof transitTolerance)}><option value="direct">Prefer the fastest route</option><option value="flexible">Open to longer routes to save</option><option value="overnight">Open to overnight buses</option></select></label>
        </Page> : null}

        {step === 3 ? <Page title="Your trip, in the making." copy="Review your choices before opening the saved travel plan.">
          <dl className="trip-review"><div><dt>Destination</dt><dd>{origin} → {destination || "Flexible destination"}</dd></div><div><dt>Dates</dt><dd>{startDate} – {endDate}</dd></div><div><dt>Travelers</dt><dd>{adults} adult{adults === 1 ? "" : "s"}{childAges.length ? ` · ${childAges.length} child` : ""}</dd></div><div><dt>Budget</dt><dd>{budget ? `${Number(budget).toLocaleString("sv-SE")} ${currency}` : "Flexible"}</dd></div><div><dt>Priority</dt><dd>{priority === "balanced" ? "Balanced spending" : priority[0].toUpperCase() + priority.slice(1)}</dd></div></dl>
          <p className="guided-demo-note">Spendwise will make one AI request and validate the result before building your plan.</p>
        </Page> : null}

        <div className="guided-actions">
          {step > 0 ? <button type="button" className="guided-back" onClick={() => setStep(step - 1)}>Back</button> : <span />}
          {step < steps.length - 1 ? <button type="button" className="guided-next" disabled={!canContinue} onClick={() => setStep(step + 1)}>{step === 2 ? "Review trip" : `Next: ${steps[step + 1].toLowerCase()}`} <span aria-hidden="true">→</span></button> : <button type="button" className="guided-next" disabled={busy} onClick={submit}>{busy ? "Generating plan…" : "Generate travel plan"} <span aria-hidden="true">↗</span></button>}
        </div>
      </section>
    </main>
  );
}

function Page({ title, copy, children }: { title: string; copy: string; children: ReactNode }) {
  return <section className="guided-page"><p className="guided-kicker">WanderBudget</p><h1 id="guided-title">{title}</h1><p className="guided-copy">{copy}</p>{children}</section>;
}
