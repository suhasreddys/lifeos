"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { TransactionRecord } from "../api/finance/route";
import { IconFinance, IconPlus, IconZap, IconSparkles, IconTrash } from "./Icons";

type FinanceData = {
  summary: {
    netBalance: number;
    totalIncome: number;
    totalExpenses: number;
    transactionCount: number;
  };
  transactions: TransactionRecord[];
};

const categories = ["Salary", "Investments", "Rent", "Utilities", "Bills", "Shopping", "Subscriptions", "Food & Dining", "Other"];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export default function FinanceView() {
  const [data, setData] = useState<FinanceData>({
    summary: { netBalance: 0, totalIncome: 0, totalExpenses: 0, transactionCount: 0 },
    transactions: [],
  });
  const [activeFilter, setActiveFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [testSmsInput, setTestSmsInput] = useState("");
  const [isTestingSms, setIsTestingSms] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"Income" | "Expense">("Expense");
  const [category, setCategory] = useState("Bills");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchFinanceData = () => {
    fetch("/api/finance")
      .then(async (res) => (res.ok ? (res.json() as Promise<FinanceData>) : null))
      .then((resData) => {
        if (resData) setData(resData);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchFinanceData();
  }, []);

  async function handleSmsParseSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!testSmsInput.trim()) return;

    setIsTestingSms(true);
    setSyncMessage(null);

    try {
      const res = await fetch("/api/finance/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: testSmsInput }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Could not parse SMS.");

      setSyncMessage({
        text: `Success! Logged: ${result.transaction.title} (${result.transaction.type === "Income" ? "+" : "-"}₹${result.transaction.amount})`,
        isError: false,
      });
      setTestSmsInput("");
      fetchFinanceData();
    } catch (err) {
      setSyncMessage({
        text: err instanceof Error ? err.message : "Failed to extract transaction.",
        isError: true,
      });
    } finally {
      setIsTestingSms(false);
    }
  }

  async function handleAddTransaction(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!title.trim() || isNaN(numAmount) || numAmount <= 0) {
      setFormError("Enter a valid title and positive amount.");
      return;
    }
    setIsSubmitting(true);
    setFormError("");

    try {
      const res = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, amount: numAmount, type, category, date, notes }),
      });
      const created = (await res.json()) as TransactionRecord & { error?: string };
      if (!res.ok) throw new Error(created.error ?? "Failed to save entry");

      const updatedRes = await fetch("/api/finance");
      if (updatedRes.ok) setData(await updatedRes.json());

      setTitle("");
      setAmount("");
      setNotes("");
      setShowModal(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save entry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteTransaction(id: string, source?: string) {
    if (source === "document") {
      alert("This item was auto-generated from a document in your Vault.");
      return;
    }
    if (!confirm("Are you sure you want to delete this transaction record?")) return;

    // Optimistic UI update for instant (0ms) response
    setData((prev) => {
      const remainingTx = prev.transactions.filter((t) => t.id !== id);
      const totalIncome = remainingTx.filter((t) => t.type === "Income").reduce((sum, t) => sum + t.amount, 0);
      const totalExpenses = remainingTx.filter((t) => t.type === "Expense").reduce((sum, t) => sum + t.amount, 0);
      return {
        summary: {
          netBalance: totalIncome - totalExpenses,
          totalIncome,
          totalExpenses,
          transactionCount: remainingTx.length,
        },
        transactions: remainingTx,
      };
    });

    try {
      await fetch(`/api/finance?id=${id}`, { method: "DELETE" });
    } catch {
      fetchFinanceData();
    }
  }

  async function handleClipboardAutoDetect() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setTestSmsInput(text.trim());
          setSyncMessage({ text: "📋 Auto-pasted from your phone clipboard!", isError: false });
        } else {
          setSyncMessage({ text: "Clipboard is empty. Copy a bank SMS or notification first.", isError: true });
        }
      }
    } catch {
      setSyncMessage({ text: "Tap & hold inside the box to paste your bank SMS.", isError: false });
    }
  }

  async function handleScreenshotUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsTestingSms(true);
    setSyncMessage({ text: "📷 Gemini AI is reading your payment screenshot...", isError: false });

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(",")[1];
        const res = await fetch("/api/finance/webhook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64Data,
            imageType: file.type || "image/png",
          }),
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Could not read screenshot.");

        setSyncMessage({
          text: `✨ Auto-Extracted! Logged: ${result.transaction.title} (${result.transaction.type === "Income" ? "+" : "-"}₹${result.transaction.amount})`,
          isError: false,
        });
        fetchFinanceData();
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setSyncMessage({
        text: err instanceof Error ? err.message : "Failed to extract transaction from image.",
        isError: true,
      });
    } finally {
      setIsTestingSms(false);
    }
  }

  useEffect(() => {
    if (showSyncModal) {
      handleClipboardAutoDetect().catch(() => {});
    }
  }, [showSyncModal]);

  const visibleTx = data.transactions.filter((t) => {
    if (activeFilter === "Income") return t.type === "Income";
    if (activeFilter === "Expenses") return t.type === "Expense";
    if (activeFilter === "Bills & Receipts") return t.source === "document";
    return true;
  });

  return (
    <>
      <section className="overview" aria-label="Finance summary" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--line)", borderRadius: 22, padding: 20, borderTop: "4px solid #6366f1", boxShadow: "var(--shadow-sm)" }}>
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#818cf8", display: "block", marginBottom: 6, letterSpacing: 0.5 }}>Net Balance</span>
          <strong style={{ color: "var(--ink)", fontSize: 26, fontWeight: 800, display: "block" }}>{formatCurrency(data.summary.netBalance)}</strong>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Total cashflow balance</span>
        </div>

        <div style={{ background: "var(--card-bg)", border: "1px solid var(--line)", borderRadius: 22, padding: 20, borderTop: "4px solid #10b981", boxShadow: "var(--shadow-sm)" }}>
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#34d399", display: "block", marginBottom: 6, letterSpacing: 0.5 }}>Total Income</span>
          <strong style={{ color: "#34d399", fontSize: 26, fontWeight: 800, display: "block" }}>+{formatCurrency(data.summary.totalIncome)}</strong>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Recorded earnings</span>
        </div>

        <div style={{ background: "var(--card-bg)", border: "1px solid var(--line)", borderRadius: 22, padding: 20, borderTop: "4px solid #ef4444", boxShadow: "var(--shadow-sm)" }}>
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#f87171", display: "block", marginBottom: 6, letterSpacing: 0.5 }}>Total Expenses</span>
          <strong style={{ color: "#f87171", fontSize: 26, fontWeight: 800, display: "block" }}>-{formatCurrency(data.summary.totalExpenses)}</strong>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Recorded spending</span>
        </div>
      </section>

      <div className="calendar-header-toolbar" style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div className="filter-pills" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["All", "Expenses", "Income", "Bills & Receipts"].map((f) => (
            <button
              key={f}
              type="button"
              className={`filter-pill ${activeFilter === f ? "filter-pill--active" : ""}`}
              onClick={() => setActiveFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="quick-action-btn"
            onClick={() => setShowSyncModal(true)}
            style={{ color: "#10b981", borderColor: "rgba(16, 185, 129, 0.3)" }}
          >
            <IconZap size={16} />
            <span>AI SMS / Receipt Extract</span>
          </button>
          <button type="button" className="primary-button" onClick={() => setShowModal(true)}>
            <IconPlus size={16} />
            <span>Log Transaction</span>
          </button>
        </div>
      </div>

      <section className="document-list section" style={{ paddingTop: 20 }} aria-labelledby="finance-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">RECENT TRANSACTIONS</p>
            <h2 id="finance-title">Cashflow Stream</h2>
          </div>
          <span className="result-count">{visibleTx.length} records</span>
        </div>

        {visibleTx.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__icon" aria-hidden="true">
              <IconFinance size={36} />
            </span>
            <h2>No financial records</h2>
            <p>Log a transaction manually or paste a bank SMS to auto-extract expenses.</p>
          </div>
        ) : (
          <div className="document-rows">
            {visibleTx.map((t) => (
              <div className="document-row" key={t.id}>
                <div className="document-row-content" style={{ cursor: "default" }}>
                  <span
                    className="document-type"
                    style={{
                      background: t.type === "Income" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                      color: t.type === "Income" ? "#10b981" : "#ef4444",
                    }}
                  >
                    {t.type === "Income" ? "+" : "-"}
                  </span>
                  <div>
                    <h3>{t.title}</h3>
                    <p>
                      {t.category} · {t.date} {t.notes ? `· ${t.notes}` : ""}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: t.type === "Income" ? "#10b981" : "var(--ink)",
                      marginLeft: "auto",
                      marginRight: 16,
                    }}
                  >
                    {t.type === "Income" ? "+" : "-"}{formatCurrency(t.amount)}
                  </span>
                  {t.source === "document" ? (
                    <span className="status-badge status-badge--active">
                      <IconSparkles size={12} style={{ display: "inline-block", marginRight: 4 }} /> Auto-Parsed
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDeleteTransaction(t.id, t.source)}
                      title="Delete expense record"
                      style={{
                        background: "rgba(239, 68, 68, 0.1)",
                        border: "1px solid rgba(239, 68, 68, 0.2)",
                        color: "#ef4444",
                        padding: "6px 10px",
                        borderRadius: 10,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 12,
                        fontWeight: 700,
                        transition: "all 0.2s ease"
                      }}
                    >
                      <IconTrash size={14} />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Manual Add Transaction Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>Log Transaction</h2>
            <form onSubmit={handleAddTransaction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Description</span>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Grocery Shopping or Salary Credit"
                  style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--ink)" }}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Type</span>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as "Income" | "Expense")}
                    style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--ink)" }}
                  >
                    <option value="Expense">Expense (-)</option>
                    <option value="Income">Income (+)</option>
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Amount (₹)</span>
                  <input
                    type="number"
                    required
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 1500"
                    style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--ink)" }}
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Category</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--ink)" }}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Date</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--ink)" }}
                  />
                </label>
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Notes (Optional)</span>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional context or account info"
                  style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--ink)" }}
                />
              </label>

              {formError && <p className="upload-message upload-message--error">{formError}</p>}

              <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button type="button" className="filter-pill" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Auto SMS & Screenshot AI Extraction Modal */}
      {showSyncModal && (
        <div className="modal-backdrop" onClick={() => setShowSyncModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>✨ Instant Transaction AI Extractor</h2>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
              No manual typing required! Auto-detect copied bank SMS text or upload a GPay / PhonePe / Paytm payment screenshot.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleClipboardAutoDetect}
                style={{ width: "100%", justifyContent: "center", fontSize: 12.5, padding: "10px" }}
              >
                📋 1-Tap Auto-Paste SMS
              </button>

              <label
                className="btn-secondary"
                style={{ width: "100%", justifyContent: "center", fontSize: 12.5, padding: "10px", cursor: "pointer", background: "rgba(168, 85, 247, 0.15)", color: "#c084fc", borderColor: "rgba(168, 85, 247, 0.3)" }}
              >
                <input type="file" accept="image/*" onChange={handleScreenshotUpload} style={{ display: "none" }} />
                📷 Upload Screenshot / Receipt
              </label>
            </div>

            <form onSubmit={handleSmsParseSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <textarea
                rows={4}
                value={testSmsInput}
                onChange={(e) => setTestSmsInput(e.target.value)}
                placeholder="Or paste SMS text here, e.g. 'Rs 450.00 debited from A/c XX1234 at Swiggy on 23-Sep-2026...'"
                style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--ink)", font: "inherit", fontSize: 13 }}
              />
              {syncMessage && (
                <p className={`upload-message ${syncMessage.isError ? "upload-message--error" : ""}`}>{syncMessage.text}</p>
              )}
              <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="filter-pill" onClick={() => setShowSyncModal(false)}>
                  Close
                </button>
                <button type="submit" className="primary-button" disabled={isTestingSms || !testSmsInput.trim()}>
                  {isTestingSms ? "Extracting..." : "Extract & Save"}
                </button>
              </div>
            </form>

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)", fontSize: 12, color: "var(--muted)" }}>
              <strong>📲 Automatic Background SMS Syncing:</strong>
              <p style={{ margin: "4px 0 0", fontSize: 11.5, lineHeight: 1.4 }}>
                Download the native <strong>LifeOS Android App (APK)</strong> with built-in background bank SMS interceptor:{" "}
                <a
                  href="https://github.com/suhasreddys/lifeos/releases/download/v1.0.0/app-debug.apk"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#818cf8", fontWeight: 700, textDecoration: "underline" }}
                >
                  📥 Download LifeOS.apk Directly
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
