"use client";

import { useEffect, useState } from "react";

type UpiPaymentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  recipientName: string;
  amount: number;
  note: string;
  onMarkAsPaid?: () => void;
};

export default function UpiPaymentModal({
  isOpen,
  onClose,
  recipientName,
  amount,
  note,
  onMarkAsPaid,
}: UpiPaymentModalProps) {
  const [upiId, setUpiId] = useState("suhas@upi");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = window.localStorage.getItem("lifeos_user_upi_id");
        if (saved) setUpiId(saved);
      }
    } catch {}
  }, []);

  function handleSaveUpiId(newId: string) {
    setUpiId(newId);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("lifeos_user_upi_id", newId);
      }
    } catch {}
  }

  if (!isOpen) return null;

  const validAmount = amount > 0 ? amount : 0;
  const encodedName = encodeURIComponent(recipientName || "LifeOS Payment");
  const encodedNote = encodeURIComponent(note || "Rent / Bill Payment");
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodedName}&am=${validAmount}&cu=INR&tn=${encodedNote}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUri)}`;

  function handleCopy() {
    navigator.clipboard.writeText(upiUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ display: "grid", placeItems: "center", zIndex: 1000 }}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 460,
          width: "90%",
          padding: 24,
          borderRadius: 20,
          background: "var(--card-bg, #0f172a)",
          border: "1px solid var(--line, rgba(255,255,255,0.12))",
          boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
          color: "var(--ink, #fff)",
          textAlign: "center"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", color: "#818cf8" }}>⚡ LifeOS Instant UPI Pay</span>
          <button onClick={onClose} style={{ background: "none", border: 0, color: "var(--muted)", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
        </div>

        <h3 style={{ margin: "0 0 4px", fontSize: "1.3rem", fontWeight: 800 }}>
          ₹{validAmount.toLocaleString("en-IN")}
        </h3>
        <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: "0.88rem" }}>
          {note} • {recipientName}
        </p>

        {/* UPI ID SETTING */}
        <div style={{ background: "rgba(99, 102, 241, 0.08)", border: "1px solid rgba(99, 102, 241, 0.2)", borderRadius: 12, padding: 12, marginBottom: 18, textAlign: "left" }}>
          <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#a5b4fc", display: "block", marginBottom: 4 }}>
            Payee UPI VPA / Phone Number:
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={upiId}
              onChange={(e) => handleSaveUpiId(e.target.value)}
              placeholder="e.g. 9876543210@paytm or name@upi"
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--input-border, rgba(255,255,255,0.2))",
                background: "var(--input-bg, rgba(0,0,0,0.3))",
                color: "#fff",
                fontFamily: "monospace",
                fontSize: "0.88rem"
              }}
            />
          </div>
        </div>

        {/* QR CODE DISPLAY */}
        <div style={{ background: "#ffffff", padding: 12, borderRadius: 16, display: "inline-block", marginBottom: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCodeUrl} alt="UPI QR Code" style={{ width: 180, height: 180, display: "block", borderRadius: 8 }} />
        </div>
        <p style={{ margin: "0 0 16px", fontSize: "0.78rem", color: "var(--muted)" }}>
          Scan with GPay, PhonePe, Paytm, or BHIM camera app on mobile
        </p>

        {/* DIRECT APP LINKS FOR MOBILE */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 18 }}>
          <a
            href={upiUri}
            className="primary-button"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 14px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 800,
              fontSize: "0.85rem"
            }}
          >
            📱 Launch UPI App
          </a>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(99, 102, 241, 0.15)",
              border: "1px solid rgba(99, 102, 241, 0.35)",
              color: "#a5b4fc",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer"
            }}
          >
            {copied ? "✓ Copied!" : "📋 Copy UPI Link"}
          </button>
        </div>

        {onMarkAsPaid && (
          <button
            type="button"
            onClick={() => {
              onMarkAsPaid();
              onClose();
            }}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: 10,
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              color: "#34d399",
              fontWeight: 800,
              fontSize: "0.88rem",
              cursor: "pointer"
            }}
          >
            ✓ Mark Payment as Received
          </button>
        )}
      </div>
    </div>
  );
}
