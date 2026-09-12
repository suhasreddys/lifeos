import Link from "next/link";
import DocumentAnalysis from "../../components/DocumentAnalysis";
import { readJsonStorage } from "@/lib/storage";

type DocumentRecord = { id: string; name: string; storedName: string; type: string; category: string; size: number };

export default async function DocumentViewer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const docs = await readJsonStorage<DocumentRecord[]>("documents", "documents.json", []);
  const doc = docs.find((d) => d.id === id);
  const docName = doc?.name || "Preview your document";

  return (
    <main className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Back to LifeOS home"><span className="brand-mark">L</span>LifeOS</Link>
        <Link className="back-link" href="/documents">← Document Vault</Link>
      </header>
      <section className="viewer-header">
        <div>
          <p className="eyebrow">DOCUMENT VIEWER</p>
          <h1>{docName}</h1>
          <p className="hero__description">
            {doc ? `${doc.category} · ${(doc.size / 1024).toFixed(0)} KB` : "If your browser cannot preview this file type, use the download button."}
          </p>
        </div>
        <div className="viewer-actions">
          <a className="download-button" href={`/api/documents/${id}`} download>
            ⬇ Download File
          </a>
        </div>
      </section>
      <div className="document-viewer-container">
        <iframe className="document-viewer" src={`/api/documents/${id}`} title={docName} />
      </div>
      <DocumentAnalysis documentId={id} />
    </main>
  );
}
