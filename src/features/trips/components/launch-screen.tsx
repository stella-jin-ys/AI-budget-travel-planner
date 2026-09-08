import { AppNav, type AppNavProps } from "./app-nav";

export function LaunchScreen({ onStart, onDemo, navigation }: { onStart: () => void; onDemo?: () => void; navigation?: AppNavProps }) {
  return (
    <main className="launch-screen" aria-labelledby="launch-title">
      <div className="launch-screen__image" aria-hidden="true" />
      <AppNav {...navigation} />
      <section className="launch-card">
        <p className="eyebrow">TRAVEL SMARTER · SPEND BETTER</p>
        <h1 id="launch-title">Travel further<br /><em>without overspending.</em></h1>
        <p>Tell us where you’re starting, who’s coming, and what matters most.</p>
        <button type="button" className="launch-cta" onClick={onStart}>Start planning <span aria-hidden="true">↗</span></button>
        {onDemo ? <button type="button" className="launch-cta launch-demo" onClick={onDemo}>View demo trip <span aria-hidden="true">↗</span></button> : null}
        <p className="launch-card__note">One request · Your brief stays saved</p>
      </section>
      <ol className="launch-steps" aria-label="How it works">
        <li><span>01</span><strong>Set the brief</strong><small>Origin, dates & budget</small></li>
        <li><span>02</span><strong>Get the options</strong><small>Routes, stays & things to do</small></li>
        <li><span>03</span><strong>Make it yours</strong><small>A day-by-day plan to follow</small></li>
      </ol>
    </main>
  );
}
