import Link from "next/link";
import PlannerView from "../components/PlannerView";

export default function PlannerPage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="LifeOS home">
          <span className="brand-mark">L</span>LifeOS
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link className="back-link" href="/">
            ← Back to Command Center
          </Link>
          <span className="topbar__date">AI Daily Planner</span>
        </div>
      </header>

      <section className="hero" aria-labelledby="planner-title" style={{ paddingBottom: 16 }}>
        <p className="eyebrow">INTENTIONS & STUDY ARCHITECT</p>
        <h1 id="planner-title">AI Day Planner & Study Guide</h1>
        <p className="hero__description" style={{ maxWidth: 640 }}>
          Organize your day into an optimized, time-blocked schedule and actionable study guide.
        </p>
      </section>

      <PlannerView />
    </main>
  );
}
