"use client";
import Decimal from "decimal.js";
import { useState, type Dispatch } from "react";
import { formatMoney, money } from "../domain/money";
import { demoNow } from "../domain/readiness";
import type { CostCategory } from "../domain/trip";
import type { TripWorkspaceAction, TripWorkspaceState } from "../state/trip-reducer";
import { ErrataSlip } from "./errata-slip";
import { OptionRow } from "./option-row";
import { displayDemoCopy } from "./demo-copy";

const cards = [
  { id: "overview", label: "Overview", description: "Whole trip at a glance", categories: [] },
  { id: "transport", label: "Transportation", description: "Door to destination", categories: ["transport"] },
  { id: "stay", label: "Stay", description: "Nights and room", categories: ["stay"] },
  { id: "food", label: "Food", description: "Meals and groceries", categories: ["food"] },
  { id: "activities", label: "Activities", description: "Attractions and passes", categories: ["activities"] },
  { id: "local-transit", label: "Local transport", description: "Getting around", categories: ["local-transit"] },
  { id: "itinerary", label: "Itinerary", description: "Day by day", categories: [] },
] as const;
type CardId = (typeof cards)[number]["id"];

const budgetCategories = [
  { category: "transport", label: "Transportation", color: "#f18443" },
  { category: "stay", label: "Stay", color: "#267f6c" },
  { category: "food", label: "Food", color: "#f7b14c" },
  { category: "activities", label: "Activities", color: "#9b51e0" },
  { category: "local-transit", label: "Local transport", color: "#2bb9d6" },
] as const;

function totalFor(state: TripWorkspaceState, categories: readonly CostCategory[]) {
  const values = state.plan.items.flatMap((item) => {
    const option = item.alternatives.find((candidate) => candidate.id === item.selectedAlternativeId);
    return option && categories.includes(option.category) ? Object.values(option.travelerCosts) : [];
  });
  return values.length ? money(values.reduce((sum, value) => sum.plus(value.amount), new Decimal(0)).toFixed(2), values[0].currency) : null;
}

function priorityLabel(state: TripWorkspaceState) {
  const labels = {
    balanced: "Balanced spending",
    activities: "Activities",
    stays: "Stays",
    food: "Food",
  } as const;
  const preference = state.plan.brief.spendingPreference;
  return preference ? labels[preference] : "Balanced spending";
}

function BudgetChart({ state }: { state: TripWorkspaceState }) {
  const rows = budgetCategories.map((item) => ({
    ...item,
    amount: totalFor(state, [item.category]) ?? money("0", state.budget.total.currency),
  }));
  const total = rows.reduce((sum, row) => sum + Number(row.amount.amount), 0);
  let cursor = 0;
  const segments = rows.map((row) => {
    const start = cursor;
    cursor += total ? (Number(row.amount.amount) / total) * 100 : 0;
    return `${row.color} ${start}% ${cursor}%`;
  });
  const gradient = total ? `conic-gradient(${segments.join(", ")})` : "conic-gradient(#b8c5c0 0 100%)";
  const dayCount = Math.max(state.plan.days.length, 1);
  const dailyAllowance = money(new Decimal(state.budget.total.amount).div(dayCount).toFixed(2), state.budget.total.currency);

  return <div className="budget-chart">
    <div className="budget-chart__topline">
      <div className="budget-chart__visual" role="img" aria-label="Trip budget breakdown">
        <div className="budget-chart__donut" style={{ background: gradient }}>
          <div className="budget-chart__donut-center"><span>Trip budget</span><strong>{formatMoney(state.budget.total, "en-CH")}</strong></div>
        </div>
      </div>
      <ul className="budget-chart__legend" aria-label="Budget categories">
        {rows.map((row) => <li key={row.category}><span style={{ background: row.color }} aria-hidden="true" /><span>{row.label}</span><strong>{formatMoney(row.amount, "en-CH")}</strong></li>)}
      </ul>
    </div>
    <dl className="budget-chart__metrics">
      <div><dt>Daily allowance</dt><dd>{formatMoney(dailyAllowance, "en-CH")} / day</dd></div>
      <div><dt>Trip duration</dt><dd>{state.plan.days.length} days</dd></div>
      <div><dt>Travelers</dt><dd>{state.plan.brief.travelers.length}</dd></div>
    </dl>
  </div>;
}

