import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { CustomEvent } from "../route";

const calendarDir = path.join(process.cwd(), "data", "calendar");
const eventsPath = path.join(calendarDir, "events.json");

const GOOGLE_HOLIDAY_FEEDS = [
  { name: "India Holidays", url: "https://calendar.google.com/calendar/ical/en.indian%23holiday%40group.v.calendar.google.com/public/basic.ics" },
  { name: "US Holidays", url: "https://calendar.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics" }
];

function parseICalDate(dtStr: string): string | null {
  if (!dtStr) return null;
  const val = dtStr.includes(":") ? dtStr.split(":").pop()! : dtStr;
  const match = val.trim().match(/^(\d{4})(\d{2})(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return null;
}

function parseICS(icsText: string, feedName: string): Array<{ title: string; date: string; description?: string }> {
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
        description: `Public Holiday (${feedName})`
      });
    }
  }

  return events;
}

export async function POST(request: Request) {
  let region = "India";
  try {
    const body = await request.json();
    if (body.region) region = body.region;
  } catch {}

  const targetFeed = GOOGLE_HOLIDAY_FEEDS.find(f => f.name.toLowerCase().includes(region.toLowerCase())) || GOOGLE_HOLIDAY_FEEDS[0];

  try {
    const response = await fetch(targetFeed.url, { headers: { "User-Agent": "LifeOS-Holiday-Sync/1.0" } });
    if (!response.ok) {
      return Response.json({ error: `Failed to fetch Google Holidays feed. Status: ${response.status}` }, { status: 400 });
    }

    const icsText = await response.text();
    const parsedEvents = parseICS(icsText, targetFeed.name);

    if (parsedEvents.length === 0) {
      return Response.json({ error: "No holiday events found." }, { status: 400 });
    }

    await mkdir(calendarDir, { recursive: true });

    let existingEvents: CustomEvent[] = [];
    try {
      existingEvents = JSON.parse(await readFile(eventsPath, "utf8"));
    } catch {}

    // Filter out previous Holidays to avoid duplicates
    const nonHolidayEvents = existingEvents.filter(e => e.category !== ("Holidays" as any));

    const holidayEvents: CustomEvent[] = parsedEvents.map(e => ({
      id: `holiday-${crypto.randomUUID()}`,
      title: e.title,
      date: e.date,
      category: "Holidays" as any,
      description: e.description || "Google Public Holiday",
      createdAt: new Date().toISOString()
    }));

    const updated = [...holidayEvents, ...nonHolidayEvents];
    await writeFile(eventsPath, JSON.stringify(updated, null, 2), "utf8");

    return Response.json({
      success: true,
      syncedCount: holidayEvents.length,
      region: targetFeed.name
    });
  } catch (error) {
    return Response.json({ error: "Could not fetch Google Holidays: " + (error instanceof Error ? error.message : "Unknown error") }, { status: 500 });
  }
}
