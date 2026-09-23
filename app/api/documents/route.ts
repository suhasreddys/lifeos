import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getStorageDir, readJsonStorage, writeJsonStorage } from "@/lib/storage";
import { getSessionUserFromRequest } from "@/lib/auth";

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
const maximumFileSize = 50 * 1024 * 1024; // 50 MB max limit

async function getRecords(userId?: string): Promise<DocumentRecord[]> {
  return readJsonStorage<DocumentRecord[]>("documents", "documents.json", [], userId);
}

export async function GET(request: Request) {
  const user = await getSessionUserFromRequest(request);
  return Response.json(await getRecords(user?.id));
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

    // Update document record if category detected
    if (parsed.detectedCategory) {
      const docs = await getRecords(userId);
      const targetDoc = docs.find((d) => d.id === docId);
      if (targetDoc && (initialCategory === "General" || !initialCategory)) {
        targetDoc.category = parsed.detectedCategory;
        await writeJsonStorage("documents", "documents.json", docs, userId);
      }
    }

    // Auto-create Rental Property if it's a lease agreement
    if (parsed.isLeaseAgreement && parsed.propertyName) {
      const rentalData = await readJsonStorage<any>("rental", "rentals.json", { properties: [], deposits: [], tickets: [] }, userId);
      const exists = rentalData.properties?.some((p: any) => p.name?.toLowerCase() === parsed.propertyName?.toLowerCase());

      if (!exists && rentalData.properties) {
        const propId = `prop-${Date.now()}`;
        const newProperty = {
          id: propId,
          name: parsed.propertyName,
          unit: parsed.unit || "Unit 1",
          address: parsed.address || "Address from lease",
          tenantName: parsed.tenantName || "Tenant",
          tenantPhone: parsed.tenantPhone || "",
          tenantEmail: parsed.tenantEmail || "",
          monthlyRent: parsed.monthlyRent || 0,
          securityDeposit: parsed.securityDeposit || 0,
          leaseStart: parsed.leaseStart || new Date().toISOString().split("T")[0],
          leaseEnd: parsed.leaseEnd || "",
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

        await writeJsonStorage("rental", "rentals.json", rentalData, userId);
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

    const docsDir = getStorageDir("documents", userId);
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

    const lowerName = file.name.toLowerCase();
    let initialCategory = category;
    if (initialCategory === "General" || !initialCategory) {
      if (/sgpa|report|grade|mark|degree|result|college|school|resume|cv|certificate|transcript/.test(lowerName)) {
        initialCategory = "Certificates";
      } else if (/lease|rent|agreement|contract/.test(lowerName)) {
        initialCategory = "Agreements";
      } else if (/passport|aadhaar|license|id|identity|voter/.test(lowerName)) {
        initialCategory = "IDs & records";
      } else if (/bill|receipt|invoice|statement|tax/.test(lowerName)) {
        initialCategory = "Bills";
      } else if (/insurance|policy|claim|health|medical/.test(lowerName)) {
        initialCategory = "Insurance";
      }
    }

    const id = crypto.randomUUID();
    const storedName = `${id}.${extension}`;
    const record: DocumentRecord = {
      id,
      name: path.basename(file.name),
      storedName,
      size: file.size,
      type: file.type || (extension === "pdf" ? "application/pdf" : "application/octet-stream"),
      category: initialCategory,
      uploadedAt: new Date().toISOString()
    };
    const records = await getRecords(userId);
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    await writeFile(path.join(/*turbopackIgnore: true*/ docsDir, storedName), fileBuffer);
    await writeJsonStorage("documents", "documents.json", [record, ...records], userId);

    // Fire background Gemini Auto-Categorization without delaying the POST response
    autoCategorizeAndSync(id, file.name, fileBuffer, record.type, category, userId).catch((err) => {
      console.error("Background auto-categorize error:", err);
    });

    return Response.json(record, { status: 201 });
  } catch (err) {
    console.error("Document upload error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to process document upload." },
      { status: 500 }
    );
  }
}
