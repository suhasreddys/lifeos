import Link from "next/link";
import DocumentAnalysis from "../../components/DocumentAnalysis";

export default async function DocumentViewer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="app-shell">
      <header className="topbar"><Link className="brand" href="/" aria-label="Back to LifeOS home"><span className="brand-mark">L</span>LifeOS</Link><Link className="back-link" href="/documents">← Document Vault</Link></header>
      <section className="viewer-header"><div><p className="eyebrow">DOCUMENT VIEWER</p><h1>Preview your document</h1><p className="hero__description">If your browser cannot preview this file type, use the download button to open it in the appropriate app.</p></div><a className="download-button" href={`/api/documents/${id}`} download>Download</a></section>
      <iframe className="document-viewer" src={`/api/documents/${id}`} title="Document preview" />
      <DocumentAnalysis documentId={id} />
    </main>
  );
}
