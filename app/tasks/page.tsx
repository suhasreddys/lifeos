import Link from "next/link";
import TasksView from "../components/TasksView";

export default function TasksPage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Back to LifeOS home"><span className="brand-mark">L</span>LifeOS</Link>
        <Link className="back-link" href="/">← Dashboard</Link>
      </header>

      <section className="vault-hero" aria-labelledby="tasks-page-title">
        <div>
          <p className="eyebrow">TASKS & ACTION ITEMS</p>
          <h1 id="tasks-page-title">Get things done with clarity.</h1>
          <p className="hero__description">Personal to-dos combined with AI-extracted follow-ups from your documents.</p>
        </div>
      </section>

      <TasksView />
    </main>
  );
}
