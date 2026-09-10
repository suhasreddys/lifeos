import Link from "next/link";
import RentalManagerView from "../components/RentalManagerView";

export default function RentalPage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Back to LifeOS home"><span className="brand-mark">L</span>LifeOS</Link>
        <Link className="back-link" href="/">← Dashboard</Link>
      </header>

      <section className="vault-hero" aria-labelledby="rental-page-title">
        <div>
          <p className="eyebrow">REAL ESTATE & PROPERTY</p>
          <h1 id="rental-page-title">Tenant & Landlord Manager</h1>
          <p className="hero__description">Rent payments, security deposits, maintenance tickets, meter readings, notices & move-in/out records.</p>
        </div>
      </section>

      <RentalManagerView />
    </main>
  );
}
