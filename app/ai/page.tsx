import Link from "next/link";
import AiChatView from "../components/AiChatView";

export default function AiPage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Back to LifeOS home"><span className="brand-mark">L</span>LifeOS</Link>
        <Link className="back-link" href="/">← Dashboard</Link>
      </header>

      <section style={{ padding: "16px 0 12px 0" }} aria-labelledby="ai-page-title">
        <div>
          <p className="eyebrow" style={{ marginBottom: 4 }}>LIFEOS PERSONAL AI ASSISTANT</p>
          <h1 id="ai-page-title" style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>LifeOS Personal AI Assistant</h1>
        </div>
      </section>

      <AiChatView />
    </main>
  );
}