function CardDetails({ card, state, dispatch }: { card: (typeof cards)[number]; state: TripWorkspaceState; dispatch: Dispatch<TripWorkspaceAction> }) {
  if (card.id === "overview") return <div className="overview-card__details">
    <div className="overview-brief">
      <h3>Trip brief</h3>
      <dl>
        <div><dt>Route</dt><dd>{state.plan.brief.origin} → {state.plan.brief.destination ?? "Flexible destination"}</dd></div>
        <div><dt>Dates</dt><dd>{state.plan.brief.startDate} – {state.plan.brief.endDate}</dd></div>
        <div><dt>Travelers</dt><dd>{state.plan.brief.travelers.length}</dd></div>
        <div><dt>Priority</dt><dd>{priorityLabel(state)}</dd></div>
        <div><dt>Total cost</dt><dd>{formatMoney(state.budget.total, "en-CH")}</dd></div>
      </dl>
    </div>
    <p>Review recommendations below, then choose a category card to inspect sources, freshness, warnings, and supplier links.</p>
  </div>;
  if (card.id === "itinerary") return <div className="overview-card__details overview-card__itinerary">{state.plan.days.map((day) => <section className="itinerary-day" key={day.id}><div><b>{day.title}</b><time dateTime={day.date}>{day.date}</time></div><ul>{day.items.map((entry) => <li key={entry.id}><time dateTime={entry.startsAt}>{entry.startsAt.slice(11, 16)}</time><span>{entry.label}</span></li>)}</ul></section>)}</div>;
  const detailItems = state.plan.items.filter((item) => item.alternatives.some((option) => option.id === item.selectedAlternativeId && (option.category === card.id || item.section === card.id)));
  const suppliers = detailItems.flatMap((item) => item.alternatives.map((option) => option.evidence.supplierName)).filter(Boolean).map(displayDemoCopy).join(", ");
  return <div className="overview-card__details"><p className="overview-details__source">Supplier source: {suppliers || "No supplier source provided"}</p>{detailItems.length ? detailItems.map((item) => <div className="overview-detail-item" key={item.id}><OptionRow item={item} alternatives={item.alternatives} locked={state.lockedItemIds.includes(item.id)} onReplace={(alternativeId) => dispatch({ type: "replace-option", itemId: item.id, alternativeId })} onToggleLock={() => dispatch({ type: "toggle-lock", itemId: item.id })} showControls={false} />{state.readiness.issues.filter((issue) => issue.itemId === item.id).map((issue, index) => <ErrataSlip issue={issue} now={demoNow} key={`${issue.itemId}-${issue.status}-${index}`} />)}</div>) : <p>No selected items in this section yet.</p>}</div>;
}

function CardGrid({ state, selectedCard, onSelect, dispatch }: { state: TripWorkspaceState; selectedCard: CardId | null; onSelect: (card: CardId) => void; dispatch: Dispatch<TripWorkspaceAction> }) {
  return <section className="overview-card-grid" aria-label="Plan sections">{cards.map((card) => { const total = card.id === "overview" || card.id === "itinerary" ? null : totalFor(state, card.categories); const selected = selectedCard === card.id; return <article className={`overview-card${selected ? " is-selected" : ""}`} key={card.id}><button type="button" aria-label={card.label} className="overview-card__trigger" aria-expanded={selected} onClick={() => onSelect(card.id)}><span className="overview-card__label">{card.label}</span><small>{card.description}</small><strong className="overview-card__cost">{total ? formatMoney(total, "en-CH") : card.id === "itinerary" ? `${state.plan.days.length} days` : card.id === "overview" ? "Summary" : "Included"}</strong><span className="overview-card__hint" aria-hidden="true">{selected ? "−" : "+"}</span></button>{selected ? <CardDetails card={card} state={state} dispatch={dispatch} /> : null}</article>; })}</section>;
}

export function OverviewLeaf({ state, dispatch, onEditBrief }: { state: TripWorkspaceState; dispatch: Dispatch<TripWorkspaceAction>; onEditBrief?: () => void }) {
  const [selectedCard, setSelectedCard] = useState<CardId | null>("overview");
  const toggleCard = (card: CardId) => setSelectedCard((current) => current === card ? null : card);
  const destination = state.plan.brief.destination ?? "Flexible destination";
  return <div className="workspace-leaf">
    <section className="recommendations-intro trip-plan-summary-card" aria-label="Trip plan summary">
      <div className="prism-hero"><div><h2 className="prism-plan-title">{state.plan.brief.origin} to {destination} travel plan</h2><p>Choose a card to inspect recommendations, cost, sources, and any checks.</p></div>{onEditBrief ? <button type="button" className="chat-edit" onClick={onEditBrief}>Edit brief</button> : null}</div>
      <BudgetChart state={state} />
    </section>
    <CardGrid state={state} selectedCard={selectedCard} onSelect={toggleCard} dispatch={dispatch} />
    <p className="overview-card-grid__hint">Select a card to show its recommendations and checks.</p>
  </div>;
}
