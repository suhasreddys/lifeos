"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DocumentRecord } from "../api/documents/route";

const categories = ["Agreements", "Certificates", "IDs & records", "Bills", "Insurance", "General"];
const categoryIcons = ["✦", "✓", "▣", "₹", "♡", "📁"];
const categoryDescriptions = [
  "Contracts and leases",
  "Education and achievements",
  "Personal identification",
  "Receipts and statements",
  "Policies and claims",
  "General & uncategorized files",
];

function matchCategory(docCategory: string, targetCategory: string): boolean {
  if (targetCategory === "All") return true;
  const doc = (docCategory || "").toLowerCase().trim();
  const target = (targetCategory || "").toLowerCase().trim();

  if (doc === target) return true;

  if (target === "certificates") {
    return doc.includes("certif") || doc.includes("degree") || doc.includes("grade") || doc.includes("sgpa") || doc.includes("report") || doc.includes("resume") || doc.includes("edu");
  }
  if (target === "ids & records") {
    return doc.includes("id") || doc.includes("ident") || doc.includes("passport") || doc.includes("record");
  }
  if (target === "agreements") {
    return doc.includes("agree") || doc.includes("lease") || doc.includes("contract") || doc.includes("rent");
  }
  if (target === "bills") {
    return doc.includes("bill") || doc.includes("receipt") || doc.includes("invoice") || doc.includes("finan");
  }
  if (target === "insurance") {
    return doc.includes("insur") || doc.includes("policy") || doc.includes("claim") || doc.includes("medic");
  }
  if (target === "general") {
    return doc === "general" || doc === "other" || (!matchCategory(docCategory, "Agreements") && !matchCategory(docCategory, "Certificates") && !matchCategory(docCategory, "IDs & records") && !matchCategory(docCategory, "Bills") && !matchCategory(docCategory, "Insurance"));
  }
  return false;
}

function formatSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function documentIcon(type: string) {
  return type.includes("pdf") ? "PDF" : type.includes("image") ? "IMG" : "DOC";
}

function getExpiryStatus(document: DocumentRecord) {
  if (!document.analysis?.expiryDate) return null;
  const expDate = new Date(document.analysis.expiryDate);
  if (isNaN(expDate.getTime())) return null;
  const today = new Date();
  const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: "Expired", type: "expired" };
  if (diffDays <= 30) return { label: `Expires in ${diffDays}d`, type: "expiring" };
  return { label: `Expires ${document.analysis.expiryDate}`, type: "active" };
}

