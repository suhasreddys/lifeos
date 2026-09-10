"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type {
  RentalDataStore,
  PropertyRecord,
  RentPaymentRecord,
  DepositRecord,
  MaintenanceRecord,
  MeterReadingRecord,
  NoticeRecord,
  MoveInspectionRecord
} from "../api/rental/route";

type RentalResponse = {
  summary: {
    totalProperties: number;
    occupiedUnits: number;
    totalMonthlyRent: number;
    totalCollectedRent: number;
    totalDepositsHeld: number;
    openMaintenanceTickets: number;
  };
  data: RentalDataStore;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export default function RentalManagerView() {
  const [data, setData] = useState<RentalResponse["data"]>({
    properties: [],
    payments: [],
    deposits: [],
    maintenance: [],
    meterReadings: [],
    notices: [],
    inspections: []
  });

  const [summary, setSummary] = useState<RentalResponse["summary"]>({
    totalProperties: 0,
    occupiedUnits: 0,
    totalMonthlyRent: 0,
    totalCollectedRent: 0,
    totalDepositsHeld: 0,
    openMaintenanceTickets: 0
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadFileName, setUploadFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const [activeTab, setActiveTab] = useState<"properties" | "payments" | "maintenance" | "meter" | "notices">("properties");
  const [activeModal, setActiveModal] = useState<"property" | "payment" | "maintenance" | "meter" | "notice" | "inspection" | "agreement" | null>(null);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [agreementText, setAgreementText] = useState("");

  // Property Form state
  const [propName, setPropName] = useState("");
  const [propUnit, setPropUnit] = useState("");
  const [propAddress, setPropAddress] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [securityDeposit, setSecurityDeposit] = useState("");
  const [leaseStart, setLeaseStart] = useState("");
  const [leaseEnd, setLeaseEnd] = useState("");
  const [propStatus, setPropStatus] = useState<"Occupied" | "Vacant" | "Maintenance">("Occupied");

  // Rent Payment Form state
  const [payPropertyId, setPayPropertyId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payPeriod, setPayPeriod] = useState("");
  const [payMethod, setPayMethod] = useState("Bank Transfer");
  const [payStatus, setPayStatus] = useState<"Paid" | "Pending" | "Overdue">("Paid");

  // Maintenance Form state
  const [maintPropertyId, setMaintPropertyId] = useState("");
  const [maintTitle, setMaintTitle] = useState("");
  const [maintDescription, setMaintDescription] = useState("");
  const [maintPriority, setMaintPriority] = useState<"Low" | "Medium" | "High" | "Emergency">("Medium");
  const [maintStatus, setMaintStatus] = useState<"Open" | "In Progress" | "Resolved">("Open");
  const [maintCost, setMaintCost] = useState("");

  // Meter Reading Form state
  const [meterPropertyId, setMeterPropertyId] = useState("");
  const [meterType, setMeterType] = useState<"Electricity" | "Water" | "Gas">("Electricity");
  const [meterPrev, setMeterPrev] = useState("");
  const [meterCurr, setMeterCurr] = useState("");
  const [meterAmount, setMeterAmount] = useState("");

  // Notice Form state
  const [noticePropertyId, setNoticePropertyId] = useState("");
  const [noticeType, setNoticeType] = useState<NoticeRecord["noticeType"]>("Maintenance Entry");
  const [noticeDetails, setNoticeDetails] = useState("");
  const [noticeEffectiveDate, setNoticeEffectiveDate] = useState("");
  const [noticeStatus, setNoticeStatus] = useState<"Sent" | "Acknowledged" | "Pending Action">("Sent");

  // Inspection Form state
  const [inspPropertyId, setInspPropertyId] = useState("");
  const [inspType, setInspType] = useState<"Move-In" | "Move-Out">("Move-In");
  const [inspWalls, setInspWalls] = useState("Freshly painted, no marks");
  const [inspPlumbing, setInspPlumbing] = useState("All faucets working, no leaks");
  const [inspKeys, setInspKeys] = useState("3");
  const [inspScore, setInspScore] = useState("9");
  const [inspNotes, setInspNotes] = useState("");

  const loadData = () => {
    fetch("/api/rental")
      .then(async (res) => (res.ok ? (res.json() as Promise<RentalResponse>) : null))
      .then((resData) => {
        if (resData) {
          setData(resData.data);
          setSummary(resData.summary);
          if (resData.data.properties.length > 0 && !payPropertyId) {
            setPayPropertyId(resData.data.properties[0].id);
            setMaintPropertyId(resData.data.properties[0].id);
            setMeterPropertyId(resData.data.properties[0].id);
            setNoticePropertyId(resData.data.properties[0].id);
            setInspPropertyId(resData.data.properties[0].id);
          }
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = (modalType: "property" | "payment" | "maintenance" | "meter" | "notice" | "inspection") => {
    setEditingItem(null);
    setFormError("");
    // Reset forms
    if (modalType === "property") {
      setPropName(""); setPropUnit(""); setPropAddress(""); setTenantName(""); setTenantPhone(""); setTenantEmail("");
      setMonthlyRent(""); setSecurityDeposit(""); setLeaseStart(""); setLeaseEnd(""); setPropStatus("Occupied");
    } else if (modalType === "payment") {
      setPayAmount(""); setPayPeriod(""); setPayMethod("Bank Transfer"); setPayStatus("Paid");
      if (data.properties.length) setPayPropertyId(data.properties[0].id);
    } else if (modalType === "maintenance") {
      setMaintTitle(""); setMaintDescription(""); setMaintPriority("Medium"); setMaintStatus("Open"); setMaintCost("");
      if (data.properties.length) setMaintPropertyId(data.properties[0].id);
    } else if (modalType === "meter") {
      setMeterPrev(""); setMeterCurr(""); setMeterAmount(""); setMeterType("Electricity");
      if (data.properties.length) setMeterPropertyId(data.properties[0].id);
    } else if (modalType === "notice") {
      setNoticeType("Maintenance Entry"); setNoticeDetails(""); setNoticeEffectiveDate(""); setNoticeStatus("Sent");
      if (data.properties.length) setNoticePropertyId(data.properties[0].id);
    } else if (modalType === "inspection") {
      setInspType("Move-In"); setInspWalls("Freshly painted, no marks"); setInspPlumbing("All faucets working");
      setInspKeys("3"); setInspScore("9"); setInspNotes("");
      if (data.properties.length) setInspPropertyId(data.properties[0].id);
    }
    setActiveModal(modalType);
  };

  const openEditModal = (modalType: "property" | "payment" | "maintenance" | "meter" | "notice" | "inspection", item: any) => {
    setEditingItem(item);
    setFormError("");
    if (modalType === "property") {
      setPropName(item.name || "");
      setPropUnit(item.unit || "");
      setPropAddress(item.address || "");
      setTenantName(item.tenantName || "");
      setTenantPhone(item.tenantPhone || "");
      setTenantEmail(item.tenantEmail || "");
      setMonthlyRent(String(item.monthlyRent || ""));
      setSecurityDeposit(String(item.securityDeposit || ""));
      setLeaseStart(item.leaseStart || "");
      setLeaseEnd(item.leaseEnd || "");
      setPropStatus(item.status || "Occupied");
    } else if (modalType === "payment") {
      setPayPropertyId(item.propertyId);
      setPayAmount(String(item.amount || ""));
      setPayPeriod(item.period || "");
      setPayMethod(item.method || "Bank Transfer");
      setPayStatus(item.status || "Paid");
    } else if (modalType === "maintenance") {
      setMaintPropertyId(item.propertyId);
      setMaintTitle(item.title || "");
      setMaintDescription(item.description || "");
      setMaintPriority(item.priority || "Medium");
      setMaintStatus(item.status || "Open");
      setMaintCost(item.cost !== undefined ? String(item.cost) : "");
    } else if (modalType === "meter") {
      setMeterPropertyId(item.propertyId);
      setMeterType(item.meterType || "Electricity");
      setMeterPrev(String(item.previousReading || ""));
      setMeterCurr(String(item.currentReading || ""));
      setMeterAmount(item.amount !== undefined ? String(item.amount) : "");
    } else if (modalType === "notice") {
      setNoticePropertyId(item.propertyId);
      setNoticeType(item.noticeType || "Maintenance Entry");
      setNoticeDetails(item.details || "");
      setNoticeEffectiveDate(item.effectiveDate || "");
      setNoticeStatus(item.status || "Sent");
    } else if (modalType === "inspection") {
      setInspPropertyId(item.propertyId);
      setInspType(item.type || "Move-In");
      setInspWalls(item.wallsCondition || "");
      setInspPlumbing(item.plumbingCondition || "");
      setInspKeys(String(item.keysHanded || "3"));
      setInspScore(String(item.cleanlinessScore || "9"));
      setInspNotes(item.notes || "");
    }
    setActiveModal(modalType);
  };

  async function handleDelete(section: string, id: string, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      const res = await fetch("/api/rental", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_item", section, id })
      });
      if (res.ok) loadData();
    } catch {
      alert("Failed to delete item.");
    }
  }

  async function handleFormSubmit(e: FormEvent, defaultAction: string, payload: Record<string, unknown>) {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError("");

    const action = editingItem
      ? defaultAction.replace("create_", "update_").replace("log_", "update_")
      : defaultAction;

    const requestPayload = editingItem
      ? { action, id: editingItem.id, ...payload }
      : { action, ...payload };

    try {
      const res = await fetch("/api/rental", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to submit.");
      
      loadData();
      setActiveModal(null);
      setEditingItem(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDirectFileUpload(file: File) {
    setIsUploadingFile(true);
    setUploadFileName(file.name);
    setFormError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/rental", { method: "POST", body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to process document.");

      loadData();
    } catch (err) {
      alert("Error reading document: " + (err instanceof Error ? err.message : "Failed to analyze document."));
    } finally {
      setIsUploadingFile(false);
      setUploadFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: "0.9rem",
    boxSizing: "border-box" as const
  };

  const labelStyle = {
    display: "block",
    fontSize: "0.82rem",
    fontWeight: 600,
    marginBottom: 4,
    color: "#334155"
  };

  return (
    <>
      {/* Top Overview Cards */}
      <section className="overview" aria-label="Rental summary">
        <div className="overview-card" style={{ background: "#eff6ff", borderColor: "#bfdbfe" }}>
          <span className="overview-card__label">Active Properties</span>
          <strong style={{ color: "#1d4ed8" }}>{summary.totalProperties}</strong>
          <span>{summary.occupiedUnits} unit(s) occupied</span>
        </div>
        <div className="overview-card" style={{ background: "#ecfdf5", borderColor: "#a7f3d0" }}>
          <span className="overview-card__label">Monthly Rent Roll</span>
          <strong style={{ color: "#047857" }}>{formatCurrency(summary.totalMonthlyRent)}</strong>
          <span>Collected: {formatCurrency(summary.totalCollectedRent)}</span>
        </div>
        <div className="overview-card" style={{ background: "#fefce8", borderColor: "#fef08a" }}>
          <span className="overview-card__label">Deposits Held</span>
          <strong style={{ color: "#a16207" }}>{formatCurrency(summary.totalDepositsHeld)}</strong>
          <span>Escrow & Security</span>
        </div>
        <div className="overview-card" style={{ background: "#fff1f2", borderColor: "#fecdd3" }}>
          <span className="overview-card__label">Open Maintenance</span>
          <strong style={{ color: "#be123c" }}>{summary.openMaintenanceTickets}</strong>
          <span>Tickets requiring action</span>
        </div>
      </section>

      {/* Tabs and Action Buttons */}
      <section className="section">
        <div className="section-heading" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="filter-pills">
            <button className={`filter-pill ${activeTab === "properties" ? "filter-pill--active" : ""}`} onClick={() => setActiveTab("properties")}>🏢 Properties & Leases ({data.properties.length})</button>
            <button className={`filter-pill ${activeTab === "payments" ? "filter-pill--active" : ""}`} onClick={() => setActiveTab("payments")}>💳 Rent & Deposits ({data.payments.length})</button>
            <button className={`filter-pill ${activeTab === "maintenance" ? "filter-pill--active" : ""}`} onClick={() => setActiveTab("maintenance")}>🛠️ Maintenance ({data.maintenance.length})</button>
            <button className={`filter-pill ${activeTab === "meter" ? "filter-pill--active" : ""}`} onClick={() => setActiveTab("meter")}>⚡ Meter Readings ({data.meterReadings.length})</button>
            <button className={`filter-pill ${activeTab === "notices" ? "filter-pill--active" : ""}`} onClick={() => setActiveTab("notices")}>📋 Notices & Move-In/Out ({data.notices.length + data.inspections.length})</button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.png,.jpg,.jpeg,.webp"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleDirectFileUpload(file);
            }}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {activeTab === "properties" && (
              <>
                <button
                  className="btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingFile}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  📁 {isUploadingFile ? "Analyzing Document..." : "Upload Lease Agreement (PDF/Image)"}
                </button>
                <button className="btn-secondary" onClick={() => openCreateModal("property")}>+ Manual Property</button>
              </>
            )}
            {activeTab === "payments" && (
              <button className="btn-primary" onClick={() => openCreateModal("payment")}>+ Log Rent Payment</button>
            )}
            {activeTab === "maintenance" && (
              <button className="btn-primary" onClick={() => openCreateModal("maintenance")}>+ New Maintenance Ticket</button>
            )}
            {activeTab === "meter" && (
              <button className="btn-primary" onClick={() => openCreateModal("meter")}>+ Log Meter Reading</button>
            )}
            {activeTab === "notices" && (
              <>
                <button className="btn-primary" onClick={() => openCreateModal("notice")}>+ Issue Notice</button>
                <button className="btn-secondary" onClick={() => openCreateModal("inspection")}>+ Record Move-In/Out</button>
              </>
            )}
          </div>
        </div>

        {/* TAB 1: PROPERTIES & LEASES */}
        {activeTab === "properties" && (
          <div>
            {isUploadingFile ? (
              <div style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", color: "#ffffff", padding: "16px 20px", borderRadius: 10, marginBottom: 20, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 10px 25px rgba(99,102,241,0.25)" }}>
                <span style={{ fontSize: "1.5rem" }}>✨</span>
                <div>
                  <strong style={{ display: "block", fontSize: "1rem" }}>Reading & Extracting Lease Document...</strong>
                  <span style={{ fontSize: "0.85rem", opacity: 0.9 }}>File: &quot;{uploadFileName}&quot; — Extracting property, tenant, rent, deposit, and lease dates...</span>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleDirectFileUpload(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragging ? "#6366f1" : "#cbd5e1"}`,
                  background: isDragging ? "#e0e7ff" : "rgba(248, 250, 252, 0.5)",
                  borderRadius: 10,
                  padding: "16px 20px",
                  textAlign: "center",
                  cursor: "pointer",
                  marginBottom: 20,
                  transition: "all 0.2s ease"
                }}
              >
                <span style={{ fontSize: "1.2rem", display: "inline-block", marginRight: 8 }}>📄</span>
                <strong style={{ fontSize: "0.92rem", color: "#334155" }}>Drag & Drop any Lease Agreement (PDF, Image, Text) here</strong>
                <span style={{ fontSize: "0.82rem", color: "#64748b", display: "block", marginTop: 2 }}>Or click here to select a file directly from your computer</span>
              </div>
            )}

            <div className="reminders-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
              {data.properties.map((prop) => (
              <div key={prop.id} className="document-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span className="document-tag">{prop.status}</span>
                    <strong style={{ fontSize: "1.1rem", color: "var(--brand)" }}>{formatCurrency(prop.monthlyRent)}/mo</strong>
                  </div>
                  <h3 style={{ margin: "4px 0 2px 0", fontSize: "1.2rem", fontWeight: 700 }}>{prop.name}</h3>
                  <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 12 }}>{prop.unit} • {prop.address}</p>

                  <div style={{ background: "rgba(0,0,0,0.03)", padding: 12, borderRadius: 8, fontSize: "0.88rem", marginBottom: 12 }}>
                    <div><strong>Tenant:</strong> {prop.tenantName}</div>
                    {prop.tenantPhone && <div><strong>Phone:</strong> {prop.tenantPhone}</div>}
                    {prop.tenantEmail && <div><strong>Email:</strong> {prop.tenantEmail}</div>}
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed rgba(0,0,0,0.1)" }}>
                      <strong>Lease Period:</strong> {prop.leaseStart} to {prop.leaseEnd}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 8, marginTop: 8 }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Deposit: {formatCurrency(prop.securityDeposit)}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => openEditModal("property", prop)} style={{ background: "none", border: "1px solid #cbd5e1", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: "0.8rem" }}>✏️ Edit</button>
                    <button onClick={() => handleDelete("properties", prop.id, prop.name)} style={{ background: "none", border: "1px solid #fca5a5", color: "#ef4444", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: "0.8rem" }}>🗑️</button>
                  </div>
                </div>
              </div>
            ))}
            </div>
          </div>
        )}

        {/* TAB 2: RENT & DEPOSITS */}
        {activeTab === "payments" && (
          <div>
            <h3 style={{ marginBottom: 12, fontSize: "1.1rem" }}>Rent Payments Record</h3>
            <div style={{ overflowX: "auto", marginBottom: 28 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid rgba(0,0,0,0.1)", background: "rgba(0,0,0,0.02)" }}>
                    <th style={{ padding: 10 }}>Date</th>
                    <th style={{ padding: 10 }}>Property / Unit</th>
                    <th style={{ padding: 10 }}>Tenant</th>
                    <th style={{ padding: 10 }}>Period</th>
                    <th style={{ padding: 10 }}>Method</th>
                    <th style={{ padding: 10 }}>Amount</th>
                    <th style={{ padding: 10 }}>Status</th>
                    <th style={{ padding: 10 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                      <td style={{ padding: 10 }}>{p.paymentDate}</td>
                      <td style={{ padding: 10, fontWeight: 600 }}>{p.propertyName}</td>
                      <td style={{ padding: 10 }}>{p.tenantName}</td>
                      <td style={{ padding: 10 }}>{p.period}</td>
                      <td style={{ padding: 10 }}>{p.method}</td>
                      <td style={{ padding: 10, fontWeight: 700, color: "#047857" }}>{formatCurrency(p.amount)}</td>
                      <td style={{ padding: 10 }}>
                        <span className={`reminder-tag reminder-tag--${p.status === "Paid" ? "date" : "expiry"}`}>{p.status}</span>
                      </td>
                      <td style={{ padding: 10 }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => openEditModal("payment", p)} style={{ background: "none", border: "1px solid #cbd5e1", borderRadius: 4, padding: "2px 6px", cursor: "pointer", fontSize: "0.78rem" }}>✏️ Edit</button>
                          <button onClick={() => handleDelete("payments", p.id, `${p.propertyName} Payment`)} style={{ background: "none", border: "1px solid #fca5a5", color: "#ef4444", borderRadius: 4, padding: "2px 6px", cursor: "pointer", fontSize: "0.78rem" }}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 style={{ marginBottom: 12, fontSize: "1.1rem" }}>Security Deposits Ledger</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid rgba(0,0,0,0.1)", background: "rgba(0,0,0,0.02)" }}>
                    <th style={{ padding: 10 }}>Property</th>
                    <th style={{ padding: 10 }}>Tenant</th>
                    <th style={{ padding: 10 }}>Type</th>
                    <th style={{ padding: 10 }}>Paid Date</th>
                    <th style={{ padding: 10 }}>Deposit Amount</th>
                    <th style={{ padding: 10 }}>Status</th>
                    <th style={{ padding: 10 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.deposits.map((d) => (
                    <tr key={d.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                      <td style={{ padding: 10, fontWeight: 600 }}>{d.propertyName}</td>
                      <td style={{ padding: 10 }}>{d.tenantName}</td>
                      <td style={{ padding: 10 }}>{d.type}</td>
                      <td style={{ padding: 10 }}>{d.paidDate}</td>
                      <td style={{ padding: 10, fontWeight: 700, color: "#a16207" }}>{formatCurrency(d.amount)}</td>
                      <td style={{ padding: 10 }}>
                        <span className="reminder-tag reminder-tag--action">{d.status}</span>
                      </td>
                      <td style={{ padding: 10 }}>
                        <button onClick={() => handleDelete("deposits", d.id, `${d.propertyName} Deposit`)} style={{ background: "none", border: "1px solid #fca5a5", color: "#ef4444", borderRadius: 4, padding: "2px 6px", cursor: "pointer", fontSize: "0.78rem" }}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: MAINTENANCE REQUESTS */}
        {activeTab === "maintenance" && (
          <div className="reminders-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
            {data.maintenance.map((maint) => (
              <div key={maint.id} className="document-card" style={{ borderLeft: `4px solid ${maint.priority === "Emergency" || maint.priority === "High" ? "#ef4444" : "#f59e0b"}`, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span className={`reminder-tag ${maint.priority === "Emergency" || maint.priority === "High" ? "reminder-tag--expiry" : "reminder-tag--action"}`}>
                      {maint.priority.toUpperCase()} PRIORITY
                    </span>
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: maint.status === "Resolved" ? "#10b981" : "#f59e0b" }}>{maint.status}</span>
                  </div>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "4px 0" }}>{maint.title}</h3>
                  <p style={{ fontSize: "0.88rem", color: "var(--muted)", marginBottom: 12 }}>{maint.description}</p>
                  <div style={{ fontSize: "0.82rem", background: "rgba(0,0,0,0.03)", padding: 8, borderRadius: 6 }}>
                    <div><strong>Property:</strong> {maint.propertyName}</div>
                    <div><strong>Requested By:</strong> {maint.requestedBy}</div>
                    {maint.cost !== undefined && <div><strong>Estimated Cost:</strong> {formatCurrency(maint.cost)}</div>}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 8, marginTop: 8 }}>
                  <button onClick={() => openEditModal("maintenance", maint)} style={{ background: "none", border: "1px solid #cbd5e1", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: "0.8rem" }}>✏️ Edit</button>
                  <button onClick={() => handleDelete("maintenance", maint.id, maint.title)} style={{ background: "none", border: "1px solid #fca5a5", color: "#ef4444", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: "0.8rem" }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: METER READINGS */}
        {activeTab === "meter" && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid rgba(0,0,0,0.1)", background: "rgba(0,0,0,0.02)" }}>
                  <th style={{ padding: 10 }}>Date</th>
                  <th style={{ padding: 10 }}>Property</th>
                  <th style={{ padding: 10 }}>Meter Utility</th>
                  <th style={{ padding: 10 }}>Prev Reading</th>
                  <th style={{ padding: 10 }}>Current Reading</th>
                  <th style={{ padding: 10 }}>Units Consumed</th>
                  <th style={{ padding: 10 }}>Utility Cost</th>
                  <th style={{ padding: 10 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.meterReadings.map((mr) => (
                  <tr key={mr.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                    <td style={{ padding: 10 }}>{mr.readingDate}</td>
                    <td style={{ padding: 10, fontWeight: 600 }}>{mr.propertyName}</td>
                    <td style={{ padding: 10 }}>
                      <span className="reminder-tag reminder-tag--date">{mr.meterType}</span>
                    </td>
                    <td style={{ padding: 10 }}>{mr.previousReading} {mr.unit}</td>
                    <td style={{ padding: 10 }}>{mr.currentReading} {mr.unit}</td>
                    <td style={{ padding: 10, fontWeight: 700, color: "var(--brand)" }}>{mr.consumption} {mr.unit}</td>
                    <td style={{ padding: 10, fontWeight: 600 }}>{mr.amount ? formatCurrency(mr.amount) : "N/A"}</td>
                    <td style={{ padding: 10 }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => openEditModal("meter", mr)} style={{ background: "none", border: "1px solid #cbd5e1", borderRadius: 4, padding: "2px 6px", cursor: "pointer", fontSize: "0.78rem" }}>✏️ Edit</button>
                        <button onClick={() => handleDelete("meterReadings", mr.id, `${mr.meterType} Reading`)} style={{ background: "none", border: "1px solid #fca5a5", color: "#ef4444", borderRadius: 4, padding: "2px 6px", cursor: "pointer", fontSize: "0.78rem" }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 5: NOTICES & INSPECTIONS */}
        {activeTab === "notices" && (
          <div>
            <h3 style={{ marginBottom: 12, fontSize: "1.1rem" }}>Tenant Notices & Communications</h3>
            <div className="reminders-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", marginBottom: 28 }}>
              {data.notices.map((not) => (
                <div key={not.id} className="document-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span className="reminder-tag reminder-tag--expiry">{not.noticeType}</span>
                      <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{not.issueDate}</span>
                    </div>
                    <h4 style={{ margin: "4px 0", fontWeight: 700 }}>{not.propertyName} ({not.tenantName})</h4>
                    <p style={{ fontSize: "0.88rem", margin: "8px 0" }}>{not.details}</p>
                    <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Effective Date: {not.effectiveDate} • Status: {not.status}</div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 8, marginTop: 8 }}>
                    <button onClick={() => openEditModal("notice", not)} style={{ background: "none", border: "1px solid #cbd5e1", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: "0.8rem" }}>✏️ Edit</button>
                    <button onClick={() => handleDelete("notices", not.id, not.noticeType)} style={{ background: "none", border: "1px solid #fca5a5", color: "#ef4444", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: "0.8rem" }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>

            <h3 style={{ marginBottom: 12, fontSize: "1.1rem" }}>Move-In / Move-Out Condition Inspection Records</h3>
            <div className="reminders-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
              {data.inspections.map((insp) => (
                <div key={insp.id} className="document-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span className="reminder-tag reminder-tag--action">{insp.type} INSPECTION</span>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#10b981" }}>Score: {insp.cleanlinessScore}/10</span>
                    </div>
                    <h4 style={{ margin: "4px 0", fontWeight: 700 }}>{insp.propertyName}</h4>
                    <div style={{ fontSize: "0.85rem", background: "rgba(0,0,0,0.03)", padding: 8, borderRadius: 6, margin: "8px 0" }}>
                      <div><strong>Walls:</strong> {insp.wallsCondition}</div>
                      <div><strong>Plumbing:</strong> {insp.plumbingCondition}</div>
                      <div><strong>Keys Handover:</strong> {insp.keysHanded} sets</div>
                      {insp.notes && <div><strong>Notes:</strong> {insp.notes}</div>}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Inspected: {insp.inspectionDate}</div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 8, marginTop: 8 }}>
                    <button onClick={() => openEditModal("inspection", insp)} style={{ background: "none", border: "1px solid #cbd5e1", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: "0.8rem" }}>✏️ Edit</button>
                    <button onClick={() => handleDelete("inspections", insp.id, `${insp.type} Inspection`)} style={{ background: "none", border: "1px solid #fca5a5", color: "#ef4444", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: "0.8rem" }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* HIGH CONTRAST MODALS */}
      {activeModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 16 }}>
          <div style={{ background: "#ffffff", color: "#0f172a", borderRadius: 12, padding: 24, maxWidth: 540, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid #e2e8f0", paddingBottom: 12 }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                {editingItem ? "Edit " : "Add "}
                {activeModal === "property" && "Property & Lease"}
                {activeModal === "payment" && "Rent Payment"}
                {activeModal === "maintenance" && "Maintenance Ticket"}
                {activeModal === "meter" && "Utility Meter Reading"}
                {activeModal === "notice" && "Tenant Notice"}
                {activeModal === "inspection" && "Move-In/Out Inspection"}
              </h2>
              <button onClick={() => { setActiveModal(null); setEditingItem(null); }} style={{ background: "#f1f5f9", border: "none", width: 32, height: 32, borderRadius: "50%", fontSize: "1.2rem", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            {formError && <p style={{ color: "#dc2626", fontSize: "0.88rem", marginBottom: 12, background: "#fef2f2", padding: 8, borderRadius: 6 }}>{formError}</p>}

            {/* FORM 1: Add/Edit Property */}
            {activeModal === "property" && (
              <form onSubmit={(e) => handleFormSubmit(e, "create_property", { name: propName, unit: propUnit, address: propAddress, tenantName, tenantPhone, tenantEmail, monthlyRent, securityDeposit, leaseStart, leaseEnd, status: propStatus })}>
                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Property Name *</label>
                    <input type="text" required placeholder="e.g. Sunset Heights" value={propName} onChange={(e) => setPropName(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={labelStyle}>Unit #</label>
                      <input type="text" placeholder="Apt 4B" value={propUnit} onChange={(e) => setPropUnit(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Monthly Rent (₹) *</label>
                      <input type="number" required placeholder="25000" value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Tenant Name *</label>
                    <input type="text" required placeholder="John Doe" value={tenantName} onChange={(e) => setTenantName(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={labelStyle}>Tenant Phone</label>
                      <input type="text" placeholder="+1 (555) 000-0000" value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Tenant Email</label>
                      <input type="email" placeholder="tenant@example.com" value={tenantEmail} onChange={(e) => setTenantEmail(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={labelStyle}>Lease Start Date</label>
                      <input type="date" value={leaseStart} onChange={(e) => setLeaseStart(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Lease End Date</label>
                      <input type="date" value={leaseEnd} onChange={(e) => setLeaseEnd(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={labelStyle}>Security Deposit (₹)</label>
                      <input type="number" placeholder="25000" value={securityDeposit} onChange={(e) => setSecurityDeposit(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Occupancy Status</label>
                      <select value={propStatus} onChange={(e) => setPropStatus(e.target.value as any)} style={inputStyle}>
                        <option value="Occupied">Occupied</option>
                        <option value="Vacant">Vacant</option>
                        <option value="Maintenance">Maintenance</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ marginTop: 12, padding: "10px 16px" }}>
                    {isSubmitting ? "Saving..." : editingItem ? "Update Property" : "Save Property"}
                  </button>
                </div>
              </form>
            )}

            {/* FORM 2: Log/Edit Rent Payment */}
            {activeModal === "payment" && (
              <form onSubmit={(e) => handleFormSubmit(e, "log_payment", { propertyId: payPropertyId, amount: payAmount, period: payPeriod, method: payMethod, status: payStatus })}>
                <div style={{ display: "grid", gap: 12 }}>
                  {!editingItem && (
                    <div>
                      <label style={labelStyle}>Select Property *</label>
                      <select value={payPropertyId} onChange={(e) => setPayPropertyId(e.target.value)} style={inputStyle}>
                        {data.properties.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.unit}) - {p.tenantName}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={labelStyle}>Amount Paid (₹) *</label>
                      <input type="number" required placeholder="2200" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Period</label>
                      <input type="text" placeholder="September 2026" value={payPeriod} onChange={(e) => setPayPeriod(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={labelStyle}>Payment Method</label>
                      <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} style={inputStyle}>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="UPI">UPI</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Cash">Cash</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Status</label>
                      <select value={payStatus} onChange={(e) => setPayStatus(e.target.value as any)} style={inputStyle}>
                        <option value="Paid">Paid</option>
                        <option value="Pending">Pending</option>
                        <option value="Overdue">Overdue</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ marginTop: 12, padding: "10px 16px" }}>
                    {isSubmitting ? "Logging..." : editingItem ? "Update Payment" : "Log Payment"}
                  </button>
                </div>
              </form>
            )}

            {/* FORM 3: Maintenance Ticket */}
            {activeModal === "maintenance" && (
              <form onSubmit={(e) => handleFormSubmit(e, "create_maintenance", { propertyId: maintPropertyId, title: maintTitle, description: maintDescription, priority: maintPriority, status: maintStatus, cost: maintCost })}>
                <div style={{ display: "grid", gap: 12 }}>
                  {!editingItem && (
                    <div>
                      <label style={labelStyle}>Property *</label>
                      <select value={maintPropertyId} onChange={(e) => setMaintPropertyId(e.target.value)} style={inputStyle}>
                        {data.properties.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label style={labelStyle}>Issue Title *</label>
                    <input type="text" required placeholder="e.g. AC Cooling Issue" value={maintTitle} onChange={(e) => setMaintTitle(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Description *</label>
                    <textarea required placeholder="Explain the problem..." value={maintDescription} onChange={(e) => setMaintDescription(e.target.value)} rows={3} style={inputStyle} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={labelStyle}>Priority</label>
                      <select value={maintPriority} onChange={(e) => setMaintPriority(e.target.value as any)} style={inputStyle}>
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Emergency">Emergency</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Status</label>
                      <select value={maintStatus} onChange={(e) => setMaintStatus(e.target.value as any)} style={inputStyle}>
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Estimated Cost (₹)</label>
                    <input type="number" placeholder="500" value={maintCost} onChange={(e) => setMaintCost(e.target.value)} style={inputStyle} />
                  </div>
                  <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ marginTop: 12, padding: "10px 16px" }}>
                    {isSubmitting ? "Saving..." : editingItem ? "Update Ticket" : "Create Ticket"}
                  </button>
                </div>
              </form>
            )}

            {/* FORM 4: Meter Reading */}
            {activeModal === "meter" && (
              <form onSubmit={(e) => handleFormSubmit(e, "log_meter_reading", { propertyId: meterPropertyId, meterType, previousReading: meterPrev, currentReading: meterCurr, amount: meterAmount })}>
                <div style={{ display: "grid", gap: 12 }}>
                  {!editingItem && (
                    <div>
                      <label style={labelStyle}>Property *</label>
                      <select value={meterPropertyId} onChange={(e) => setMeterPropertyId(e.target.value)} style={inputStyle}>
                        {data.properties.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label style={labelStyle}>Utility Type</label>
                    <select value={meterType} onChange={(e) => setMeterType(e.target.value as any)} style={inputStyle}>
                      <option value="Electricity">Electricity (kWh)</option>
                      <option value="Water">Water (kl)</option>
                      <option value="Gas">Gas (units)</option>
                    </select>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={labelStyle}>Previous Reading</label>
                      <input type="number" placeholder="1000" value={meterPrev} onChange={(e) => setMeterPrev(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Current Reading *</label>
                      <input type="number" required placeholder="1250" value={meterCurr} onChange={(e) => setMeterCurr(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Utility Cost (₹)</label>
                    <input type="number" placeholder="120" value={meterAmount} onChange={(e) => setMeterAmount(e.target.value)} style={inputStyle} />
                  </div>
                  <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ marginTop: 12, padding: "10px 16px" }}>
                    {isSubmitting ? "Saving..." : editingItem ? "Update Reading" : "Save Reading"}
                  </button>
                </div>
              </form>
            )}

            {/* FORM 5: Issue Notice */}
            {activeModal === "notice" && (
              <form onSubmit={(e) => handleFormSubmit(e, "create_notice", { propertyId: noticePropertyId, noticeType, details: noticeDetails, effectiveDate: noticeEffectiveDate, status: noticeStatus })}>
                <div style={{ display: "grid", gap: 12 }}>
                  {!editingItem && (
                    <div>
                      <label style={labelStyle}>Property *</label>
                      <select value={noticePropertyId} onChange={(e) => setNoticePropertyId(e.target.value)} style={inputStyle}>
                        {data.properties.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.unit}) - {p.tenantName}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label style={labelStyle}>Notice Type</label>
                    <select value={noticeType} onChange={(e) => setNoticeType(e.target.value as any)} style={inputStyle}>
                      <option value="Maintenance Entry">Maintenance Entry Notice</option>
                      <option value="Rent Due">Rent Due Notice</option>
                      <option value="Rent Increase">Rent Revision Notice</option>
                      <option value="Lease Expiry">Lease Renewal / Expiry Notice</option>
                      <option value="Notice to Vacate">Notice to Vacate</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Details & Instructions *</label>
                    <textarea required placeholder="Specify notice details..." value={noticeDetails} onChange={(e) => setNoticeDetails(e.target.value)} rows={3} style={inputStyle} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={labelStyle}>Effective Date</label>
                      <input type="date" value={noticeEffectiveDate} onChange={(e) => setNoticeEffectiveDate(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Status</label>
                      <select value={noticeStatus} onChange={(e) => setNoticeStatus(e.target.value as any)} style={inputStyle}>
                        <option value="Sent">Sent</option>
                        <option value="Acknowledged">Acknowledged</option>
                        <option value="Pending Action">Pending Action</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ marginTop: 12, padding: "10px 16px" }}>
                    {isSubmitting ? "Saving..." : editingItem ? "Update Notice" : "Issue Notice"}
                  </button>
                </div>
              </form>
            )}

            {/* FORM 6: Move Inspection */}
            {activeModal === "inspection" && (
              <form onSubmit={(e) => handleFormSubmit(e, "create_inspection", { propertyId: inspPropertyId, type: inspType, wallsCondition: inspWalls, plumbingCondition: inspPlumbing, keysHanded: inspKeys, cleanlinessScore: inspScore, notes: inspNotes })}>
                <div style={{ display: "grid", gap: 12 }}>
                  {!editingItem && (
                    <div>
                      <label style={labelStyle}>Property *</label>
                      <select value={inspPropertyId} onChange={(e) => setInspPropertyId(e.target.value)} style={inputStyle}>
                        {data.properties.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label style={labelStyle}>Inspection Type</label>
                    <select value={inspType} onChange={(e) => setInspType(e.target.value as any)} style={inputStyle}>
                      <option value="Move-In">Move-In Inspection</option>
                      <option value="Move-Out">Move-Out Inspection</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Walls & Paint Condition</label>
                    <input type="text" value={inspWalls} onChange={(e) => setInspWalls(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Plumbing & Fixtures</label>
                    <input type="text" value={inspPlumbing} onChange={(e) => setInspPlumbing(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={labelStyle}>Keys Handed</label>
                      <input type="number" value={inspKeys} onChange={(e) => setInspKeys(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Cleanliness (1-10)</label>
                      <input type="number" min="1" max="10" value={inspScore} onChange={(e) => setInspScore(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Additional Notes</label>
                    <textarea placeholder="Condition notes..." value={inspNotes} onChange={(e) => setInspNotes(e.target.value)} rows={2} style={inputStyle} />
                  </div>
                  <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ marginTop: 12, padding: "10px 16px" }}>
                    {isSubmitting ? "Saving..." : editingItem ? "Update Inspection" : "Record Inspection"}
                  </button>
                </div>
              </form>
            )}

            {/* FORM 7: AI Auto-Extract Agreement (PDF/File Upload & Text) */}
            {activeModal === "agreement" && (
              <div style={{ display: "grid", gap: 16 }}>
                <div style={{ border: "2px dashed #94a3b8", borderRadius: 8, padding: 20, textAlign: "center", background: "#f8fafc" }}>
                  <span style={{ fontSize: "2rem", display: "block", marginBottom: 8 }}>📁</span>
                  <strong style={{ display: "block", fontSize: "1rem", color: "#0f172a", marginBottom: 4 }}>Upload Agreement Document</strong>
                  <p style={{ fontSize: "0.82rem", color: "#64748b", margin: "0 0 12px 0" }}>
                    Select a PDF, Text file, or Scanned Image (PNG, JPG, WEBP). Gemini AI will analyze it directly.
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.txt,.png,.jpg,.jpeg,.webp"
                    disabled={isSubmitting}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setIsSubmitting(true);
                        setFormError("");
                        const formData = new FormData();
                        formData.append("file", file);
                        fetch("/api/rental", { method: "POST", body: formData })
                          .then(async (res) => {
                            const result = await res.json();
                            if (!res.ok) throw new Error(result.error || "Failed to parse document.");
                            loadData();
                            setActiveModal(null);
                          })
                          .catch((err) => {
                            setFormError(err instanceof Error ? err.message : "File analysis error.");
                          })
                          .finally(() => setIsSubmitting(false));
                      }
                    }}
                    style={{ fontSize: "0.88rem" }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 1, background: "#cbd5e1" }} />
                  <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600 }}>OR PASTE TEXT</span>
                  <div style={{ flex: 1, height: 1, background: "#cbd5e1" }} />
                </div>

                <form onSubmit={(e) => handleFormSubmit(e, "parse_agreement_text", { agreementText })}>
                  <div style={{ display: "grid", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Lease Agreement Text / Summary</label>
                      <textarea
                        placeholder="Paste agreement text here..."
                        value={agreementText}
                        onChange={(e) => setAgreementText(e.target.value)}
                        rows={5}
                        style={inputStyle}
                      />
                    </div>
                    <button type="submit" disabled={isSubmitting || !agreementText.trim()} className="btn-primary" style={{ padding: "10px 16px" }}>
                      {isSubmitting ? "🤖 Gemini Extracting & Storing..." : "✨ Extract from Pasted Text"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
