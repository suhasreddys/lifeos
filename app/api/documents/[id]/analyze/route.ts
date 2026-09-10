import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { callGeminiApi } from "../../../../../lib/gemini";
import type { DocumentRecord, AnalysisRecord } from "../../route";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require("pdf-parse/lib/pdf-parse.js");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dataDirectory = path.join(process.cwd(), "data", "documents");
const recordsPath = path.join(dataDirectory, "documents.json");

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Document not found." }, { status: 404 });
  try {
    const records = JSON.parse(await readFile(recordsPath, "utf8")) as DocumentRecord[];
    const document = records.find((record) => record.id === id);
    if (!document) return Response.json({ error: "Document not found." }, { status: 404 });
    return Response.json(document.analysis ?? null);
  } catch {
    return Response.json({ error: "Could not load document analysis." }, { status: 500 });
  }
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Document not found." }, { status: 404 });

  try {
    const records = JSON.parse(await readFile(recordsPath, "utf8")) as DocumentRecord[];
    const docIndex = records.findIndex((record) => record.id === id);
    if (docIndex === -1) return Response.json({ error: "Document not found." }, { status: 404 });
    const document = records[docIndex];
    if (document.type !== "application/pdf") return Response.json({ error: "AI analysis currently supports PDFs. You can still preview or download this file." }, { status: 400 });

    const parsed = await pdf(await readFile(path.join(dataDirectory, document.storedName)));
    if (!parsed.text.trim()) return Response.json({ error: "This PDF has no readable text. Scanned-image support is the next AI improvement." }, { status: 400 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "GEMINI_API_KEY is missing. Please add GEMINI_API_KEY to your .env.local file." }, { status: 500 });
    }

    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
    const prompt = `You are a careful personal document organizer. Analyze the document text below.
Return only valid JSON with this exact shape:
{
  "documentType": "string",
  "summary": "string",
  "keyDates": [{"label": "string", "date": "string", "context": "string"}],
  "expiryDate": "string",
  "actionItems": ["string"],
  "confidence": "high|medium|low",
  "detectedCategory": "Agreements|Bills|Insurance|ID & Passports|Medical|Financial|General",
  "leaseDetails": {
    "isLeaseAgreement": boolean,
    "propertyName": "string",
    "unit": "string",
    "tenantName": "string",
    "monthlyRent": number,
    "securityDeposit": number,
    "leaseStart": "YYYY-MM-DD",
    "leaseEnd": "YYYY-MM-DD"
  }
}
Use an empty string when an expiry date or text field is absent. Categorize the document accurately. If the document is a lease or rental agreement, set isLeaseAgreement to true and detectedCategory to Agreements.

DOCUMENT TEXT:
${parsed.text.slice(0, 24000)}`;

    const geminiRes = await callGeminiApi({
      prompt,
      apiKey,
      model,
      responseMimeType: "application/json",
      temperature: 0.1
    });

    if (geminiRes.error || !geminiRes.text) {
      return Response.json({ error: geminiRes.error || "Failed to reach Gemini API." }, { status: geminiRes.isRateLimit ? 429 : 500 });
    }

    const textResult = geminiRes.text;

    let parsedPayload: Omit<AnalysisRecord, "analyzedAt"> & { leaseDetails?: any; detectedCategory?: string };
    try {
      parsedPayload = JSON.parse(textResult);
    } catch {
      return Response.json({ error: "Gemini returned invalid JSON. Please try again." }, { status: 502 });
    }

    const analysisRecord: AnalysisRecord & { leaseDetails?: any } = {
      ...parsedPayload,
      analyzedAt: new Date().toISOString()
    };

    // Auto-update document category if detectedCategory is specific or isLeaseAgreement
    let updatedCategory = document.category;
    if (parsedPayload.leaseDetails?.isLeaseAgreement) {
      updatedCategory = "Agreements";
    } else if (document.category === "General" && parsedPayload.detectedCategory) {
      updatedCategory = parsedPayload.detectedCategory;
    }

    // Save persistent analysis record to documents.json
    records[docIndex] = {
      ...document,
      category: updatedCategory,
      analysis: analysisRecord
    };
    await writeFile(recordsPath, JSON.stringify(records, null, 2), "utf8");

    // Auto-sync extracted dates to Calendar, Tasks, & Rental Manager
    await autoSyncRemindersAndTasks(document.id, document.name, document.category, analysisRecord);

    return Response.json(analysisRecord);
  } catch (error) {
    return Response.json({ error: "LifeOS could not analyze this PDF. " + (error instanceof Error ? error.message : "An error occurred.") }, { status: 500 });
  }
}

