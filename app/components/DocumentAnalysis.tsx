"use client";

import { useEffect, useState } from "react";

type Analysis = { documentType: string; summary: string; keyDates: Array<{ label: string; date: string; context: string }>; expiryDate: string; actionItems: string[]; confidence: string };

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
    setIsAnalyzing(true); setMessage(null);
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
      setAnalysis(result); setMessage({ text: "Analysis complete. Review it against the original document.", isError: false });
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : "Analysis failed.", isError: true }); }
    finally { setIsAnalyzing(false); }
  }

  return <section className="analysis-panel" aria-labelledby="analysis-title"><div className="analysis-heading"><div><p className="eyebrow">LIFEOS AI · GEMINI</p><h2 id="analysis-title">Understand this PDF</h2><p>Powered by Google Gemini. AI can make mistakes—always verify against the original document.</p></div><button className="primary-button" type="button" onClick={analyze} disabled={isAnalyzing}>{isAnalyzing ? "Analyzing…" : "Analyze with AI"}</button></div>{message && <p className={`upload-message ${message.isError ? "upload-message--error" : ""}`} role="status">{message.text}</p>}{analysis && <div className="insights"><div><span>TYPE</span><strong>{analysis.documentType}</strong></div><div><span>EXPIRY / RENEWAL</span><strong>{analysis.expiryDate || "Not found"}</strong></div><div><span>CONFIDENCE</span><strong>{analysis.confidence}</strong></div><article><h3>Summary</h3><p>{analysis.summary}</p></article>{analysis.keyDates.length > 0 && <article><h3>Key dates</h3><ul>{analysis.keyDates.map((date) => <li key={`${date.label}-${date.date}`}><b>{date.label}: {date.date}</b> — {date.context}</li>)}</ul></article>}{analysis.actionItems.length > 0 && <article><h3>Suggested follow-ups</h3><ul>{analysis.actionItems.map((item) => <li key={item}>{item}</li>)}</ul></article>}</div>}</section>;
}
