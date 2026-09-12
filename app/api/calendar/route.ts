import { readJsonStorage, writeJsonStorage } from "@/lib/storage";
import type { DocumentRecord } from "../documents/route";

export type CustomEvent = {
  id: string;
  title: string;
  date: string;
  category: "Personal" | "Reminder" | "Work" | "Important" | "Holidays";
  description?: string;
  createdAt: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  category: string;
  source: "document" | "user";
  documentId?: string;
  documentName?: string;
  detail?: string;
};

const GOOGLE_HOLIDAY_FEED_URL = "https://calendar.google.com/calendar/ical/en.indian%23holiday%40group.v.calendar.google.com/public/basic.ics";

function parseICalDate(dtStr: string): string | null {
  if (!dtStr) return null;
  const val = dtStr.includes(":") ? dtStr.split(":").pop()! : dtStr;
  const match = val.trim().match(/^(\d{4})(\d{2})(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return null;
}

function parseICS(icsText: string): Array<{ title: string; date: string; description?: string }> {
  const events: Array<{ title: string; date: string; description?: string }> = [];
  const veventBlocks = icsText.split("BEGIN:VEVENT");

  for (let i = 1; i < veventBlocks.length; i++) {
    const block = veventBlocks[i].split("END:VEVENT")[0];
    let summary = "";
    let dtstart = "";
    let description = "";

    const lines = block.split(/\r?\n/);
    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      if (line.startsWith("SUMMARY:")) {
        summary = line.substring("SUMMARY:".length).trim();
      } else if (line.startsWith("DTSTART")) {
        dtstart = line.trim();
      } else if (line.startsWith("DESCRIPTION:")) {
        description = line.substring("DESCRIPTION:".length).trim();
      }
    }

    const dateStr = parseICalDate(dtstart);
    if (summary && dateStr) {
      events.push({ title: summary, date: dateStr, description });
    }
  }

  return events;
}

async function ensureGoogleHolidaysLoaded(existingCustom: CustomEvent[]): Promise<CustomEvent[]> {
  const hasHolidays = existingCustom.some((e) => e.category === "Holidays");
  if (hasHolidays) return existingCustom;

  try {
    const res = await fetch(GOOGLE_HOLIDAY_FEED_URL, { cache: "no-store" });
    if (!res.ok) return existingCustom;

    const icsText = await res.text();
    const parsedHolidays = parseICS(icsText);

    const holidayEvents: CustomEvent[] = parsedHolidays.map((h, idx) => ({
      id: `google-holiday-${h.date}-${idx}`,
      title: `🇮🇳 ${h.title}`,
      date: h.date,
      category: "Holidays",
      description: h.description || "Public Holiday (Google Calendar Feed)",
      createdAt: new Date().toISOString()
    }));

    const updated = [...holidayEvents, ...existingCustom];
    await writeJsonStorage("calendar", "events.json", updated);
    return updated;
  } catch {
    return existingCustom;
  }
}

async function getCustomEvents(): Promise<CustomEvent[]> {
  const custom = await readJsonStorage<CustomEvent[]>("calendar", "events.json", []);
  return await ensureGoogleHolidaysLoaded(custom);
}

async function getDocumentEvents(): Promise<CalendarEvent[]> {
  try {
    const docs = await readJsonStorage<DocumentRecord[]>("documents", "documents.json", []);
    const events: CalendarEvent[] = [];

    docs.forEach((doc) => {
      if (!doc.analysis) return;
      if (doc.analysis.expiryDate) {
        events.push({
          id: `doc-exp-${doc.id}`,
          title: `Expiration: ${doc.name}`,
          date: doc.analysis.expiryDate,
          category: "Document Expiry",
          source: "document",
          documentId: doc.id,
          documentName: doc.name,
          detail: `Document category: ${doc.category}`
        });
      }

      const isEducationOrCert = doc.category === "Certificates" || 
                                doc.category === "Other" ||
                                doc.name.toLowerCase().includes("resume") || 
                                doc.name.toLowerCase().includes("marksheet") ||
                                doc.name.toLowerCase().includes("std");

      if (!isEducationOrCert) {
        doc.analysis.keyDates?.forEach((kd, index) => {
          const isYearRange = /\b20\d{2}\s*[-–—]\s*20\d{2}\b/.test(kd.date);
          if (!isYearRange) {
            events.push({
              id: `doc-kd-${doc.id}-${index}`,
              title: `${kd.label} (${doc.name})`,
              date: kd.date,
              category: "Key Date",
              source: "document",
              documentId: doc.id,
              documentName: doc.name,
              detail: kd.context
            });
          }
        });
      }
    });

    return events;
  } catch {
    return [];
  }
}

async function getRentalEvents(): Promise<CalendarEvent[]> {
  try {
    const rentals = await readJsonStorage<any>("rental", "rentals.json", {});
    const events: CalendarEvent[] = [];

    rentals.properties?.forEach((prop: any) => {
      if (prop.leaseEnd) {
        events.push({
          id: `rental-lease-${prop.id}`,
          title: `Lease Expiry: ${prop.name}`,
          date: prop.leaseEnd,
          category: "Rent & Property",
          source: "document",
          detail: `Tenant: ${prop.tenantName} — Monthly Rent: ₹${prop.monthlyRent}`
        });
      }
    });

    return events;
  } catch {
    return [];
  }
}

export async function GET() {
  const customEvents = await getCustomEvents();
  const docEvents = await getDocumentEvents();
  const rentalEvents = await getRentalEvents();

  const userEvents: CalendarEvent[] = customEvents.map((ce) => ({
    id: ce.id,
    title: ce.title,
    date: ce.date,
    category: ce.category,
    source: "user",
    detail: ce.description
  }));

  const allEvents = [...docEvents, ...rentalEvents, ...userEvents];
  return Response.json(allEvents);
}

export async function POST(request: Request) {
  const body = await request.json() as Partial<CustomEvent>;
  if (!body.title || !body.date) {
    return Response.json({ error: "Title and date are required." }, { status: 400 });
  }

  const customEvents = await getCustomEvents();
  const newEvent: CustomEvent = {
    id: crypto.randomUUID(),
    title: body.title.trim(),
    date: body.date,
    category: body.category || "Personal",
    description: body.description?.trim() || "",
    createdAt: new Date().toISOString()
  };

  const updated = [newEvent, ...customEvents];
  await writeJsonStorage("calendar", "events.json", updated);
  return Response.json(newEvent, { status: 201 });
}
