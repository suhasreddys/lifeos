"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { CalendarEvent } from "../api/calendar/route";

const categories = ["All", "Holidays", "Google Calendar", "Rent & Property", "Document Expiry", "Key Date", "Personal", "Reminder", "Work", "Important"];

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function formatDateISO(year: number, month: number, day: number) {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export default function CalendarView() {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(formatDateISO(today.getFullYear(), today.getMonth(), today.getDate()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);

  // Google Calendar Sync state
  const [gcalUrl, setGcalUrl] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [connectedAccount, setConnectedAccount] = useState<string | null>(null);
  const [oauthNotification, setOauthNotification] = useState<{ type: "success" | "warning" | "error"; message: string } | null>(null);

  // Form state
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(selectedDate);
  const [newCategory, setNewCategory] = useState<"Personal" | "Reminder" | "Work" | "Important">("Personal");
  const [newDescription, setNewDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const loadCalendarData = () => {
    fetch("/api/calendar")
      .then(async (res) => (res.ok ? (res.json() as Promise<CalendarEvent[]>) : []))
      .then((data) => setEvents(data))
      .catch(() => {});

    fetch("/api/calendar/sync")
      .then(async (res) => (res.ok ? res.json() : null))
      .then((settings) => {
        if (settings) {
          if (settings.googleCalendarUrl) setGcalUrl(settings.googleCalendarUrl);
          if (settings.lastSyncedAt) setLastSyncedAt(settings.lastSyncedAt);
          if (settings.connectedAccount) setConnectedAccount(settings.connectedAccount);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadCalendarData();

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("gcal_success") === "true") {
        const account = params.get("account") || "";
        setOauthNotification({
          type: "success",
          message: `✨ Successfully connected ${account ? account : "Google Account"} and synced events!`
        });
        setShowSyncModal(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (params.get("gcal_setup") === "required") {
        setOauthNotification({
          type: "warning",
          message: "🔑 Google OAuth credentials needed: Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local to enable 1-Click Sign-in. You can also use the Secret iCal URL below."
        });
        setShowSyncModal(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (params.get("gcal_error")) {
        const err = params.get("gcal_error");
        setOauthNotification({
          type: "error",
          message: `⚠️ Google Sign-in error (${err}). Please try again or use the iCal URL option below.`
        });
        setShowSyncModal(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  async function handleLoadHolidays(region = "India") {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/calendar/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to load holidays");
      loadCalendarData();
      alert(`✨ Loaded ${result.syncedCount} Google Public Holidays (${result.region}) into your calendar!`);
    } catch (err) {
      alert("Error loading holidays: " + (err instanceof Error ? err.message : "Error"));
    } finally {
      setIsSyncing(false);
    }
  }

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  }

  function goToday() {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDate(formatDateISO(today.getFullYear(), today.getMonth(), today.getDate()));
  }

  async function handleAddEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newTitle.trim() || !newDate) {
      setFormError("Title and date are required.");
      return;
    }
    setIsSubmitting(true);
    setFormError("");

    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          date: newDate,
          category: newCategory,
          description: newDescription
        })
      });
      const created = (await res.json()) as CalendarEvent & { error?: string };
      if (!res.ok) throw new Error(created.error ?? "Failed to save event");

      setEvents((current) => [...current, created]);
      setNewTitle("");
      setNewDescription("");
      setShowModal(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save event.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSyncGoogleCalendar(e: FormEvent) {
    e.preventDefault();
    if (!gcalUrl.trim()) {
      setSyncStatus("Please enter your Google Calendar iCal URL.");
      return;
    }

    setIsSyncing(true);
    setSyncStatus("");

    try {
      const res = await fetch("/api/calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: gcalUrl })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to sync Google Calendar.");

      loadCalendarData();
      setSyncStatus(`✨ Successfully synced ${result.syncedCount} event(s) from Google Calendar!`);
    } catch (err) {
      setSyncStatus(err instanceof Error ? err.message : "Sync error.");
    } finally {
      setIsSyncing(false);
    }
  }

  // Calculate calendar grid days
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const filteredEvents = events.filter((ev) => activeCategory === "All" || ev.category === activeCategory);

  const eventsByDateMap = new Map<string, CalendarEvent[]>();
  filteredEvents.forEach((ev) => {
    const evDateStr = ev.date;
    const existing = eventsByDateMap.get(evDateStr) ?? [];
    eventsByDateMap.set(evDateStr, [...existing, ev]);
  });

  const selectedDayEvents = events.filter((ev) => {
    if (activeCategory !== "All" && ev.category !== activeCategory) return false;
    return ev.date === selectedDate || ev.date.includes(selectedDate);
  });

  return (
    <>
      <div className="calendar-header-toolbar">
        <div className="calendar-nav">
          <button type="button" className="nav-button" onClick={prevMonth}>←</button>
          <h2>{monthNames[currentMonth]} {currentYear}</h2>
          <button type="button" className="nav-button" onClick={nextMonth}>→</button>
          <button type="button" className="today-button" onClick={goToday}>Today</button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn-secondary" onClick={() => { setSyncStatus(""); setShowSyncModal(true); }}>
            🗓️ Sync Google Calendar
          </button>
          <button type="button" className="primary-button" onClick={() => { setNewDate(selectedDate); setShowModal(true); }}>
            + Add Event
          </button>
        </div>
      </div>

      <div className="vault-tools">
        <div className="filter-pills">
          {categories.map((cat) => (
            <button
              className={`filter-pill ${activeCategory === cat ? "filter-pill--active" : ""}`}
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="calendar-grid-container">
        <div className="calendar-weekdays">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="weekday-header">{day}</div>
          ))}
        </div>

        <div className="calendar-days-grid">
          {Array.from({ length: firstDayIndex }).map((_, idx) => (
            <div key={`empty-${idx}`} className="calendar-day calendar-day--disabled" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dateStr = formatDateISO(currentYear, currentMonth, dayNum);
            const isToday = dateStr === formatDateISO(today.getFullYear(), today.getMonth(), today.getDate());
            const isSelected = dateStr === selectedDate;
            const dayEvents = eventsByDateMap.get(dateStr) ?? [];

            return (
              <button
                key={dateStr}
                type="button"
                className={`calendar-day ${isToday ? "calendar-day--today" : ""} ${isSelected ? "calendar-day--selected" : ""}`}
                onClick={() => setSelectedDate(dateStr)}
              >
                <span className="day-number">{dayNum}</span>
                {dayEvents.length > 0 && (
                  <div className="day-events-indicators">
                    {dayEvents.slice(0, 3).map((ev) => {
                      const pillClass = ev.category === "Holidays"
                        ? "event-pill--holidays"
                        : ev.category === "Rent & Property"
                        ? "event-pill--rent-property"
                        : ev.category === "Document Expiry"
                        ? "event-pill--document-expiry"
                        : ev.category === "Google Calendar"
                        ? "event-pill--google-calendar"
                        : "event-pill--default";
                      return (
                        <span key={ev.id} className={`event-pill ${pillClass}`} title={`${ev.title} (${ev.category})`}>
                          {ev.category === "Holidays" ? "🌴 " : ev.category === "Rent & Property" ? "🏠 " : ev.category === "Document Expiry" ? "⚠️ " : ev.category === "Google Calendar" ? "🗓️ " : ""}{ev.title}
                        </span>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <span style={{ fontSize: "10px", color: "var(--muted)", fontWeight: 800, paddingLeft: 4 }}>+{dayEvents.length - 3} more</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Agenda (Only rendered when day has events) */}
      {selectedDayEvents.length > 0 && (
        <section className="section" aria-labelledby="agenda-title" style={{ marginTop: 24 }}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">SELECTED DAY EVENTS</p>
              <h2 id="agenda-title">Agenda for {selectedDate}</h2>
            </div>
            <span className="result-count">{selectedDayEvents.length} event(s)</span>
          </div>

          <div className="document-rows">
            {selectedDayEvents.map((ev) => (
              <div className="document-row" key={ev.id}>
                <span className="document-type">
                  {ev.category === "Holidays" ? "🌴" : ev.category === "Google Calendar" ? "🗓️" : ev.category === "Rent & Property" ? "🏠" : ev.category === "Document Expiry" ? "⚠️" : ev.category === "Key Date" ? "📌" : "📅"}
                </span>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>{ev.title}</h3>
                  <p>Category: {ev.category} {ev.detail ? `· ${ev.detail}` : ""}</p>
                </div>
                {ev.documentId && (
                  <Link className="document-open" href={`/documents/${ev.documentId}`}>
                    View Document →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Google Calendar Sync Modal */}
      {showSyncModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 16 }}>
          <div style={{ background: "var(--modal-bg, #1e293b)", color: "var(--ink, #f8fafc)", borderRadius: 16, padding: 24, maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)", border: "1px solid var(--line, rgba(255,255,255,0.1))" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--line, rgba(255,255,255,0.1))", paddingBottom: 12 }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--ink, #ffffff)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span>🗓️</span> Google Calendar Integration
              </h2>
              <button onClick={() => setShowSyncModal(false)} style={{ background: "var(--input-bg, rgba(255,255,255,0.08))", border: "none", width: 32, height: 32, borderRadius: "50%", fontSize: "1.1rem", cursor: "pointer", color: "var(--muted, #94a3b8)", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            {oauthNotification && (
              <div style={{
                padding: "10px 14px",
                borderRadius: 8,
                marginBottom: 16,
                fontSize: "0.85rem",
                fontWeight: 600,
                lineHeight: 1.4,
                background: oauthNotification.type === "success" ? "rgba(16, 185, 129, 0.12)" : oauthNotification.type === "warning" ? "rgba(245, 158, 11, 0.12)" : "rgba(239, 68, 68, 0.12)",
                color: oauthNotification.type === "success" ? "#34d399" : oauthNotification.type === "warning" ? "#fbbf24" : "#f87171",
                border: `1px solid ${oauthNotification.type === "success" ? "rgba(16, 185, 129, 0.3)" : oauthNotification.type === "warning" ? "rgba(245, 158, 11, 0.3)" : "rgba(239, 68, 68, 0.3)"}`
              }}>
                {oauthNotification.message}
              </div>
            )}

            <div style={{ display: "grid", gap: 16 }}>
              {/* SECTION 1: 1-Click Sign in with Google (OAuth) */}
              <div style={{ background: "var(--card-bg, rgba(255,255,255,0.03))", borderRadius: 12, padding: 16, border: "1px solid var(--line, rgba(255,255,255,0.08))" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0, color: "var(--ink, #f8fafc)" }}>1. Direct Google Account Access</h3>
                  {connectedAccount && (
                    <span style={{ fontSize: "0.75rem", background: "rgba(16, 185, 129, 0.2)", color: "#34d399", padding: "2px 10px", borderRadius: 12, fontWeight: 700, border: "1px solid rgba(16, 185, 129, 0.4)" }}>
                      Connected
                    </span>
                  )}
                </div>
                <p style={{ fontSize: "0.83rem", color: "var(--muted, #94a3b8)", margin: "0 0 12px 0" }}>
                  Sign in with your Google Account to automatically pull your personal calendar events into LifeOS.
                </p>

                {connectedAccount ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--input-bg, rgba(0,0,0,0.2))", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--line, rgba(255,255,255,0.1))" }}>
                    <div>
                      <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700, color: "var(--ink, #ffffff)" }}>👤 {connectedAccount}</p>
                      {lastSyncedAt && <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted, #94a3b8)" }}>Last synced: {new Date(lastSyncedAt).toLocaleString()}</p>}
                    </div>
                    <a href="/api/auth/google" className="btn-secondary" style={{ padding: "6px 12px", fontSize: "0.82rem", textDecoration: "none" }}>
                      🔄 Re-sync / Change Account
                    </a>
                  </div>
                ) : (
                  <a
                    href="/api/auth/google"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      padding: "10px 16px",
                      background: "#4285F4",
                      color: "#ffffff",
                      borderRadius: 8,
                      textDecoration: "none",
                      fontWeight: 700,
                      fontSize: "0.92rem",
                      boxShadow: "0 4px 12px rgba(66, 133, 244, 0.3)",
                      transition: "opacity 0.2s"
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    Sign in with Google
                  </a>
                )}
              </div>

              {/* SECTION 2: iCal URL Sync */}
              <div>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 4px 0", color: "var(--ink, #f8fafc)" }}>2. Or Sync via Google iCal Secret URL</h3>
                <p style={{ fontSize: "0.82rem", color: "var(--muted, #94a3b8)", margin: "0 0 8px 0", lineHeight: 1.4 }}>
                  Google Calendar → Settings → Select Calendar → <i>&quot;Integrate calendar&quot;</i> → Copy <strong>&quot;Secret address in iCal format&quot;</strong>.
                </p>

                <form onSubmit={handleSyncGoogleCalendar} style={{ display: "grid", gap: 8 }}>
                  <input
                    type="url"
                    required
                    placeholder="https://calendar.google.com/calendar/ical/....ics"
                    value={gcalUrl}
                    onChange={(e) => setGcalUrl(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--input-border, #334155)", background: "var(--input-bg, #0f172a)", color: "var(--ink, #ffffff)", fontSize: "0.88rem", boxSizing: "border-box" }}
                  />
                  <button type="submit" disabled={isSyncing} className="btn-primary" style={{ padding: "9px 16px", borderRadius: 8, fontWeight: 700 }}>
                    {isSyncing ? "Syncing..." : "✨ Sync via iCal URL"}
                  </button>
                </form>
                {syncStatus && <p style={{ fontSize: "0.85rem", marginTop: 6, color: syncStatus.includes("Error") ? "#f87171" : "#34d399", fontWeight: 600 }}>{syncStatus}</p>}
              </div>

              <hr style={{ border: "none", borderTop: "1px solid var(--line, rgba(255,255,255,0.08))", margin: 0 }} />

              {/* SECTION 3: Load Holidays */}
              <div>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 4px 0", color: "var(--ink, #f8fafc)" }}>3. Load Google Public Holidays</h3>
                <p style={{ fontSize: "0.82rem", color: "var(--muted, #94a3b8)", margin: "0 0 10px 0" }}>
                  1-Click load official national public holidays directly into your calendar:
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {/* India Flag Button */}
                  <button type="button" onClick={() => handleLoadHolidays("India")} disabled={isSyncing} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", fontSize: "0.85rem", borderRadius: 8, background: "var(--input-bg, rgba(255,255,255,0.05))", border: "1px solid var(--line, rgba(255,255,255,0.12))", color: "var(--ink, #ffffff)" }}>
                    <svg width="18" height="13" viewBox="0 0 640 480" style={{ borderRadius: 2, flexShrink: 0 }}>
                      <path fill="#f93" d="M0 0h640v160H0z"/>
                      <path fill="#fff" d="M0 160h640v160H0z"/>
                      <path fill="#128807" d="M0 320h640v160H0z"/>
                      <circle cx="320" cy="240" r="60" fill="none" stroke="#000080" strokeWidth="12"/>
                    </svg>
                    India Holidays
                  </button>

                  {/* USA Flag Button */}
                  <button type="button" onClick={() => handleLoadHolidays("USA")} disabled={isSyncing} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", fontSize: "0.85rem", borderRadius: 8, background: "var(--input-bg, rgba(255,255,255,0.05))", border: "1px solid var(--line, rgba(255,255,255,0.12))", color: "var(--ink, #ffffff)" }}>
                    <svg width="18" height="13" viewBox="0 0 640 480" style={{ borderRadius: 2, flexShrink: 0 }}>
                      <path fill="#bd3d4d" d="M0 0h640v480H0z"/>
                      <path fill="#fff" d="M0 36.9h640v36.9H0zm0 73.8h640v36.9H0zm0 73.8h640v36.9H0zm0 73.8h640v36.9H0zm0 73.8h640v36.9H0zm0 73.8h640v36.9H0z"/>
                      <path fill="#192f5d" d="M0 0h256v258.5H0z"/>
                    </svg>
                    USA Holidays
                  </button>

                  {/* UK Flag Button */}
                  <button type="button" onClick={() => handleLoadHolidays("UK")} disabled={isSyncing} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", fontSize: "0.85rem", borderRadius: 8, background: "var(--input-bg, rgba(255,255,255,0.05))", border: "1px solid var(--line, rgba(255,255,255,0.12))", color: "var(--ink, #ffffff)" }}>
                    <svg width="18" height="13" viewBox="0 0 640 480" style={{ borderRadius: 2, flexShrink: 0 }}>
                      <path fill="#012169" d="M0 0h640v480H0z"/>
                      <path fill="#fff" d="m0 0 640 480M640 0 0 480" stroke="#fff" strokeWidth="60"/>
                      <path fill="#c8102e" d="m0 0 640 480M640 0 0 480" stroke="#c8102e" strokeWidth="40"/>
                      <path fill="#fff" d="M320 0v480M0 240h640" stroke="#fff" strokeWidth="100"/>
                      <path fill="#c8102e" d="M320 0v480M0 240h640" stroke="#c8102e" strokeWidth="60"/>
                    </svg>
                    UK Holidays
                  </button>
                </div>
              </div>

              <hr style={{ border: "none", borderTop: "1px solid var(--line, rgba(255,255,255,0.08))", margin: 0 }} />

              {/* SECTION 4: Export LifeOS Calendar */}
              <div>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 4px 0", color: "var(--ink, #f8fafc)" }}>4. Export LifeOS Events to Google Calendar</h3>
                <p style={{ fontSize: "0.82rem", color: "var(--muted, #94a3b8)", margin: "0 0 10px 0" }}>
                  Download your LifeOS events (documents, leases, tasks, custom reminders) as an iCalendar (`.ics`) file to import into Google Calendar.
                </p>
                <a href="/api/calendar/export" download="lifeos-calendar.ics" className="btn-secondary" style={{ display: "inline-block", textDecoration: "none", padding: "8px 14px", borderRadius: 8, background: "var(--input-bg, rgba(255,255,255,0.05))", color: "var(--ink, #ffffff)", border: "1px solid var(--line, rgba(255,255,255,0.12))", fontWeight: 600, fontSize: "0.85rem" }}>
                  📥 Download LifeOS Calendar (.ics)
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Add Personal Event / Reminder</h2>
            <form onSubmit={handleAddEvent} className="modal-form">
              <label>
                <span>Title</span>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Flight to Delhi, Passport Renewal"
                />
              </label>
              <label>
                <span>Date</span>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </label>
              <label>
                <span>Category</span>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as "Personal" | "Reminder" | "Work" | "Important")}
                >
                  <option value="Personal">Personal</option>
                  <option value="Reminder">Reminder</option>
                  <option value="Work">Work</option>
                  <option value="Important">Important</option>
                </select>
              </label>
              <label>
                <span>Description (Optional)</span>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Additional context or notes..."
                />
              </label>
              {formError && <p className="upload-message upload-message--error">{formError}</p>}
              <div className="modal-actions">
                <button type="button" className="filter-pill" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Event"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
