import Link from "next/link";
import CalendarView from "../components/CalendarView";

export default function CalendarPage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Back to LifeOS home"><span className="brand-mark">L</span>LifeOS</Link>
        <Link className="back-link" href="/">← Dashboard</Link>
      </header>

      <section className="vault-hero" aria-labelledby="calendar-title">
        <div>
          <p className="eyebrow">CALENDAR & REMINDERS</p>
          <h1 id="calendar-title">Your schedule and document dates, together.</h1>
          <p className="hero__description">Unified view of document expirations, key milestones, and personal events.</p>
        </div>
      </section>

      <CalendarView />
    </main>
  );
}
