import Link from "next/link";
import DocumentVault from "../components/DocumentVault";

export default function Documents() {
  return (
    <main className="app-shell">
      <header className="topbar"><Link className="brand" href="/" aria-label="Back to LifeOS home"><span className="brand-mark">L</span>LifeOS</Link><Link className="back-link" href="/">← Dashboard</Link></header>
      <section className="vault-hero" aria-labelledby="vault-title"><div><p className="eyebrow">DOCUMENT VAULT</p><h1 id="vault-title">Your important records, together.</h1><p className="hero__description">A private home for the paperwork that matters most.</p></div></section>
      <DocumentVault />
    </main>
  );
}
