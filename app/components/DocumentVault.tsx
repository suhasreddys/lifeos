"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DocumentRecord } from "../api/documents/route";
import {
  IconDocument,
  IconUpload,
  IconSearch,
  IconTrash,
  IconShieldCheck,
  IconClock,
  IconCheckSquare,
  IconSparkles,
} from "./Icons";

const categories = ["Agreements", "Certificates", "IDs & records", "Bills", "Insurance", "General"];
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
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
      .then(async (response) => (response.ok ? (response.json() as Promise<DocumentRecord[]>) : Promise.reject()))
      .then((savedDocuments) => setDocuments(savedDocuments))
      .catch(() => setMessage("Your saved documents could not be loaded."));
  }, []);

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setSelectedFiles(files);
    setMessage("");
  }

  const visibleDocuments = documents.filter(
    (document) =>
      document.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      matchCategory(document.category, activeCategory)
  );

  const urgentDocuments = documents.filter((doc) => {
    const status = getExpiryStatus(doc);
    return status?.type === "expired" || status?.type === "expiring" || (doc.analysis?.actionItems && doc.analysis.actionItems.length > 0);
  });

  async function compressImageForMobile(file: File): Promise<File> {
    if (!file.type.includes("image") || file.size <= 2 * 1024 * 1024) {
      return file;
    }
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxWidth = 1920;
        const maxHeight = 1920;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          0.82
        );
      };
      img.onerror = () => resolve(file);
      img.src = url;
    });
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedFiles.length === 0) {
      setMessage("Choose one or more documents before saving to your vault.");
      return;
    }

    setIsSaving(true);
    setMessage(`Starting upload for ${selectedFiles.length} file(s)...`);

    const uploadedRecords: DocumentRecord[] = [];
    let failedCount = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      const originalFile = selectedFiles[i];
      setMessage(`Uploading ${i + 1} of ${selectedFiles.length}: "${originalFile.name}"...`);

      try {
        const fileToUpload = await compressImageForMobile(originalFile);
        const chunkSize = 2 * 1024 * 1024; // 2MB chunks for serverless safety

        let docRecord: DocumentRecord;

        if (fileToUpload.size > 3 * 1024 * 1024) {
          // Large PDF or file -> Chunked Upload
          const uploadId = `up-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const totalChunks = Math.ceil(fileToUpload.size / chunkSize);

          for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
            const start = chunkIdx * chunkSize;
            const end = Math.min(fileToUpload.size, start + chunkSize);
            const chunkBlob = fileToUpload.slice(start, end);
            const chunkFile = new File([chunkBlob], fileToUpload.name, { type: fileToUpload.type });

            const chunkForm = new FormData();
            chunkForm.append("chunk", chunkFile);
            chunkForm.append("uploadId", uploadId);
            chunkForm.append("chunkIndex", chunkIdx.toString());
            chunkForm.append("totalChunks", totalChunks.toString());
            chunkForm.append("fileName", fileToUpload.name);
            chunkForm.append("fileType", fileToUpload.type);
            chunkForm.append("category", "General");

            const chunkRes = await fetch("/api/documents/upload-chunk", { method: "POST", body: chunkForm });
            if (!chunkRes.ok) {
              const errData = await chunkRes.json().catch(() => ({}));
              throw new Error(errData.error || `Chunk ${chunkIdx + 1}/${totalChunks} failed.`);
            }

            if (chunkIdx === totalChunks - 1) {
              docRecord = await chunkRes.json();
              uploadedRecords.push(docRecord);
            } else {
              const percent = Math.round(((chunkIdx + 1) / totalChunks) * 100);
              setMessage(`Uploading ${i + 1}/${selectedFiles.length}: "${fileToUpload.name}" (${percent}%)...`);
            }
          }
        } else {
          // Small file -> Direct Upload
          const formData = new FormData();
          formData.append("file", fileToUpload);
          formData.append("category", "General");

          const response = await fetch("/api/documents", { method: "POST", body: formData });
          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Could not save document (Server status: ${response.status})`);
          }
          docRecord = await response.json();
          uploadedRecords.push(docRecord);
        }
      } catch (error) {
        console.error(`Failed to upload ${originalFile.name}:`, error);
        failedCount++;
      }
    }

    if (uploadedRecords.length > 0) {
      setDocuments((current) => [...uploadedRecords, ...current.filter((d) => !uploadedRecords.some((u) => u.id === d.id))]);
      setSelectedFiles([]);
      if (inputRef.current) inputRef.current.value = "";

      if (failedCount > 0) {
        setMessage(`✨ Uploaded ${uploadedRecords.length} document(s)! (${failedCount} failed)`);
      } else {
        setMessage(`✨ Successfully uploaded & analyzed all ${uploadedRecords.length} document(s)!`);
      }
    } else {
      setMessage("Could not save selected document(s). Please try again.");
    }

    setIsSaving(false);
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
          <span className="expiry-alert-icon">
            <IconClock size={20} />
          </span>
          <div>
            <strong>Reminders & Renewal Alerts</strong>
            <p>You have {urgentDocuments.length} document(s) requiring attention or with upcoming renewal dates.</p>
          </div>
          <button className="alert-dismiss-btn" type="button" onClick={dismissAlert} title="Dismiss warning banner">
            ✕ Dismiss
          </button>
        </section>
      )}

      <section className="vault-summary" aria-label="Document summary">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <IconShieldCheck size={28} style={{ color: "#10b981" }} />
          <div>
            <strong style={{ fontSize: 28, lineHeight: 1 }}>{documents.length}</strong>
            <span style={{ display: "block", color: "var(--muted)", fontSize: 13 }}>
              {documents.length === 1 ? "document saved in vault" : "documents saved in vault"}
            </span>
          </div>
        </div>
        <p>Your files are saved securely in your LifeOS project with automatic AI categorization, OCR analysis, and renewal tracking.</p>
      </section>

      <section className="upload-panel" aria-labelledby="upload-title">
        <div>
          <p className="eyebrow">ADD DOCUMENTS</p>
          <h2 id="upload-title">Save important files & batch PDFs</h2>
          <p>Select multiple PDFs, images, receipts, or documents up to 50MB each.</p>
        </div>
        <form className="upload-form" onSubmit={handleUpload}>
          <label className="file-picker" style={{ flex: 1 }}>
            <input ref={inputRef} type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={chooseFiles} />
            <IconUpload size={18} />
            <span style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
              {selectedFiles.length > 0
                ? `${selectedFiles.length} file(s) selected: ${selectedFiles.map((f) => f.name).join(", ")}`
                : "Choose or drag multiple document files"}
            </span>
            <b>Browse Files</b>
          </label>
          <button className="primary-button" type="submit" disabled={isSaving || selectedFiles.length === 0}>
            <IconSparkles size={16} />
            <span>{isSaving ? "Uploading..." : `Save ${selectedFiles.length > 1 ? `${selectedFiles.length} files` : "document"}`}</span>
          </button>
        </form>
        {message && <p className="upload-message" role="status">{message}</p>}
      </section>

      <section className="section" aria-labelledby="categories-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">CATEGORIES</p>
            <h2 id="categories-title">Organize from the start</h2>
          </div>
        </div>
        <div className="category-grid">
          {categories.map((item, index) => (
            <button
              className={`category-card ${activeCategory === item ? "category-card--active" : ""}`}
              key={item}
              type="button"
              onClick={() => setActiveCategory(activeCategory === item ? "All" : item)}
            >
              <span className="category-card__icon" aria-hidden="true">
                <IconDocument size={22} />
              </span>
              <h3>{item}</h3>
              <p>{categoryDescriptions[index]}</p>
              <span className="category-card__count">
                {documents.filter((document) => matchCategory(document.category, item)).length}{" "}
                {documents.filter((document) => matchCategory(document.category, item)).length === 1 ? "document" : "documents"}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="document-list section" aria-labelledby="documents-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR DOCUMENTS</p>
            <h2 id="documents-title">Vault Records</h2>
          </div>
          <span className="result-count">{visibleDocuments.length} shown</span>
        </div>
        <div className="vault-tools">
          <label className="search-box">
            <span aria-hidden="true">
              <IconSearch size={16} />
            </span>
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search documents..." type="search" />
          </label>
          <div className="filter-pills">
            {["All", ...categories].map((item) => (
              <button
                className={activeCategory === item ? "filter-pill filter-pill--active" : "filter-pill"}
                key={item}
                type="button"
                onClick={() => setActiveCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        {documents.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__icon" aria-hidden="true">
              <IconDocument size={36} />
            </span>
            <h2>Your vault is ready</h2>
            <p>Upload your first document above to start automatic organization.</p>
          </div>
        ) : visibleDocuments.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__icon" aria-hidden="true">
              <IconSearch size={36} />
            </span>
            <h2>No matching documents</h2>
            <p>Try a different search or choose another category.</p>
          </div>
        ) : (
          <div className="document-rows">
            {visibleDocuments.map((document) => {
              const status = getExpiryStatus(document);
              return (
                <div className="document-row" key={document.id}>
                  <Link className="document-row-content" href={`/documents/${document.id}`}>
                    <span className="document-type">{documentIcon(document.type)}</span>
                    <div>
                      <h3>{document.name}</h3>
                      <p>
                        {document.category} · {formatSize(document.size)} · Added {new Date(document.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                    {status && <span className={`status-badge status-badge--${status.type}`}>{status.label}</span>}
                    {document.analysis?.actionItems && document.analysis.actionItems.length > 0 && (
                      <span className="status-badge status-badge--action">Follow-up</span>
                    )}
                    <span className="document-open" aria-hidden="true">
                      Open →
                    </span>
                  </Link>
                  <button
                    className="delete-doc-button"
                    type="button"
                    onClick={() => handleDelete(document.id, document.name)}
                    title={`Delete ${document.name}`}
                    aria-label={`Delete ${document.name}`}
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
