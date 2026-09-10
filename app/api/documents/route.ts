import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getStorageDir, readJsonStorage, writeJsonStorage } from "@/lib/storage";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require("pdf-parse/lib/pdf-parse.js");

export type AnalysisRecord = {
  documentType: string;
  summary: string;
  keyDates: Array<{ label: string; date: string; context: string }>;
  expiryDate: string;
  actionItems: string[];
  confidence: string;
  analyzedAt: string;
  detectedCategory?: string;
};

export type DocumentRecord = {
  id: string;
  name: string;
  storedName: string;
  size: number;
  type: string;
  category: string;
  uploadedAt: string;
  analysis?: AnalysisRecord;
};

const allowedExtensions = new Set(["pdf", "doc", "docx", "png", "jpg", "jpeg", "webp"]);
const maximumFileSize = 10 * 1024 * 1024;

async function getRecords(): Promise<DocumentRecord[]> {
  return readJsonStorage<DocumentRecord[]>("documents", "documents.json", []);
}

export async function GET() { return Response.json(await getRecords()); }

async function autoCategorizeAndSync(docId: string, fileName: string, fileBuffer: Buffer, fileType: string, initialCategory: string) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return;
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

    let contents: any[] = [];
    const promptText = `You are an expert AI document organizer for LifeOS.
Analyze the document text or image below and return JSON:
{
  "detectedCategory": "Agreements|Bills|Insurance|Identity|Financial|Medical|General",
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
}
Be precise. If it is a lease, tenancy, rental agreement, or rent receipt, set isLeaseAgreement to true.`;

    if (fileType.startsWith("image/")) {
      contents = [{
        parts: [
          { inlineData: { mimeType: fileType || "image/jpeg", data: fileBuffer.toString("base64") } },
          { text: promptText }
        ]
      }];
    } else {
      let docText = "";
      if (fileType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
        try {
          const parsed = await pdf(fileBuffer);
          docText = parsed?.text || "";
        } catch {
          docText = "";
        }
      } else {
        docText = fileBuffer.toString("utf8");
      }
      if (!docText.trim()) return;

      contents = [{
        parts: [{ text: `${promptText}\n\nDOCUMENT TEXT:\n${docText.slice(0, 24000)}` }]
      }];
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
        })
      }
    );

    if (!response.ok) return;
    const payload = await response.json();
    const textResult = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResult) return;
    const parsedResult = JSON.parse(textResult);
    const records = await getRecords();
    const docIndex = records.findIndex(r => r.id === docId);

    if (docIndex !== -1 && parsedResult.detectedCategory) {
      if (initialCategory === "General" || parsedResult.isLeaseAgreement) {
        const newCategory = parsedResult.isLeaseAgreement ? "Agreements" : parsedResult.detectedCategory;
        records[docIndex].category = newCategory;
        await writeJsonStorage("documents", "documents.json", records);
      }
    }

    if (parsedResult.isLeaseAgreement || initialCategory === "Agreements" || fileName.toLowerCase().includes("lease") || fileName.toLowerCase().includes("rent")) {
      let rentalData: { properties: any[]; payments: any[]; deposits: any[]; maintenance: any[]; meterReadings: any[]; notices: any[]; inspections: any[] } = await readJsonStorage("rental", "rentals.json", {
        properties: [], payments: [], deposits: [], maintenance: [], meterReadings: [], notices: [], inspections: []
      });

      const propId = `doc-vault-${docId}`;
      if (!rentalData.properties.some(p => p.id === propId)) {
        const newProperty = {
          id: propId,
          name: parsedResult.propertyName?.trim() || fileName.replace(/\.[^/.]+$/, ""),
          unit: parsedResult.unit?.trim() || "Main Unit",
          address: parsedResult.address?.trim() || "Agreed Premises",
          tenantName: parsedResult.tenantName?.trim() || "Tenant",
          tenantPhone: parsedResult.tenantPhone?.trim() || undefined,
          tenantEmail: parsedResult.tenantEmail?.trim() || undefined,
          monthlyRent: Number(parsedResult.monthlyRent || 0),
          securityDeposit: Number(parsedResult.securityDeposit || parsedResult.monthlyRent || 0),
          leaseStart: parsedResult.leaseStart || new Date().toISOString().split("T")[0],
          leaseEnd: parsedResult.leaseEnd || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split("T")[0],
          status: "Occupied",
          createdAt: new Date().toISOString()
        };

        rentalData.properties.unshift(newProperty);

        if (newProperty.securityDeposit > 0) {
          rentalData.deposits.unshift({
            id: `dep-${propId}`,
            propertyId: propId,
            propertyName: `${newProperty.name} (${newProperty.unit})`,
            tenantName: newProperty.tenantName,
            type: "Security Deposit",
            amount: newProperty.securityDeposit,
            paidDate: newProperty.leaseStart,
            status: "Held",
            notes: `Auto-Categorized via Document Vault (${fileName})`,
            createdAt: new Date().toISOString()
          });
        }

        await writeJsonStorage("rental", "rentals.json", rentalData);
      }
    }
  } catch {
    // Fail silently on background auto-categorization
  }
}

export async function POST(request: Request) {
  try {
    const docsDir = getStorageDir("documents");
    await mkdir(docsDir, { recursive: true });

    const formData = await request.formData();
    const file = formData.get("file");
    const category = formData.get("category");
    if (!(file instanceof File) || typeof category !== "string") {
      return Response.json({ error: "Choose a file and category." }, { status: 400 });
    }
    if (file.size === 0 || file.size > maximumFileSize) {
      return Response.json({ error: "Files must be between 1 byte and 10 MB." }, { status: 400 });
    }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!allowedExtensions.has(extension)) {
      return Response.json({ error: "Use a PDF, Word document, PNG, JPG, or WEBP file." }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const storedName = `${id}.${extension}`;
    const record: DocumentRecord = {
      id,
      name: path.basename(file.name),
      storedName,
      size: file.size,
      type: file.type || (extension === "pdf" ? "application/pdf" : "application/octet-stream"),
      category,
      uploadedAt: new Date().toISOString()
    };
    const records = await getRecords();
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    await writeFile(path.join(docsDir, storedName), fileBuffer);
    await writeJsonStorage("documents", "documents.json", [record, ...records]);

    // Trigger Gemini Auto-Categorization & Syncing in background safely
    autoCategorizeAndSync(id, file.name, fileBuffer, record.type, category).catch(() => {});

    return Response.json(record, { status: 201 });
  } catch (err) {
    console.error("Document upload error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to process document upload." },
      { status: 500 }
    );
  }
}
