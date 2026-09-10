import Link from "next/link";
import FinanceView from "../components/FinanceView";

export default function FinancePage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Back to LifeOS home"><span className="brand-mark">L</span>LifeOS</Link>
        <Link className="back-link" href="/">← Dashboard</Link>
      </header>

      <section style={{ padding: "16px 0 12px 0" }} aria-labelledby="finance-page-title">
        <div>
          <p className="eyebrow" style={{ marginBottom: 4 }}>FINANCE SPACE</p>
          <h1 id="finance-page-title" style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Financial Records & Cashflow</h1>
        </div>
      </section>

      <FinanceView />
    </main>
  );
}