function parseToISODate(dateStr: string): string | null {
  if (!dateStr || dateStr.toLowerCase().includes("not found")) return null;
  // Match YYYY-MM-DD
  const isoMatch = dateStr.match(/\b(20\d{2})[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // Match YYYY (e.g. 2023-2025 -> pick end year 2025-06-01)
  const rangeMatch = dateStr.match(/\b(20\d{2})\s*[-–—]\s*(20\d{2})\b/);
  if (rangeMatch) return `${rangeMatch[2]}-06-01`;

  const singleYear = dateStr.match(/\b(20\d{2})\b/);
  if (singleYear) return `${singleYear[1]}-06-01`;

  const timestamp = Date.parse(dateStr);
  if (!isNaN(timestamp)) return new Date(timestamp).toISOString().split("T")[0];

  return null;
}

async function autoSyncRemindersAndTasks(docId: string, docName: string, category: string, analysis: AnalysisRecord) {
  try {
    // 1. Sync Calendar Events
    const calendarDir = path.join(process.cwd(), "data", "calendar");
    const calendarPath = path.join(calendarDir, "events.json");
    await mkdir(calendarDir, { recursive: true });

    let calEvents: Array<{ id: string; title: string; date: string; category: string; description?: string; createdAt: string }> = [];
    try { calEvents = JSON.parse(await readFile(calendarPath, "utf8")); } catch {}

    const newCalEvents = [...calEvents];

    if (analysis.expiryDate) {
      const parsedDate = parseToISODate(analysis.expiryDate);
      if (parsedDate) {
        const eventId = `auto-exp-${docId}`;
        if (!newCalEvents.some((e) => e.id === eventId)) {
          newCalEvents.push({
            id: eventId,
            title: `Expiration: ${docName}`,
            date: parsedDate,
            category: "Document Expiry",
            description: `Document (${category}) expires on ${analysis.expiryDate}`,
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    analysis.keyDates?.forEach((kd, idx) => {
      const parsedDate = parseToISODate(kd.date);
      if (parsedDate) {
        const eventId = `auto-kd-${docId}-${idx}`;
        if (!newCalEvents.some((e) => e.id === eventId)) {
          newCalEvents.push({
            id: eventId,
            title: `${kd.label} (${docName})`,
            date: parsedDate,
            category: "Key Date",
            description: kd.context,
            createdAt: new Date().toISOString()
          });
        }
      }
    });

    await writeFile(calendarPath, JSON.stringify(newCalEvents, null, 2), "utf8");

    // 2. Sync Tasks
    const tasksDir = path.join(process.cwd(), "data", "tasks");
    const tasksPath = path.join(tasksDir, "tasks.json");
    await mkdir(tasksDir, { recursive: true });

    let userTasks: Array<{ id: string; title: string; category: string; priority: string; completed: boolean; source: string; documentId?: string; documentName?: string; createdAt: string }> = [];
    try { userTasks = JSON.parse(await readFile(tasksPath, "utf8")); } catch {}

    const newTasks = [...userTasks];
    analysis.actionItems?.forEach((action, idx) => {
      const taskId = `auto-task-${docId}-${idx}`;
      if (!newTasks.some((t) => t.id === taskId)) {
        newTasks.push({
          id: taskId,
          title: action,
          category,
          priority: "High",
          completed: false,
          source: "document",
          documentId: docId,
          documentName: docName,
          createdAt: new Date().toISOString()
        });
      }
    });

    await writeFile(tasksPath, JSON.stringify(newTasks, null, 2), "utf8");

    // 3. Sync Rental Agreements to Tenant & Landlord Manager
    const lease = (analysis as any).leaseDetails;
    const isRentalDoc = category === "Rental Agreement" || category === "Agreements" || docName.toLowerCase().includes("lease") || docName.toLowerCase().includes("rent") || lease?.isLeaseAgreement;

    if (isRentalDoc) {
      const rentalDir = path.join(process.cwd(), "data", "rental");
      const rentalPath = path.join(rentalDir, "rentals.json");
      await mkdir(rentalDir, { recursive: true });

      let rentalData: { properties: any[]; payments: any[]; deposits: any[]; maintenance: any[]; meterReadings: any[]; notices: any[]; inspections: any[] } = {
        properties: [], payments: [], deposits: [], maintenance: [], meterReadings: [], notices: [], inspections: []
      };
      try { rentalData = JSON.parse(await readFile(rentalPath, "utf8")); } catch {}

      const propId = `doc-lease-${docId}`;
      if (!rentalData.properties.some(p => p.id === propId)) {
        const newProperty = {
          id: propId,
          name: lease?.propertyName?.trim() || docName.replace(/\.[^/.]+$/, ""),
          unit: lease?.unit?.trim() || "Main Unit",
          address: "Stored Agreement Reference",
          tenantName: lease?.tenantName?.trim() || "Tenant",
          monthlyRent: Number(lease?.monthlyRent || 0),
          securityDeposit: Number(lease?.securityDeposit || lease?.monthlyRent || 0),
          leaseStart: lease?.leaseStart || new Date().toISOString().split("T")[0],
          leaseEnd: lease?.leaseEnd || analysis.expiryDate || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split("T")[0],
          status: "Occupied",
          createdAt: new Date().toISOString()
        };
        rentalData.properties.unshift(newProperty);

        // Also record security deposit if applicable
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
            notes: "Extracted from agreement document",
            createdAt: new Date().toISOString()
          });
        }

        await writeFile(rentalPath, JSON.stringify(rentalData, null, 2), "utf8");
      }
    }
  } catch {
    // Fail silently on auto-sync if files locked
  }
}
