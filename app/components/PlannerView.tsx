"use client";

import { FormEvent, useEffect, useState } from "react";
import type { DayPlanRecord } from "../api/planner/generate/route";
import type { YouTubeAnalysisResult } from "../api/planner/youtube/route";

const presetModes = [
  { id: "study", icon: "📚", label: "Study Guide & Exam Prep" },
  { id: "work", icon: "💼", label: "Deep Work & Sprints" },
  { id: "travel", icon: "✈️", label: "Travel & Trip Planner" },
  { id: "balanced", icon: "🌱", label: "Balanced Day" },
  { id: "custom", icon: "✍️", label: "Custom Goals" },
  { id: "youtube", icon: "🎥", label: "YouTube Video Import" }
];

const samplePrompts: Record<string, string> = {
  study: "Study Operating Systems Chapter 4, revise SQL queries, and solve 3 array problems.",
  work: "Finish Q3 presentation slides, draft API documentation, and review pull requests.",
  travel: "Plan a 3-day weekend trip to Goa, check my LifeOS calendar for free dates and top attractions.",
  balanced: "Spend 2 hours studying, complete rent payment, read 20 pages, and 30 min evening run.",
  custom: "Plan my day: morning grocery shopping, afternoon study session, and family dinner.",
  youtube: ""
};

