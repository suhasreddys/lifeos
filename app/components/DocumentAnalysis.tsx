"use client";

import { useEffect, useState } from "react";
import { IconSparkles, IconTrash, IconClock, IconDocument, IconCheckSquare } from "./Icons";

type Analysis = {
  documentType: string;
  summary: string;
  keyDates: Array<{ label: string; date: string; context: string }>;
  expiryDate: string;
  actionItems: string[];
  confidence: string;
};

export default function DocumentAnalysis({ documentId }: { documentId: string }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    fetch(`/api/documents/${documentId}/analyze`)
      .then(async (res) => (res.ok ? (res.json() as Promise<Analysis | null>) : null))
      .then((cached) => {
        if (cached) setAnalysis(cached);
      })
      .catch(() => {});
  }, [documentId]);

  async function analyze() {
    setIsAnalyzing(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/documents/${documentId}/analyze`, { method: "POST" });
      const responseText = await response.text();
      let result: Analysis & { error?: string };
      try {
        result = JSON.parse(responseText) as Analysis & { error?: string };
      } catch {
        throw new Error("LifeOS did not receive a valid response from the server.");
      }
      if (!response.ok) throw new Error(result.error ?? "Analysis failed.");
      setAnalysis(result);
      setMessage({ text: "AI Analysis complete! Extracted insights and action items saved to your vault.", isError: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Analysis failed.", isError: true });
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function deleteDocument() {
    if (!window.confirm("Are you sure you want to remove this document from your vault?")) return;
    try {
      const response = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete document.");
      window.location.href = "/documents";
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Failed to delete document.", isError: true });
    }
  }

  return (
    <section className="analysis-panel" aria-labelledby="analysis-title">
      <div className="analysis-heading">
        <div>
          <p className="eyebrow">LIFEOS AI VISION · GEMINI</p>
          <h2 id="analysis-title">Study & Analyze Document</h2>
          <p>Powered by Google Gemini Vision multimodal reader. Reads text, images, and scanned PDFs.</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button className="primary-button" type="button" onClick={analyze} disabled={isAnalyzing} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <IconSparkles size={16} />
            <span>{isAnalyzing ? "Analyzing with Vision..." : "Analyze with AI"}</span>
          </button>
          <button
            className="delete-doc-button"
            type="button"
            onClick={deleteDocument}
            title="Delete Document"
            style={{ width: "auto", padding: "8px 16px", fontWeight: "750", gap: "6px" }}
          >
            <IconTrash size={14} />
            <span>Delete</span>
          </button>
        </div>
      </div>
      {message && <p className={`upload-message ${message.isError ? "upload-message--error" : ""}`} role="status">{message.text}</p>}
      {analysis && (
        <div className="insights">
          <div>
            <span>TYPE</span>
            <strong>{analysis.documentType}</strong>
          </div>
          <div>
            <span>EXPIRY / RENEWAL</span>
            <strong>{analysis.expiryDate || "Not found"}</strong>
          </div>
          <div>
            <span>CONFIDENCE</span>
            <strong>{analysis.confidence}</strong>
          </div>
          <article>
            <h3>Summary</h3>
            <p>{analysis.summary}</p>
          </article>
          {analysis.keyDates.length > 0 && (
            <article>
              <h3>Key dates</h3>
              <ul>
                {analysis.keyDates.map((date) => (
                  <li key={`${date.label}-${date.date}`}>
                    <b>
                      {date.label}: {date.date}
                    </b>{" "}
                    — {date.context}
                  </li>
                ))}
              </ul>
            </article>
          )}
          {analysis.actionItems.length > 0 && (
            <article>
              <h3>Suggested follow-ups</h3>
              <ul>
                {analysis.actionItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          )}
        </div>
      )}
    </section>
  );
}
