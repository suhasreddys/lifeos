import { mkdir, writeFile, readFile, rm } from "fs/promises";
import path from "path";
import os from "os";
import { getStorageDir, readJsonStorage, writeJsonStorage } from "@/lib/storage";
import { getSessionUserFromRequest } from "@/lib/auth";
import type { DocumentRecord } from "../route";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require("pdf-parse/lib/pdf-parse.js");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getRecords(userId?: string): Promise<DocumentRecord[]> {
  return readJsonStorage<DocumentRecord[]>("documents", "documents.json", [], userId);
}

async function autoCategorizeAndSync(docId: string, fileName: string, fileBuffer: Buffer, fileType: string, initialCategory: string, userId?: string) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return;
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

    let contents: any[] = [];
    const promptText = `You are an expert AI document organizer for LifeOS.
Analyze the document text or image below and return JSON:
{
  "detectedCategory": "Agreements|Certificates|IDs & records|Bills|Insurance|General",
  "isLeaseAgreement": boolean,
  "propertyName": "string",
  "unit": "string",
  "address": "string",
  "tenantName": "string",
  "tenantPhone": "string",
  "tenantEmail": "string",
  "monthlyRent": number,
  "securityDeposit": number,
  "leaseStart": "YYYY-MM-DD",
  "leaseEnd": "YYYY-MM-DD"
}`;

    if (fileType.includes("pdf")) {
      const pdfData = await pdf(fileBuffer);
      contents = [{ role: "user", parts: [{ text: `${promptText}\n\nDocument Text:\n${pdfData.text.slice(0, 8000)}` }] }];
    } else if (fileType.includes("image")) {
      contents = [
        {
          role: "user",
          parts: [
            { text: promptText },
            { inlineData: { mimeType: fileType, data: fileBuffer.toString("base64") } }
          ]
        }
      ];
    } else {
      return;
    }

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents, generationConfig: { responseMimeType: "application/json" } })
    });

    if (!res.ok) return;
    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return;

    const parsed = JSON.parse(rawText);

    if (parsed.detectedCategory) {
      const docs = await getRecords(userId);
      const targetDoc = docs.find((d) => d.id === docId);
      if (targetDoc && (initialCategory === "General" || !initialCategory)) {
        targetDoc.category = parsed.detectedCategory;
        await writeJsonStorage("documents", "documents.json", docs, userId);
      }
    }
  } catch {
    // Fail silently on background auto-categorization
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUserFromRequest(request);
    const userId = user?.id;

    const formData = await request.formData();
    const chunk = formData.get("chunk");
    const uploadId = formData.get("uploadId") as string;
    const chunkIndex = parseInt((formData.get("chunkIndex") as string) || "0", 10);
    const totalChunks = parseInt((formData.get("totalChunks") as string) || "1", 10);
    const fileName = formData.get("fileName") as string;
    const fileType = formData.get("fileType") as string;
    const category = (formData.get("category") as string) || "General";

    if (!(chunk instanceof File) || !uploadId || !fileName) {
      return Response.json({ error: "Invalid chunk upload payload." }, { status: 400 });
    }

    const chunkDir = path.join(os.tmpdir(), "lifeos-chunks", uploadId);
    await mkdir(chunkDir, { recursive: true });

    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    await writeFile(path.join(chunkDir, `chunk_${chunkIndex}`), chunkBuffer);

    // If final chunk, merge all chunks and save document
    if (chunkIndex === totalChunks - 1) {
      const docsDir = getStorageDir("documents", userId);
      await mkdir(docsDir, { recursive: true });

      const chunkBuffers: Buffer[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const cBuf = await readFile(path.join(chunkDir, `chunk_${i}`));
        chunkBuffers.push(cBuf);
      }
      const completeFileBuffer = Buffer.concat(chunkBuffers);

      // Clean up temporary chunks
      rm(chunkDir, { recursive: true, force: true }).catch(() => {});

      const extension = fileName.split(".").pop()?.toLowerCase() ?? "bin";
      const id = crypto.randomUUID();
      const storedName = `${id}.${extension}`;

      const record: DocumentRecord = {
        id,
        name: path.basename(fileName),
        storedName,
        size: completeFileBuffer.length,
        type: fileType || (extension === "pdf" ? "application/pdf" : "application/octet-stream"),
        category: category || "General",
        uploadedAt: new Date().toISOString(),
      };

      const records = await getRecords(userId);
      await writeFile(path.join(/*turbopackIgnore: true*/ docsDir, storedName), completeFileBuffer);
      await writeJsonStorage("documents", "documents.json", [record, ...records], userId);

      // Asynchronously trigger AI categorization
      autoCategorizeAndSync(id, fileName, completeFileBuffer, record.type, category, userId).catch(() => {});

      return Response.json(record, { status: 201 });
    }

    return Response.json({ success: true, chunkIndex, totalChunks });
  } catch (err) {
    console.error("Chunk upload error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to process chunk upload." },
      { status: 500 }
    );
  }
}
