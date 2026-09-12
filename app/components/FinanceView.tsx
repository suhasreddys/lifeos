"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { TransactionRecord } from "../api/finance/route";
import UpiPaymentModal from "./UpiPaymentModal";

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
  const [upiModalData, setUpiModalData] = useState<{ isOpen: boolean; recipientName: string; amount: number; note: string }>({
    isOpen: false,
    recipientName: "",
    amount: 0,
    note: ""
  });

  const [data, setData] = useState<FinanceData>({
    summary: { netBalance: 0, totalIncome: 0, totalExpenses: 0, transactionCount: 0 },
    transactions: []
  });
  const [activeFilter, setActiveFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"Income" | "Expense">("Expense");
  const [category, setCategory] = useState("Bills");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetch("/api/finance")
      .then(async (res) => (res.ok ? (res.json() as Promise<FinanceData>) : null))
      .then((resData) => {
        if (resData) setData(resData);
      })
      .catch(() => {});
  }, []);

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
        body: JSON.stringify({ title, amount: numAmount, type, category, date, notes })
      });
      const created = (await res.json()) as TransactionRecord & { error?: string };
      if (!res.ok) throw new Error(created.error ?? "Failed to save entry");

      // Refetch updated data
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

  const visibleTx = data.transactions.filter((t) => {
    if (activeFilter === "Income") return t.type === "Income";
    if (activeFilter === "Expenses") return t.type === "Expense";
    if (activeFilter === "Bills & Receipts") return t.source === "document";
    return true;
  });

  return (
    <>
      <section className="overview" aria-label="Finance summary" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <div style={{ background: "rgba(99, 102, 241, 0.08)", border: "1px solid rgba(99, 102, 241, 0.2)", borderRadius: 14, padding: 18, borderLeft: "4px solid #6366f1" }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "#a5b4fc", display: "block", marginBottom: 6, letterSpacing: "0.5px" }}>Net Balance</span>
          <strong style={{ color: "#818cf8", fontSize: "1.5rem", fontWeight: 800, display: "block" }}>{formatCurrency(data.summary.netBalance)}</strong>
          <span style={{ fontSize: "0.76rem", color: "var(--muted)" }}>Total cashflow balance</span>
        </div>
        <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 14, padding: 18, borderLeft: "4px solid #10b981" }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "#6ee7b7", display: "block", marginBottom: 6, letterSpacing: "0.5px" }}>Total Income</span>
          <strong style={{ color: "#34d399", fontSize: "1.5rem", fontWeight: 800, display: "block" }}>+{formatCurrency(data.summary.totalIncome)}</strong>
          <span style={{ fontSize: "0.76rem", color: "var(--muted)" }}>Recorded earnings</span>
        </div>
        <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 14, padding: 18, borderLeft: "4px solid #ef4444" }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "#fca5a5", display: "block", marginBottom: 6, letterSpacing: "0.5px" }}>Total Expenses</span>
          <strong style={{ color: "#f87171", fontSize: "1.5rem", fontWeight: 800, display: "block" }}>-{formatCurrency(data.summary.totalExpenses)}</strong>
          <span style={{ fontSize: "0.76rem", color: "var(--muted)" }}>Recorded spending</span>
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
              style={{
                background: activeFilter === f ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.04)",
                border: `1px solid ${activeFilter === f ? "rgba(99, 102, 241, 0.4)" : "rgba(255, 255, 255, 0.1)"}`,
                color: activeFilter === f ? "#a5b4fc" : "var(--muted)",
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => setUpiModalData({ isOpen: true, recipientName: "Personal Payment", amount: 0, note: "Quick UPI Transfer" })}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              color: "#34d399",
              fontWeight: 800,
              fontSize: "0.85rem",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            ⚡ Instant UPI Pay & QR
          </button>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            style={{
              padding: "8px 18px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              color: "#ffffff",
              border: "none",
              fontWeight: 800,
              fontSize: "0.85rem",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(99, 102, 241, 0.25)",
              transition: "all 0.2s"
            }}
          >
            + Add Entry
          </button>
        </div>
      </div>

      <section className="document-list section" style={{ paddingTop: 20 }} aria-labelledby="finance-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">TRANSACTIONS & DOCUMENTS</p>
            <h2 id="finance-title">Financial Records</h2>
          </div>
          <span className="result-count">{visibleTx.length} records</span>
        </div>

        {visibleTx.length === 0 ? (
          <div
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 14,
              padding: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              marginTop: 12
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "rgba(99, 102, 241, 0.12)",
                  border: "1px solid rgba(99, 102, 241, 0.25)",
                  color: "#818cf8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                  fontWeight: 800
                }}
              >
                ₹
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>No transactions recorded yet</h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>Log your income, expenses, or bills to track cashflow.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowModal(true)}
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                background: "rgba(99, 102, 241, 0.15)",
                border: "1px solid rgba(99, 102, 241, 0.35)",
                color: "#a5b4fc",
                fontSize: "0.82rem",
                fontWeight: 800,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              + Add First Entry
            </button>
          </div>
        ) : (
          <div className="document-rows">
            {visibleTx.map((tx) => (
              <div key={tx.id} className="document-row">
                <span className={`document-type ${tx.type === "Income" ? "tx-type--income" : "tx-type--expense"}`}>
                  {tx.type === "Income" ? "IN" : "OUT"}
                </span>
                <div style={{ flex: 1 }}>
                  <h3>{tx.title}</h3>
                  <p>{tx.category} · {tx.date} {tx.notes ? `· ${tx.notes}` : ""}</p>
                </div>

                <div style={{ textAlign: "right" }}>
                  <strong className={`tx-amount ${tx.type === "Income" ? "tx-amount--income" : "tx-amount--expense"}`}>
                    {tx.type === "Income" ? "+" : "-"}{formatCurrency(tx.amount)}
                  </strong>
                </div>

                {tx.documentId && (
                  <Link className="document-open" href={`/documents/${tx.documentId}`}>
                    Doc →
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add Transaction Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Add Financial Entry</h2>
            <form onSubmit={handleAddTransaction} className="modal-form">
              <label>
                <span>Entry Title</span>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Monthly Salary, House Rent, Grocery Bill"
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label>
                  <span>Type</span>
                  <select value={type} onChange={(e) => setType(e.target.value as "Income" | "Expense")}>
                    <option value="Expense">Expense (-)</option>
                    <option value="Income">Income (+)</option>
                  </select>
                </label>
                <label>
                  <span>Amount (₹)</span>
                  <input
                    type="number"
                    step="1"
                    required
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 5000"
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label>
                  <span>Category</span>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Date</span>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
              </div>

              <label>
                <span>Notes (Optional)</span>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Payment mode, invoice number, or context..."
                />
              </label>

              {formError && <p className="upload-message upload-message--error">{formError}</p>}
              <div className="modal-actions">
                <button type="button" className="filter-pill" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Entry"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <UpiPaymentModal
        isOpen={upiModalData.isOpen}
        onClose={() => setUpiModalData((prev) => ({ ...prev, isOpen: false }))}
        recipientName={upiModalData.recipientName}
        amount={upiModalData.amount}
        note={upiModalData.note}
      />
    </>
  );
}
