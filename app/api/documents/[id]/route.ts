import { readFile } from "fs/promises";
import path from "path";
import { getStorageDir, readJsonStorage } from "@/lib/storage";

type DocumentRecord = { id: string; name: string; storedName: string; type: string };

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  try {
    const records = await readJsonStorage<DocumentRecord[]>("documents", "documents.json", []);
    const document = records.find((record) => record.id === id);
    if (!document) return new Response("Not found", { status: 404 });
    const docsDir = getStorageDir("documents");
    const file = await readFile(path.join(docsDir, document.storedName));
    return new Response(file, { headers: { "Content-Type": document.type || "application/octet-stream", "Content-Disposition": `inline; filename="${document.name.replaceAll('"', "")}"` } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
