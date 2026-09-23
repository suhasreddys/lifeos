"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LifeCard from "./components/LifeCard";
import type { DocumentRecord } from "./api/documents/route";
import {
  IconDocument,
  IconBell,
  IconZap,
  IconFinance,
  IconPlanner,
  IconCalendar,
  IconCheckSquare,
  IconHome,
  IconPlus,
  IconSparkles,
  IconUpload,
  IconTrash,
} from "./components/Icons";

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

type FinanceSummary = {
  netBalance: number;
  totalIncome: number;
  totalExpenses: number;
  transactionCount: number;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export default function Home() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [dismissedReminders, setDismissedReminders] = useState<string[]>([]);
  const [currentDateStr, setCurrentDateStr] = useState("");
  const [greeting, setGreeting] = useState("Good day");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    // Fetch logged-in user session
    fetch("/api/auth/me")
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.authenticated && data.user?.name) {
          const firstName = data.user.name.split(" ")[0];
          setUserName(firstName);
        }
      })
      .catch(() => {});

    // Current date and dynamic time-based greeting (Morning < 11:30 AM, Afternoon 11:30 AM - 5 PM, Evening 5 PM+)
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    let timeGreeting = "Good morning";
    if (hour >= 17) {
      timeGreeting = "Good evening";
    } else if (hour > 11 || (hour === 11 && minute >= 30)) {
      timeGreeting = "Good afternoon";
    } else if (hour < 5) {
      timeGreeting = "Good evening";
    }
    setGreeting(timeGreeting);

    const options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
    setCurrentDateStr(now.toLocaleDateString("en-US", options));

    // Fetch documents
    fetch("/api/documents")
      .then(async (res) => (res.ok ? (res.json() as Promise<DocumentRecord[]>) : []))
      .then((docs) => setDocuments(docs))
      .catch(() => {});

    // Fetch finance summary
    fetch("/api/finance")
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.summary) setFinanceSummary(data.summary);
      })
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
    const isEducationOrCert =
      doc.category === "Certificates" ||
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
            urgent: diffDays <= 7,
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
            urgent: false,
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
        urgent: true,
      });
    });
  });

  const reminders = rawReminders.filter((r) => !dismissedReminders.includes(r.id));
  const urgentCount = reminders.filter((r) => r.urgent).length;
  const todayStatus = urgentCount > 0 ? `${urgentCount} urgent` : reminders.length > 0 ? `${reminders.length} active` : "Clear";

  return (
    <main className="app-shell">
      {/* Hero Welcome Section */}
      <section className="hero" aria-labelledby="dashboard-title">
        <div className="hero-top-row">
          <div className="hero-badge">
            <span className="hero-badge-dot"></span>
            <span>PERSONAL COMMAND CENTER</span>
          </div>
          {currentDateStr && <span className="hero-date-pill">{currentDateStr}</span>}
        </div>

        <h1 id="dashboard-title" className="hero-headline">
          {greeting}{userName ? `, ${userName}` : ""}.
        </h1>
        <p className="hero__description">Keep your life&apos;s records, goals, schedule, and finances in one calm, organized space.</p>

        {/* Quick Actions Bar */}
        <div className="quick-actions-bar">
          <Link href="/documents" className="quick-action-btn">
            <IconUpload size={16} />
            <span>Upload Document</span>
          </Link>
          <Link href="/tasks" className="quick-action-btn">
            <IconPlus size={16} />
            <span>New Task</span>
          </Link>
          <Link href="/finance" className="quick-action-btn">
            <IconFinance size={16} />
            <span>Log Expense</span>
          </Link>
          <Link href="/planner" className="quick-action-btn quick-action-btn--primary">
            <IconSparkles size={16} />
            <span>Plan My Day</span>
          </Link>
        </div>
      </section>

      {/* Overview Stat Cards Grid */}
      <section className="overview" aria-label="LifeOS overview">
        <div className="overview-card overview-card--docs">
          <div className="overview-card__header">
            <div className="overview-card__icon-box">
              <IconDocument size={18} />
            </div>
            <span className="overview-card__label">Documents</span>
          </div>
          <strong>{documents.length}</strong>
          <span className="overview-card__sub">vault items saved</span>
        </div>

        <div className="overview-card overview-card--reminders">
          <div className="overview-card__header">
            <div className="overview-card__icon-box">
              <IconBell size={18} />
            </div>
            <span className="overview-card__label">Upcoming</span>
          </div>
          <strong>{reminders.length}</strong>
          <span className="overview-card__sub">reminders & renewals</span>
        </div>

        <div className="overview-card overview-card--today">
          <div className="overview-card__header">
            <div className="overview-card__icon-box">
              <IconZap size={18} />
            </div>
            <span className="overview-card__label">Today</span>
          </div>
          <strong className={urgentCount > 0 ? "text-urgent" : "text-clear"}>{todayStatus}</strong>
          <span className="overview-card__sub">{urgentCount > 0 ? "requires action" : "all clear"}</span>
        </div>

        <div className="overview-card overview-card--finance">
          <div className="overview-card__header">
            <div className="overview-card__icon-box">
              <IconFinance size={18} />
            </div>
            <span className="overview-card__label">Net Balance</span>
          </div>
          <strong className="text-balance">{financeSummary ? formatCurrency(financeSummary.netBalance) : "₹0"}</strong>
          <span className="overview-card__sub">
            {financeSummary ? `${financeSummary.transactionCount} transactions` : "cashflow active"}
          </span>
        </div>
      </section>

      {/* Active Reminders Section */}
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
                  <IconTrash size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Feature Spaces Grid */}
      <section className="section" aria-labelledby="spaces-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR SPACES</p>
            <h2 id="spaces-title">Everything in its place</h2>
          </div>
          <p className="section-subheading">Personal management tools built for life.</p>
        </div>
        <div className="life-card-grid">
          <LifeCard
            icon={<IconPlanner size={26} />}
            title="AI Daily Planner"
            description="Turn daily intentions & study topics into structured time blocks & action items."
            href="/planner"
            status="Active"
            theme="purple"
          />
          <LifeCard
            icon={<IconDocument size={26} />}
            title="Document Vault"
            description="Keep agreements, IDs, bills, certificates, and insurance records organized."
            href="/documents"
            status="Vault"
            theme="emerald"
          />
          <LifeCard
            icon={<IconCalendar size={26} />}
            title="Calendar"
            description="Manage important dates, appointments, and automatic reminders."
            href="/calendar"
            status="Sync"
            theme="amber"
          />
          <LifeCard
            icon={<IconCheckSquare size={26} />}
            title="Tasks"
            description="Keep track of the things that need your immediate attention."
            href="/tasks"
            status="Focus"
            theme="blue"
          />
          <LifeCard
            icon={<IconFinance size={26} />}
            title="Finance"
            description="Understand your income, expenses, and financial goals with auto SMS sync."
            href="/finance"
            status="Track"
            theme="teal"
          />
          <LifeCard
            icon={<IconHome size={26} />}
            title="Tenant & Landlord"
            description="Rent payments, security deposits, maintenance tickets, meter readings & notices."
            href="/rental"
            status="Rental"
            theme="rose"
          />
        </div>
      </section>
    </main>
  );
}
