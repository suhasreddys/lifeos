"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LifeCard from "./components/LifeCard";
import InstallPwaButton from "./components/InstallPwaButton";
import type { DocumentRecord } from "./api/documents/route";

type ReminderItem = {
  id: string;
  documentId: string;
  documentName: string;
  type: "expiry" | "date" | "action";
  title: string;
  detail: string;
  dateStr?: string;
  urgent: boolean;
};

export default function Home() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [dismissedReminders, setDismissedReminders] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/documents")
      .then(async (res) => (res.ok ? (res.json() as Promise<DocumentRecord[]>) : []))
      .then((docs) => setDocuments(docs))
      .catch(() => {});

    try {
      const saved = localStorage.getItem("lifeos_dismissed_reminders");
      if (saved) setDismissedReminders(JSON.parse(saved));
    } catch {}
  }, []);

  function handleDismiss(reminderId: string, event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const updated = [...dismissedReminders, reminderId];
    setDismissedReminders(updated);
    try {
      localStorage.setItem("lifeos_dismissed_reminders", JSON.stringify(updated));
    } catch {}
  }

  const rawReminders: ReminderItem[] = [];
  const today = new Date();

  documents.forEach((doc) => {
    if (!doc.analysis) return;

    // Check if document is a certificate, resume, or educational document
    const isEducationOrCert = doc.category === "Certificates" || 
                              doc.category === "Other" ||
                              doc.name.toLowerCase().includes("resume") || 
                              doc.name.toLowerCase().includes("marksheet") ||
                              doc.name.toLowerCase().includes("std");

    if (doc.analysis.expiryDate) {
      const expDate = new Date(doc.analysis.expiryDate);
      if (!isNaN(expDate.getTime())) {
        const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 30) {
          rawReminders.push({
            id: `exp-${doc.id}`,
            documentId: doc.id,
            documentName: doc.name,
            type: "expiry",
            title: diffDays < 0 ? `Expired (${doc.analysis.expiryDate})` : `Expires in ${diffDays} day(s)`,
            detail: `Category: ${doc.category}`,
            dateStr: doc.analysis.expiryDate,
            urgent: diffDays <= 7
          });
        }
      }
    }

    // Only process keyDates for non-educational documents or if it's an actual upcoming date
    if (!isEducationOrCert) {
      doc.analysis.keyDates?.forEach((kd, idx) => {
        const isYearRange = /\b20\d{2}\s*[-–—]\s*20\d{2}\b/.test(kd.date);
        if (!isYearRange) {
          rawReminders.push({
            id: `kd-${doc.id}-${idx}`,
            documentId: doc.id,
            documentName: doc.name,
            type: "date",
            title: `${kd.label}: ${kd.date}`,
            detail: kd.context,
            dateStr: kd.date,
            urgent: false
          });
        }
      });
    }

    doc.analysis.actionItems?.forEach((action, idx) => {
      rawReminders.push({
        id: `act-${doc.id}-${idx}`,
        documentId: doc.id,
        documentName: doc.name,
        type: "action",
        title: "Action Item",
        detail: action,
        urgent: true
      });
    });
  });

  const reminders = rawReminders.filter((r) => !dismissedReminders.includes(r.id));
  const urgentCount = reminders.filter((r) => r.urgent).length;
  const todayStatus = urgentCount > 0 ? `${urgentCount} urgent` : reminders.length > 0 ? `${reminders.length} active` : "Clear";

  return (
    <main className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="LifeOS home"><span className="brand-mark">L</span>LifeOS</Link>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <InstallPwaButton />
          <Link className="back-link" href="/planner" style={{ fontWeight: 700, color: "var(--brand)" }}>🎯 AI Daily Planner</Link>
          <Link className="back-link" href="/ai" style={{ fontWeight: 700, color: "var(--brand)" }}>🤖 LifeOS Personal AI Assistant</Link>
          <span className="topbar__date">Your personal command center</span>
        </div>
      </header>
      <section className="hero" aria-labelledby="dashboard-title">
        <p className="eyebrow">HOME</p>
        <h1 id="dashboard-title">Good to see you.</h1>
        <p className="hero__description">Keep life&apos;s important details in one calm, organized place.</p>
      </section>

      <section className="overview" aria-label="LifeOS overview">
        <div className="overview-card">
          <span className="overview-card__label">Documents</span>
          <strong>{documents.length}</strong>
          <span>saved securely</span>
        </div>
        <div className="overview-card">
          <span className="overview-card__label">Upcoming</span>
          <strong>{reminders.length}</strong>
          <span>reminders & renewals</span>
        </div>
        <div className="overview-card">
          <span className="overview-card__label">Today</span>
          <strong>{todayStatus}</strong>
          <span>{urgentCount > 0 ? "requires attention" : "nothing urgent"}</span>
        </div>
      </section>

      {reminders.length > 0 && (
        <section className="section" aria-labelledby="reminders-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">AUTOMATED REMINDERS</p>
              <h2 id="reminders-title">Upcoming & Renewal Tracking</h2>
            </div>
            <span className="result-count">{reminders.length} active items</span>
          </div>
          <div className="reminders-grid">
            {reminders.map((item) => (
              <div key={item.id} className={`reminder-card ${item.urgent ? "reminder-card--urgent" : ""}`} style={{ position: "relative" }}>
                <Link href={`/documents/${item.documentId}`} style={{ textDecoration: "none", color: "inherit", display: "block", flex: 1 }}>
                  <div className="reminder-card__header">
                    <span className={`reminder-tag reminder-tag--${item.type}`}>{item.type.toUpperCase()}</span>
                    <span className="reminder-doc-name">{item.documentName}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </Link>
                <button
                  className="delete-reminder-button"
                  type="button"
                  onClick={(e) => handleDismiss(item.id, e)}
                  title="Remove reminder"
                  aria-label="Remove reminder"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section" aria-labelledby="spaces-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR SPACES</p>
            <h2 id="spaces-title">Everything in its place</h2>
          </div>
          <p>Start with your important records.</p>
        </div>
        <div className="life-card-grid">
          <LifeCard icon="🎯" title="AI Daily Planner" description="Turn daily intentions & study topics into structured time blocks & action items." href="/planner" status="New" />
          <LifeCard icon="📁" title="Document Vault" description="Keep agreements, IDs, bills, certificates, and insurance records organized." href="/documents" status="Ready" />
          <LifeCard icon="📅" title="Calendar" description="Manage important dates, appointments, and reminders." href="/calendar" status="Ready" />
          <LifeCard icon="✓" title="Tasks" description="Keep track of the things that need your attention." href="/tasks" status="Ready" />
          <LifeCard icon="₹" title="Finance" description="Understand your income, expenses, and financial goals." href="/finance" status="Ready" />
          <LifeCard icon="🏠" title="Tenant & Landlord" description="Rent payments, security deposits, maintenance tickets, meter readings & notices." href="/rental" status="Ready" />
        </div>
      </section>
    </main>
  );
}
