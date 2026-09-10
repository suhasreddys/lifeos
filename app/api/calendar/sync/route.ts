import { readJsonStorage, writeJsonStorage } from "@/lib/storage";
import type { CustomEvent } from "../route";

type CalendarSettings = {
  googleCalendarUrl?: string;
  lastSyncedAt?: string;
};

function parseICalDate(dtStr: string): string | null {
  if (!dtStr) return null;
  // Clean parameter prefixes like DTSTART;VALUE=DATE:20260915
  const val = dtStr.includes(":") ? dtStr.split(":").pop()! : dtStr;
  const match = val.trim().match(/^(\d{4})(\d{2})(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
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
        description: description ? description.replace(/\\n/g, " ") : undefined
      });
    }
  }

  return events;
}

export async function GET() {
  const settings = await readJsonStorage<CalendarSettings>("calendar", "settings.json", { googleCalendarUrl: "", lastSyncedAt: undefined });
  return Response.json(settings);
}

export async function POST(request: Request) {
  const body = await request.json() as { url?: string };
  let url = body.url?.trim() || "";

  if (!url) {
    return Response.json({ error: "Please enter a valid Google Calendar iCal URL." }, { status: 400 });
  }

  // Convert webcal:// to https://
  if (url.startsWith("webcal://")) {
    url = "https://" + url.substring("webcal://".length);
  }

  try {
    const response = await fetch(url, { headers: { "User-Agent": "LifeOS-Calendar-Sync/1.0" } });
    if (!response.ok) {
      return Response.json({ error: `Could not fetch Google Calendar. HTTP Status: ${response.status}` }, { status: 400 });
    }

    const icsText = await response.text();
    const parsedEvents = parseICS(icsText);

    if (parsedEvents.length === 0) {
      return Response.json({ error: "No upcoming events found in this Google Calendar feed." }, { status: 400 });
    }

    // Load existing custom events
    const customEvents = await readJsonStorage<CustomEvent[]>("calendar", "events.json", []);

    // Filter out previous Google Calendar events to avoid duplicates
    const nonGcalEvents = customEvents.filter(e => e.category !== ("Google Calendar" as any));

    const newGcalEvents: CustomEvent[] = parsedEvents.map(e => ({
      id: `gcal-${crypto.randomUUID()}`,
      title: e.title,
      date: e.date,
      category: "Google Calendar" as any,
      description: e.description || "Synced from Google Calendar",
      createdAt: new Date().toISOString()
    }));

    const updatedEvents = [...newGcalEvents, ...nonGcalEvents];
    await writeJsonStorage("calendar", "events.json", updatedEvents);

    const settings: CalendarSettings = {
      googleCalendarUrl: url,
      lastSyncedAt: new Date().toISOString()
    };
    await writeJsonStorage("calendar", "settings.json", settings);

    return Response.json({
      success: true,
      syncedCount: newGcalEvents.length,
      lastSyncedAt: settings.lastSyncedAt
    });
  } catch (error) {
    return Response.json({ error: "Failed to sync Google Calendar: " + (error instanceof Error ? error.message : "Unknown error.") }, { status: 500 });
  }
}
