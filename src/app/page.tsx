"use client";

import { useEffect, useRef, useState } from "react";
import { LaunchScreen } from "@/features/trips/components/launch-screen";
import { GuidedTripSetup } from "@/features/trips/components/guided-trip-setup";
import { TripWorkspace } from "@/features/trips/components/trip-workspace";
import { AuthDialog } from "@/features/trips/components/auth-dialog";
import { AIPlanError } from "@/features/trips/components/ai-plan-error";
import type { TripBrief, TripPlan } from "@/features/trips/domain/trip";
import { AITripProvider } from "@/features/trips/providers/ai-provider";
import { buildSwitzerlandFamilyTrip } from "@/features/trips/fixtures/switzerland-family";

export default function Home() {
  const [plan, setPlan] = useState<TripPlan | undefined>();
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [brief, setBrief] = useState<TripBrief>();
  const [userEmail, setUserEmail] = useState<string>();
  const [authOpen, setAuthOpen] = useState(false);
  const [startAfterAuth, setStartAfterAuth] = useState(false);
  const [setupStep, setSetupStep] = useState(0);
  const requestInFlight = useRef(false);

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [started, plan]);

  async function buildPlan(brief: TripBrief) {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setError(undefined);
    setBrief(brief);

    setBusy(true);
    try {
      const result = await new AITripProvider().search(brief);
      setPlan(result.plan);
    } catch (error) {
      setError(error instanceof Error ? error.message : "AI model is overloaded. Try again later.");
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  function requestStart() {
    if (userEmail) {
      setSetupStep(0);
      setStarted(true);
      return;
    }
    setStartAfterAuth(true);
    setAuthOpen(true);
  }

  function authenticate(email: string) {
    setUserEmail(email);
    setAuthOpen(false);
    if (startAfterAuth) {
      setSetupStep(0);
      setStarted(true);
    }
    setStartAfterAuth(false);
  }

  function signOut() {
    setUserEmail(undefined);
    setStarted(false);
    setSetupStep(0);
    setPlan(undefined);
    setBrief(undefined);
    setError(undefined);
  }

  function goHome() {
    setStarted(false);
    setSetupStep(0);
    setPlan(undefined);
    setBrief(undefined);
    setError(undefined);
  }

  function openDemoPlan() {
    setError(undefined);
    setStarted(false);
    setPlan(buildSwitzerlandFamilyTrip());
  }

  const navigation = {
    userEmail,
    onRequestAuth: () => setAuthOpen(true),
    onSignOut: signOut,
    onHome: goHome,
  };

  let content;
  if (error && brief) {
    content = <AIPlanError message={error} onRetry={() => buildPlan(brief)} onEditBrief={() => { setError(undefined); setSetupStep(3); }} navigation={navigation} />;
  } else if (!plan) {
    content = !started
      ? <LaunchScreen onStart={requestStart} onDemo={openDemoPlan} navigation={navigation} />
      : <GuidedTripSetup onSubmit={buildPlan} busy={busy} navigation={navigation} initialStep={setupStep} initialBrief={brief} />;
  } else {
    content = (
      <div className="workspace-page">
        <TripWorkspace initialPlan={plan} onEditBrief={() => { setBrief(plan.brief); setSetupStep(3); setPlan(undefined); }} navigation={navigation} />
      </div>
    );
  }

  return (
    <>
      {content}
      <AuthDialog open={authOpen} onClose={() => { setAuthOpen(false); setStartAfterAuth(false); }} onAuthenticate={authenticate} />
    </>
  );
}
