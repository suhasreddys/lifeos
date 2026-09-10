import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
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

const calendarDir = path.join(process.cwd(), "data", "calendar");
const calendarEventsPath = path.join(calendarDir, "events.json");
const docsEventsPath = path.join(process.cwd(), "data", "documents", "documents.json");

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
      events.push({
        title: summary.replace(/\\,/g, ",").replace(/\\;/g, ";"),
        date: dateStr,
        description: "Google Public Holiday"
      });
    }
  }

  return events;
}

async function ensureGoogleHolidaysLoaded(existingCustom: CustomEvent[]): Promise<CustomEvent[]> {
  const hasHolidays = existingCustom.some(e => e.category === "Holidays");
  if (hasHolidays) return existingCustom;

  try {
    const response = await fetch(GOOGLE_HOLIDAY_FEED_URL, { headers: { "User-Agent": "LifeOS-Auto-Holidays/1.0" } });
    if (!response.ok) return existingCustom;

    const icsText = await response.text();
    const parsedHolidays = parseICS(icsText);
    if (parsedHolidays.length === 0) return existingCustom;

    const holidayEvents: CustomEvent[] = parsedHolidays.map(e => ({
      id: `holiday-${crypto.randomUUID()}`,
      title: e.title,
      date: e.date,
      category: "Holidays",
      description: e.description || "Google Public Holiday",
      createdAt: new Date().toISOString()
    }));

    const updated = [...holidayEvents, ...existingCustom];
    await writeFile(calendarEventsPath, JSON.stringify(updated, null, 2), "utf8");
    return updated;
  } catch {
    return existingCustom;
  }
}

async function getCustomEvents(): Promise<CustomEvent[]> {
  await mkdir(calendarDir, { recursive: true });
  try {
    const custom = JSON.parse(await readFile(calendarEventsPath, "utf8")) as CustomEvent[];
    return await ensureGoogleHolidaysLoaded(custom);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const initialWithHolidays = await ensureGoogleHolidaysLoaded([]);
      return initialWithHolidays;
    }
    throw error;
  }
}

async function getDocumentEvents(): Promise<CalendarEvent[]> {
  try {
    const docs = JSON.parse(await readFile(docsEventsPath, "utf8")) as DocumentRecord[];
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

      doc.analysis.keyDates?.forEach((kd, index) => {
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
      });
    });

    return events;
  } catch {
    return [];
  }
}

async function getRentalEvents(): Promise<CalendarEvent[]> {
  try {
    const rentals = JSON.parse(await readFile(path.join(process.cwd(), "data", "rental", "rentals.json"), "utf8"));
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
  await writeFile(calendarEventsPath, JSON.stringify(updated, null, 2), "utf8");
  return Response.json(newEvent, { status: 201 });
}