export default function PlannerView() {
  const [plans, setPlans] = useState<DayPlanRecord[]>([]);
  const [currentPlan, setCurrentPlan] = useState<DayPlanRecord | null>(null);
  const [vaultDocs, setVaultDocs] = useState<any[]>([]);
  const [todayEventsCount, setTodayEventsCount] = useState<number>(0);

  // Form states
  const [targetHours, setTargetHours] = useState<number>(6);
  const [intentions, setIntentions] = useState<string>("");
  const [youtubeResult, setYoutubeResult] = useState<YouTubeAnalysisResult | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [completedTopicKeys, setCompletedTopicKeys] = useState<Record<string, boolean>>({});

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [importStatus, setImportStatus] = useState<string>("");

  useEffect(() => {
    fetch("/api/planner")
      .then(async (res) => (res.ok ? (res.json() as Promise<DayPlanRecord[]>) : []))
      .then((data) => {
        setPlans(data);
        const todayStr = new Date().toISOString().split("T")[0];
        const todaysPlan = data.find((p) => p.date === todayStr) || data[0] || null;
        if (todaysPlan) setCurrentPlan(todaysPlan);
      })
      .catch(() => {});

    fetch("/api/documents")
      .then(async (res) => (res.ok ? res.json() : []))
      .then((docs) => {
        setVaultDocs(docs);
      })
      .catch(() => {});

    fetch("/api/calendar")
      .then(async (res) => (res.ok ? res.json() : []))
      .then((events: any[]) => {
        const todayStr = new Date().toISOString().split("T")[0];
        const todaysEvts = events.filter((e: any) => e.date === todayStr);
        setTodayEventsCount(todaysEvts.length);
      })
      .catch(() => {});
  }, []);

  async function handleGeneratePlan(e: FormEvent) {
    e.preventDefault();

    const rawInput = intentions.trim();
    
    // Check if input is ONLY a YouTube URL for dedicated video analysis
    const ytOnlyMatch = rawInput.match(/^(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11}))$/i);
    if (ytOnlyMatch) {
      return handleAnalyzeYouTube(ytOnlyMatch[0]);
    }

    const effectiveIntentions = rawInput || "Plan my day using my LifeOS calendar schedule. If there are no calendar events scheduled for today, generate a gold-standard popular high-productivity daily schedule.";

    setIsGenerating(true);
    setErrorMessage("");
    setImportStatus("");

    try {
      const res = await fetch("/api/planner/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentions: effectiveIntentions, mode: "balanced", targetHours })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to generate day plan");

      const planRecord = result as DayPlanRecord;
      setCurrentPlan(planRecord);
      setPlans((prev) => [planRecord, ...prev.filter((p) => p.id !== planRecord.id)]);
      setYoutubeResult(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error generating plan.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleAnalyzeYouTube(urlToAnalyze: string) {
    setIsGenerating(true);
    setErrorMessage("");
    setImportStatus("");

    try {
      const res = await fetch("/api/planner/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlToAnalyze })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to analyze YouTube video");

      setYoutubeResult(result as YouTubeAnalysisResult);
      setQuizAnswers({});
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error analyzing YouTube video.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleImportActionItems(items: Array<{ title: string; category?: string; priority?: "High" | "Medium" | "Low"; notes?: string }>) {
    if (!items || items.length === 0) return;
    setImportStatus("Importing tasks...");

    try {
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionItems: items })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to import tasks");

      setImportStatus(`✨ Successfully imported ${result.importedCount} action item(s) into LifeOS Tasks!`);
    } catch (err) {
      setImportStatus(err instanceof Error ? err.message : "Import failed");
    }
  }

  function handleDeleteActionItem(indexToDelete: number) {
    if (!currentPlan || !currentPlan.actionItems) return;
    const updatedActionItems = currentPlan.actionItems.filter((_, idx) => idx !== indexToDelete);
    const updatedPlan = { ...currentPlan, actionItems: updatedActionItems };
    setCurrentPlan(updatedPlan);
    setPlans((prev) => prev.map((p) => (p.id === updatedPlan.id ? updatedPlan : p)));

    fetch("/api/planner", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: updatedPlan.id, actionItems: updatedActionItems })
    }).catch(() => {});
  }

  function handleDeleteScheduleBlock(indexToDelete: number) {
    if (!currentPlan || !currentPlan.schedule) return;
    const updatedSchedule = currentPlan.schedule.filter((_, idx) => idx !== indexToDelete);
    const updatedPlan = { ...currentPlan, schedule: updatedSchedule };
    setCurrentPlan(updatedPlan);
    setPlans((prev) => prev.map((p) => (p.id === updatedPlan.id ? updatedPlan : p)));

    fetch("/api/planner", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: updatedPlan.id, schedule: updatedSchedule })
    }).catch(() => {});
  }

  return (
    <>
      <section className="section" style={{ paddingTop: 0 }}>
        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.8rem", background: "rgba(16, 185, 129, 0.12)", color: "#34d399", padding: "4px 12px", borderRadius: 20, fontWeight: 700, border: "1px solid rgba(16, 185, 129, 0.3)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            🗓️ LifeOS Calendar Synced {todayEventsCount > 0 ? `(${todayEventsCount} commitment(s) today)` : "(Active)"}
          </span>
          {vaultDocs.length > 0 && (
            <span style={{ fontSize: "0.8rem", background: "rgba(99, 102, 241, 0.12)", color: "#a5b4fc", padding: "4px 12px", borderRadius: 20, fontWeight: 700, border: "1px solid rgba(99, 102, 241, 0.3)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              ✨ Vault Documents ({vaultDocs.length} file(s))
            </span>
          )}
          <span style={{ fontSize: "0.8rem", background: "rgba(239, 68, 68, 0.12)", color: "#fca5a5", padding: "4px 12px", borderRadius: 20, fontWeight: 700, border: "1px solid rgba(239, 68, 68, 0.3)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            🎥 YouTube Link Auto-Detector Active
          </span>
        </div>

        <form onSubmit={handleGeneratePlan} style={{ display: "grid", gap: 16, background: "rgba(255, 255, 255, 0.025)", padding: 20, borderRadius: 14, border: "1px solid rgba(255, 255, 255, 0.07)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              ✨ LifeOS AI Daily Planner
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>Target:</span>
              <select
                value={targetHours}
                onChange={(e) => setTargetHours(Number(e.target.value))}
                style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.12)", background: "rgba(0, 0, 0, 0.2)", color: "var(--ink)", fontSize: "0.82rem", fontWeight: 700 }}
              >
                <option value={4}>4 Hours</option>
                <option value={6}>6 Hours</option>
                <option value={8}>8 Hours</option>
                <option value={10}>10 Hours</option>
              </select>
            </div>
          </div>

          <textarea
            rows={2}
            value={intentions}
            onChange={(e) => setIntentions(e.target.value)}
            placeholder="What do you want to accomplish today? (Optional — paste YouTube link, travel goal, study topic, or leave empty to auto-plan from your LifeOS Calendar)"
            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.1)", background: "rgba(0, 0, 0, 0.2)", color: "var(--ink)", fontSize: "0.9rem", resize: "vertical", boxSizing: "border-box", lineHeight: 1.5 }}
          />

          {errorMessage && (
            <p style={{ margin: 0, color: "#f87171", fontSize: "0.85rem", fontWeight: 600 }}>
              ⚠️ {errorMessage}
            </p>
          )}

          <div>
            <button
              type="submit"
              disabled={isGenerating}
              className="primary-button"
              style={{ padding: "12px 24px", fontSize: "0.92rem", fontWeight: 800, borderRadius: 10, width: "100%", justifyContent: "center" }}
            >
              {isGenerating ? "✨ AI is Planning Your Day..." : "✨ Generate AI Day Plan"}
            </button>
          </div>
        </form>
      </section>

      {/* RENDER YOUTUBE VIDEO ANALYSIS RESULT */}
      {youtubeResult && (
        <section className="section" style={{ marginTop: 20 }}>
          {/* Header Card */}
          <div style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(99,102,241,0.15) 100%)", padding: 20, borderRadius: 16, border: "1px solid rgba(239,68,68,0.3)", marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <span style={{ fontSize: "0.74rem", background: "#ef4444", color: "#fff", padding: "2px 8px", borderRadius: 10, fontWeight: 800, textTransform: "uppercase" }}>
                  🎥 {youtubeResult.contentType.toUpperCase()} VIDEO ANALYSIS
                </span>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "8px 0 4px 0", color: "var(--ink)" }}>
                  {youtubeResult.videoTitle}
                </h2>
                {youtubeResult.authorName && (
                  <p style={{ margin: "0 0 6px 0", fontSize: "0.82rem", color: "var(--brand)", fontWeight: 700 }}>
                    Channel: {youtubeResult.authorName}
                  </p>
                )}
                <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--muted)", lineHeight: 1.5 }}>
                  {youtubeResult.summary}
                </p>
              </div>

              {youtubeResult.actionItems?.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleImportActionItems(youtubeResult.actionItems)}
                  className="btn-secondary"
                  style={{ padding: "8px 14px", fontSize: "0.84rem", borderRadius: 10, display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}
                >
                  📥 Import {youtubeResult.actionItems.length} Action Items to Tasks
                </button>
              )}
            </div>

            {importStatus && (
              <p style={{ marginTop: 10, marginBottom: 0, fontSize: "0.84rem", fontWeight: 700, color: importStatus.includes("Error") ? "#f87171" : "#34d399" }}>
                {importStatus}
              </p>
            )}
          </div>

          {/* MODE A: Educational Study Guide & Interactive Quiz */}
          {youtubeResult.contentType === "study" && youtubeResult.studyGuide && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
              {/* Column 1: Topic Breakdown */}
              <div>
                <div className="section-heading" style={{ marginBottom: 12 }}>
                  <h3>📖 Topic Breakdown & Key Concepts</h3>
                  <span className="result-count">{youtubeResult.studyGuide.topicBreakdown?.length || 0} topic(s)</span>
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  {youtubeResult.studyGuide.topicBreakdown?.map((t, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: "var(--card-bg, rgba(255,255,255,0.03))",
                        borderRadius: 12,
                        padding: 14,
                        border: "1px solid var(--line, rgba(255,255,255,0.08))",
                        display: "grid",
                        gap: 6
                      }}
                    >
                      <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "var(--ink)" }}>💡 {t.topic}</h4>
                      {t.keyConcepts?.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                          {t.keyConcepts.map((kc, kIdx) => (
                            <span key={kIdx} style={{ fontSize: "0.74rem", background: "var(--input-bg, rgba(255,255,255,0.05))", border: "1px solid var(--line, rgba(255,255,255,0.1))", padding: "2px 8px", borderRadius: 6, color: "var(--ink)" }}>
                              {kc}
                            </span>
                          ))}
                        </div>
                      )}
                      <p style={{ margin: "4px 0 0 0", fontSize: "0.78rem", color: "#a855f7", fontWeight: 600 }}>
                        ⚡ Strategy: {t.focusStrategy}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 2: Interactive Practice Quiz */}
              <div>
                <div className="section-heading" style={{ marginBottom: 12 }}>
                  <h3>❓ Interactive Practice Quiz</h3>
                  <span className="result-count">{youtubeResult.studyGuide.practiceQuiz?.length || 0} questions</span>
                </div>

                <div style={{ display: "grid", gap: 16 }}>
                  {youtubeResult.studyGuide.practiceQuiz?.map((q, qIdx) => {
                    const selectedOpt = quizAnswers[q.id ?? qIdx];
                    const isAnswered = selectedOpt !== undefined;
                    const isCorrect = selectedOpt === q.correctIndex;

                    return (
                      <div
                        key={q.id || qIdx}
                        style={{
                          background: "var(--card-bg, rgba(255,255,255,0.03))",
                          borderRadius: 14,
                          padding: 16,
                          border: `1px solid ${isAnswered ? (isCorrect ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)") : "var(--line, rgba(255,255,255,0.08))"}`
                        }}
                      >
                        <p style={{ margin: "0 0 10px 0", fontWeight: 700, fontSize: "0.92rem", color: "var(--ink)" }}>
                          Q{qIdx + 1}. {q.question}
                        </p>

                        <div style={{ display: "grid", gap: 6 }}>
                          {q.options.map((opt, optIdx) => {
                            const cleanOpt = opt.replace(/^[A-D][\.\)]\s*/i, "").replace(/^[A-D]\s*-\s*/i, "").trim();
                            const isThisSelected = selectedOpt === optIdx;
                            const isThisCorrect = q.correctIndex === optIdx;
                            const optionLetter = String.fromCharCode(65 + optIdx);

                            let btnStyle = {
                              background: "var(--input-bg, rgba(255,255,255,0.04))",
                              color: "var(--ink)",
                              border: "1px solid var(--line, rgba(255,255,255,0.1))"
                            };

                            if (isAnswered) {
                              if (isThisCorrect) {
                                btnStyle = { background: "rgba(16, 185, 129, 0.2)", color: "#34d399", border: "1px solid #10b981" };
                              } else if (isThisSelected) {
                                btnStyle = { background: "rgba(239, 68, 68, 0.2)", color: "#f87171", border: "1px solid #ef4444" };
                              }
                            }

                            return (
                              <button
                                key={optIdx}
                                type="button"
                                onClick={() => setQuizAnswers((prev) => ({ ...prev, [q.id || qIdx]: optIdx }))}
                                style={{
                                  textAlign: "left",
                                  padding: "8px 12px",
                                  borderRadius: 8,
                                  fontSize: "0.85rem",
                                  fontWeight: isThisSelected ? 700 : 500,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  transition: "all 0.2s",
                                  ...btnStyle
                                }}
                              >
                                <span
                                  style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: "50%",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: isThisSelected ? (isThisCorrect ? "#10b981" : "#ef4444") : "rgba(168, 85, 247, 0.25)",
                                    color: isThisSelected ? "#fff" : "#e879f9",
                                    fontSize: "0.75rem",
                                    fontWeight: 800,
                                    flexShrink: 0
                                  }}
                                >
                                  {optionLetter}
                                </span>
                                <span>{cleanOpt}</span>
                              </button>
                            );
                          })}
                        </div>

                        {isAnswered && (
                          <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: isCorrect ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", fontSize: "0.8rem", color: isCorrect ? "#34d399" : "#f87171", fontWeight: 600 }}>
                            {isCorrect ? "✅ Correct!" : "❌ Incorrect."} {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* MODE B: Travel Guide & Itinerary */}
          {youtubeResult.contentType === "travel" && youtubeResult.travelGuide && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
              {/* Column 1: Itinerary & Attractions */}
              <div>
                <div className="section-heading" style={{ marginBottom: 12 }}>
                  <h3>✈️ Destination Itinerary: {youtubeResult.travelGuide.destination}</h3>
                  <span className="result-count">{youtubeResult.travelGuide.itinerary?.length || 0} phase(s)</span>
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  {youtubeResult.travelGuide.itinerary?.map((phase, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: "var(--card-bg, rgba(255,255,255,0.03))",
                        borderRadius: 12,
                        padding: 14,
                        border: "1px solid var(--line, rgba(255,255,255,0.08))",
                        display: "grid",
                        gap: 6
                      }}
                    >
                      <h4 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 800, color: "var(--brand)" }}>📍 {phase.dayOrPhase}</h4>
                      {phase.activities?.map((act, aIdx) => (
                        <p key={aIdx} style={{ margin: 0, fontSize: "0.83rem", color: "var(--ink)" }}>• {act}</p>
                      ))}
                    </div>
                  ))}
                </div>

                {youtubeResult.travelGuide.topAttractions?.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <h4 style={{ fontSize: "0.9rem", fontWeight: 800, marginBottom: 8, color: "var(--ink)" }}>🏰 Top Must-Visit Attractions</h4>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {youtubeResult.travelGuide.topAttractions.map((spot, sIdx) => (
                        <span key={sIdx} style={{ fontSize: "0.78rem", background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", border: "1px solid rgba(245, 158, 11, 0.3)", padding: "4px 10px", borderRadius: 8, fontWeight: 700 }}>
                          🌟 {spot}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Column 2: Packing & Prep Checklist */}
              <div>
                <div className="section-heading" style={{ marginBottom: 12 }}>
                  <h3>🧳 Trip Packing & Prep Checklist</h3>
                  <span className="result-count">{youtubeResult.travelGuide.packingChecklist?.length || 0} item(s)</span>
                </div>

                <div style={{ background: "var(--card-bg, rgba(255,255,255,0.03))", borderRadius: 12, padding: 14, border: "1px solid var(--line, rgba(255,255,255,0.08))", display: "grid", gap: 8 }}>
                  {youtubeResult.travelGuide.packingChecklist?.map((item, idx) => (
                    <label key={idx} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.85rem", color: "var(--ink)", cursor: "pointer" }}>
                      <input type="checkbox" style={{ accentColor: "var(--brand)" }} />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* RENDER REGULAR DAY PLAN RESULT */}
      {!youtubeResult && currentPlan && (
        <section className="section" style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Active Day Plan · {currentPlan.date}
            </span>
            <button
              type="button"
              onClick={() => { setCurrentPlan(null); setYoutubeResult(null); }}
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.18)",
                color: "var(--ink)",
                padding: "8px 18px",
                borderRadius: 10,
                fontSize: "0.85rem",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#ffffff";
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--ink)";
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.18)";
              }}
            >
              ✨ Clear View / Start Fresh
            </button>
          </div>

          {/* Render Travel & Trip Guide if generated */}
          {currentPlan.travelGuide && (
            <div
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                borderRadius: 14,
                padding: 20,
                border: "1px solid rgba(255, 255, 255, 0.08)",
                marginBottom: 24
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                  ✈️ Destination Travel Guide: {currentPlan.travelGuide.destination}
                </h3>
                <span style={{ fontSize: "0.8rem", background: "rgba(255, 255, 255, 0.06)", color: "var(--ink)", border: "1px solid rgba(255, 255, 255, 0.12)", padding: "4px 12px", borderRadius: 20, fontWeight: 700 }}>
                  ⏱️ Duration Needed: {currentPlan.travelGuide.suggestedDurationDays} Day(s)
                </span>
              </div>

              {currentPlan.travelGuide.calendarFitNote && (
                <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--muted)", fontWeight: 600 }}>
                    🗓️ <strong>LifeOS Calendar Schedule Check:</strong> {currentPlan.travelGuide.calendarFitNote}
                  </p>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
                <div>
                  <h4 style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--ink)", marginBottom: 10 }}>🏰 Top Attractions & Recommended Places</h4>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {currentPlan.travelGuide.topAttractions?.map((spot, sIdx) => (
                      <span key={sIdx} style={{ fontSize: "0.78rem", background: "rgba(255, 255, 255, 0.05)", color: "var(--ink)", border: "1px solid rgba(255, 255, 255, 0.1)", padding: "4px 10px", borderRadius: 8, fontWeight: 700 }}>
                        🌟 {spot}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--ink)", marginBottom: 10 }}>🧳 Trip Packing & Prep Checklist</h4>
                  <div style={{ display: "grid", gap: 6 }}>
                    {currentPlan.travelGuide.packingChecklist?.map((item, pIdx) => (
                      <label key={pIdx} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", color: "var(--ink)", cursor: "pointer" }}>
                        <input type="checkbox" style={{ accentColor: "var(--brand)" }} />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Day Schedule & Study Guide 2-Column Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            {/* COLUMN 1: Schedule */}
            <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)"
                }}
              >
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>⏳</span> Time-Blocked Day Schedule
                </h3>
                <span style={{ fontSize: "0.76rem", background: "rgba(255, 255, 255, 0.06)", color: "var(--muted)", padding: "3px 10px", borderRadius: 20, fontWeight: 700 }}>
                  {currentPlan.schedule?.length || 0} blocks
                </span>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {currentPlan.schedule?.map((item, idx) => {
                  const isCalEvent = item.isCalendarEvent || item.title.includes("🗓️") || item.title.includes("[Calendar]");
                  return (
                    <div
                      key={idx}
                      style={{
                        background: isCalEvent ? "rgba(99, 102, 241, 0.05)" : "rgba(255, 255, 255, 0.025)",
                        borderRadius: 12,
                        padding: 16,
                        border: `1px solid ${isCalEvent ? "rgba(99, 102, 241, 0.25)" : "rgba(255, 255, 255, 0.07)"}`,
                        display: "grid",
                        gap: 8
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--ink)", fontFamily: "monospace", background: "rgba(255, 255, 255, 0.05)", padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                          ⏱️ {item.timeBlock}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {isCalEvent && (
                            <span style={{ fontSize: "0.74rem", background: "rgba(99, 102, 241, 0.18)", color: "#a5b4fc", border: "1px solid rgba(99, 102, 241, 0.35)", padding: "3px 10px", borderRadius: 12, fontWeight: 800 }}>
                              🗓️ Calendar Event
                            </span>
                          )}
                          <span style={{ fontSize: "0.74rem", background: "rgba(255, 255, 255, 0.06)", color: "var(--muted)", border: "1px solid rgba(255, 255, 255, 0.12)", padding: "3px 10px", borderRadius: 12, fontWeight: 700 }}>
                            {item.category}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteScheduleBlock(idx)}
                            title="Remove Schedule Block"
                            aria-label="Remove Schedule Block"
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--muted)",
                              cursor: "pointer",
                              fontSize: "0.95rem",
                              padding: "2px 6px",
                              borderRadius: 6,
                              transition: "all 0.2s"
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = "#ef4444";
                              e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = "var(--muted)";
                              e.currentTarget.style.background = "transparent";
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      <h4 style={{ margin: 0, fontSize: "0.94rem", fontWeight: 800, color: "var(--ink)" }}>{item.title}</h4>
                      <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--muted)", lineHeight: 1.45 }}>{item.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* COLUMN 2: Study Guide & Quiz */}
            <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
              {currentPlan.studyGuide && currentPlan.studyGuide.topicBreakdown?.length > 0 && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      borderRadius: 12,
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.08)"
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                      <span>📖</span> Study Guide & Practice Quizzes
                    </h3>
                    <span style={{ fontSize: "0.76rem", background: "rgba(255, 255, 255, 0.06)", color: "var(--muted)", padding: "3px 10px", borderRadius: 20, fontWeight: 700 }}>
                      {currentPlan.studyGuide.topicBreakdown.length} topic(s)
                    </span>
                  </div>

                  <div style={{ display: "grid", gap: 14 }}>
                    {currentPlan.studyGuide.topicBreakdown.map((t, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "rgba(255, 255, 255, 0.025)",
                          borderRadius: 12,
                          padding: 16,
                          border: "1px solid rgba(255, 255, 255, 0.07)",
                          display: "grid",
                          gap: 8
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <h4 style={{ margin: 0, fontSize: "0.94rem", fontWeight: 800, color: "var(--ink)" }}>💡 {t.topic}</h4>
                          <span style={{ fontSize: "0.76rem", background: "rgba(255, 255, 255, 0.06)", color: "var(--muted)", border: "1px solid rgba(255, 255, 255, 0.1)", padding: "3px 9px", borderRadius: 10, fontWeight: 700 }}>
                            ⏳ {t.suggestedDurationMinutes}m
                          </span>
                        </div>

                        {t.keyConcepts && t.keyConcepts.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                            {t.keyConcepts.map((kc, kIdx) => (
                              <span key={kIdx} style={{ fontSize: "0.75rem", background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.08)", padding: "2px 8px", borderRadius: 6, color: "var(--ink)", fontWeight: 600 }}>
                                {kc}
                              </span>
                            ))}
                          </div>
                        )}

                        <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>
                          ⚡ Strategy: {t.focusStrategy}
                        </p>

                        {t.practiceQuestions && t.practiceQuestions.length > 0 && (() => {
                          const topicKey = `topic-${currentPlan.id}-${idx}`;
                          const isTopicDone = completedTopicKeys[topicKey] || false;

                          return (
                            <div style={{ marginTop: 10, paddingTop: 12, borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: isTopicDone ? 12 : 0 }}>
                                <button
                                  type="button"
                                  onClick={() => setCompletedTopicKeys((prev) => ({ ...prev, [topicKey]: !isTopicDone }))}
                                  style={{
                                    padding: "6px 14px",
                                    borderRadius: 10,
                                    background: isTopicDone ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.06)",
                                    color: isTopicDone ? "#34d399" : "var(--ink)",
                                    border: `1px solid ${isTopicDone ? "rgba(16, 185, 129, 0.3)" : "rgba(255, 255, 255, 0.12)"}`,
                                    fontSize: "0.8rem",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                    transition: "all 0.2s"
                                  }}
                                >
                                  {isTopicDone ? "✅ Topic Completed!" : "✓ Mark Topic Completed"}
                                </button>
                                <span style={{ fontSize: "0.75rem", color: isTopicDone ? "#34d399" : "var(--muted)", fontWeight: 600 }}>
                                  {isTopicDone ? "🔓 5+ Practice Questions Unlocked" : "🔒 Finish topic to unlock 5+ questions"}
                                </span>
                              </div>

                              {isTopicDone && (
                                <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                                  <p style={{ margin: "0 0 2px 0", fontSize: "0.85rem", fontWeight: 800, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
                                    🎯 Topic Practice Quiz ({t.practiceQuestions.length} Questions):
                                  </p>
                                  {t.practiceQuestions.map((q, qIdx) => {
                                    const qKey = `topic-${idx}-${qIdx}`;
                                    const selectedOpt = quizAnswers[qKey];
                                    const isAnswered = selectedOpt !== undefined;
                                    const isCorrect = selectedOpt === q.correctIndex;

                                    return (
                                      <div
                                        key={qKey}
                                        style={{
                                          background: "rgba(0, 0, 0, 0.2)",
                                          borderRadius: 10,
                                          padding: 12,
                                          border: `1px solid ${isAnswered ? (isCorrect ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)") : "rgba(255, 255, 255, 0.08)"}`
                                        }}
                                      >
                                        <p style={{ margin: "0 0 8px 0", fontWeight: 700, fontSize: "0.85rem", color: "var(--ink)", lineHeight: 1.4 }}>
                                          Q{qIdx + 1}. {q.question}
                                        </p>

                                        <div style={{ display: "grid", gap: 6 }}>
                                          {q.options.map((opt, optIdx) => {
                                            const cleanOpt = opt.replace(/^[A-D][\.\)]\s*/i, "").replace(/^[A-D]\s*-\s*/i, "").trim();
                                            const isThisSelected = selectedOpt === optIdx;
                                            const isThisCorrect = q.correctIndex === optIdx;
                                            const optionLetter = String.fromCharCode(65 + optIdx);

                                            let btnStyle = {
                                              background: "rgba(255, 255, 255, 0.04)",
                                              color: "var(--ink)",
                                              border: "1px solid rgba(255, 255, 255, 0.08)"
                                            };

                                            if (isAnswered) {
                                              if (isThisCorrect) {
                                                btnStyle = { background: "rgba(16, 185, 129, 0.15)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.4)" };
                                              } else if (isThisSelected) {
                                                btnStyle = { background: "rgba(239, 68, 68, 0.15)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.4)" };
                                              }
                                            }

                                            return (
                                              <button
                                                key={optIdx}
                                                type="button"
                                                onClick={() => setQuizAnswers((prev) => ({ ...prev, [qKey]: optIdx }))}
                                                style={{
                                                  textAlign: "left",
                                                  padding: "8px 12px",
                                                  borderRadius: 8,
                                                  fontSize: "0.83rem",
                                                  fontWeight: isThisSelected ? 700 : 500,
                                                  cursor: "pointer",
                                                  display: "flex",
                                                  alignItems: "center",
                                                  gap: 8,
                                                  transition: "all 0.2s",
                                                  ...btnStyle
                                                }}
                                              >
                                                <span
                                                  style={{
                                                    width: 22,
                                                    height: 22,
                                                    borderRadius: "50%",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    background: isThisSelected ? (isThisCorrect ? "#10b981" : "#ef4444") : "rgba(255, 255, 255, 0.1)",
                                                    color: isThisSelected ? "#fff" : "var(--muted)",
                                                    fontSize: "0.75rem",
                                                    fontWeight: 800,
                                                    flexShrink: 0
                                                  }}
                                                >
                                                  {optionLetter}
                                                </span>
                                                <span>{cleanOpt}</span>
                                              </button>
                                            );
                                          })}
                                        </div>

                                        {isAnswered && (
                                          <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: isCorrect ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)", fontSize: "0.8rem", color: isCorrect ? "#34d399" : "#f87171", fontWeight: 600 }}>
                                            {isCorrect ? "✅ Correct!" : "❌ Incorrect."} {q.explanation}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
