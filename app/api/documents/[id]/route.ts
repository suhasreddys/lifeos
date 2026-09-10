import { readFile } from "fs/promises";
import path from "path";

type DocumentRecord = { id: string; name: string; storedName: string; type: string };
const dataDirectory = path.join(process.cwd(), "data", "documents");
const recordsPath = path.join(dataDirectory, "documents.json");

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  try {
    const records = JSON.parse(await readFile(recordsPath, "utf8")) as DocumentRecord[];
    const document = records.find((record) => record.id === id);
    if (!document) return new Response("Not found", { status: 404 });
    const file = await readFile(path.join(dataDirectory, document.storedName));
    return new Response(file, { headers: { "Content-Type": document.type || "application/octet-stream", "Content-Disposition": `inline; filename="${document.name.replaceAll('"', "")}"` } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