export default function DocumentVault() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState(categories[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage.getItem("lifeos_vault_alert_dismissed") === "true") {
        setIsAlertDismissed(true);
      }
    } catch {}
  }, []);

  function dismissAlert() {
    setIsAlertDismissed(true);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("lifeos_vault_alert_dismissed", "true");
      }
    } catch {}
  }

  useEffect(() => {
    fetch("/api/documents")
      .then(async (response) => response.ok ? (response.json() as Promise<DocumentRecord[]>) : Promise.reject())
      .then((savedDocuments) => setDocuments(savedDocuments))
      .catch(() => setMessage("Your saved documents could not be loaded."));
  }, []);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setMessage("");
  }

  const visibleDocuments = documents.filter((document) =>
    document.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    matchCategory(document.category, activeCategory),
  );

  const urgentDocuments = documents.filter((doc) => {
    const status = getExpiryStatus(doc);
    return status?.type === "expired" || status?.type === "expiring" || (doc.analysis?.actionItems && doc.analysis.actionItems.length > 0);
  });

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setMessage("Choose a document before saving it to your vault.");
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("category", "General");
      const response = await fetch("/api/documents", { method: "POST", body: formData });

      const responseText = await response.text();
      let result: any = {};
      try {
        result = responseText.trim() ? JSON.parse(responseText.trim()) : {};
      } catch {
        throw new Error(
          response.ok
            ? "Document was uploaded, but the server response could not be read. Please refresh your vault."
            : `Could not save document (Server status: ${response.status}). Please try a smaller file.`
        );
      }

      if (!response.ok) {
        throw new Error(result.error ?? `Could not save document (Server status: ${response.status})`);
      }

      const document = result as DocumentRecord;
      setDocuments((current) => [document, ...current.filter((d) => d.id !== document.id)]);
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setMessage("Document saved! Gemini AI has categorized & analyzed your file.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not save that document. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(docId: string, docName: string) {
    if (!window.confirm(`Are you sure you want to remove "${docName}" from your vault?`)) return;

    try {
      const response = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Could not remove document.");
      }
      setDocuments((current) => current.filter((d) => d.id !== docId));
      setMessage(`"${docName}" has been removed from your vault.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to remove document.");
    }
  }

  return (
    <>
      {!isAlertDismissed && urgentDocuments.length > 0 && (
        <section className="expiry-alert-banner" aria-label="Urgent document alerts">
          <span className="expiry-alert-icon">⚠️</span>
          <div>
            <strong>Reminders & Renewal Alerts</strong>
            <p>You have {urgentDocuments.length} document(s) requiring attention or with upcoming renewal dates.</p>
          </div>
          <button
            className="alert-dismiss-btn"
            type="button"
            onClick={dismissAlert}
            title="Dismiss warning banner"
          >
            ✕ Dismiss
          </button>
        </section>
      )}

      <section className="vault-summary" aria-label="Document summary">
        <div><strong>{documents.length}</strong><span>{documents.length === 1 ? "document saved" : "documents saved"}</span></div>
        <p>Your files are saved locally in your LifeOS project with automatic Gemini AI analysis and renewal tracking.</p>
      </section>

      <section className="upload-panel" aria-labelledby="upload-title">
        <div><p className="eyebrow">ADD A DOCUMENT</p><h2 id="upload-title">Save something important</h2><p>PDFs, images, and common document files are supported.</p></div>
        <form className="upload-form" onSubmit={handleUpload}>
          <label className="file-picker" style={{ flex: 1 }}><input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={chooseFile} /><span>{selectedFile ? selectedFile.name : "Choose a file"}</span><b>Browse</b></label>
          <button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save document"}</button>
        </form>
        {message && <p className="upload-message" role="status">{message}</p>}
      </section>

      <section className="section" aria-labelledby="categories-title">
        <div className="section-heading"><div><p className="eyebrow">CATEGORIES</p><h2 id="categories-title">Organize from the start</h2></div></div>
        <div className="category-grid">
          {categories.map((item, index) => (
            <button
              className={`category-card ${activeCategory === item ? "category-card--active" : ""}`}
              key={item}
              type="button"
              onClick={() => setActiveCategory(activeCategory === item ? "All" : item)}
            >
              <span className="category-card__icon" aria-hidden="true">{categoryIcons[index]}</span>
              <h3>{item}</h3>
              <p>{categoryDescriptions[index]}</p>
              <span className="category-card__count">
                {documents.filter((document) => matchCategory(document.category, item)).length} {documents.filter((document) => matchCategory(document.category, item)).length === 1 ? "document" : "documents"}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="document-list section" aria-labelledby="documents-title">
        <div className="section-heading"><div><p className="eyebrow">YOUR DOCUMENTS</p><h2 id="documents-title">Recent uploads</h2></div><span className="result-count">{visibleDocuments.length} shown</span></div>
        <div className="vault-tools"><label className="search-box"><span aria-hidden="true">⌕</span><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search documents" type="search" /></label><div className="filter-pills">{["All", ...categories].map((item) => <button className={activeCategory === item ? "filter-pill filter-pill--active" : "filter-pill"} key={item} type="button" onClick={() => setActiveCategory(item)}>{item}</button>)}</div></div>
        {documents.length === 0 ? <div className="empty-state"><span className="empty-state__icon" aria-hidden="true">📄</span><h2>Your vault is ready</h2><p>Your uploaded documents will appear here.</p></div> : visibleDocuments.length === 0 ? <div className="empty-state"><span className="empty-state__icon" aria-hidden="true">⌕</span><h2>No matching documents</h2><p>Try a different search or choose another category.</p></div> : <div className="document-rows">{visibleDocuments.map((document) => {
          const status = getExpiryStatus(document);
          return (
            <div className="document-row" key={document.id}>
              <Link className="document-row-content" href={`/documents/${document.id}`}>
                <span className="document-type">{documentIcon(document.type)}</span>
                <div>
                  <h3>{document.name}</h3>
                  <p>{document.category} · {formatSize(document.size)} · Added {new Date(document.uploadedAt).toLocaleDateString()}</p>
                </div>
                {status && <span className={`status-badge status-badge--${status.type}`}>{status.label}</span>}
                {document.analysis?.actionItems && document.analysis.actionItems.length > 0 && <span className="status-badge status-badge--action">Follow-up</span>}
                <span className="document-open" aria-hidden="true">Open →</span>
              </Link>
              <button
                className="delete-doc-button"
                type="button"
                onClick={() => handleDelete(document.id, document.name)}
                title={`Delete ${document.name}`}
                aria-label={`Delete ${document.name}`}
              >
                🗑️
              </button>
            </div>
          );
        })}</div>}
      </section>
    </>
  );
}
