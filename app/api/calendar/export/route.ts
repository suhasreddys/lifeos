import { readFile } from "fs/promises";
import path from "path";

function formatICalDate(dateStr: string): string {
  const cleanDate = dateStr.replace(/-/g, "");
  return `${cleanDate}T090000Z`;
}

export async function GET() {
  const dataDir = path.join(process.cwd(), "data");

  let events: Array<{ id: string; title: string; date: string; category?: string; description?: string }> = [];

  // 1. Custom & Synced Events
  try {
    const custom = JSON.parse(await readFile(path.join(dataDir, "calendar", "events.json"), "utf8"));
    events = [...custom];
  } catch {}

  // 2. Documents Expiry Events
  try {
    const docs = JSON.parse(await readFile(path.join(dataDir, "documents", "documents.json"), "utf8"));
    docs.forEach((doc: any) => {
      if (doc.analysis?.expiryDate) {
        events.push({
          id: `exp-${doc.id}`,
          title: `Expiration: ${doc.name}`,
          date: doc.analysis.expiryDate,
          category: "Document Expiry",
          description: `Document category: ${doc.category}`
        });
      }
    });
  } catch {}

  // 3. Rental Lease Expiry Events
  try {
    const rentals = JSON.parse(await readFile(path.join(dataDir, "rental", "rentals.json"), "utf8"));
    rentals.properties?.forEach((prop: any) => {
      if (prop.leaseEnd) {
        events.push({
          id: `lease-${prop.id}`,
          title: `Lease Expiry: ${prop.name} (${prop.tenantName})`,
          date: prop.leaseEnd,
          category: "Rent & Property",
          description: `Monthly Rent: ₹${prop.monthlyRent}`
        });
      }
    });
  } catch {}

  let icsContent = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//LifeOS//Personal Command Center//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:LifeOS Calendar\r\n";

  events.forEach((ev) => {
    if (!ev.date || !ev.title) return;
    const formattedDate = formatICalDate(ev.date);
    icsContent += "BEGIN:VEVENT\r\n";
    icsContent += `UID:${ev.id}@lifeos.local\r\n`;
    icsContent += `DTSTAMP:${formattedDate}\r\n`;
    icsContent += `DTSTART:${formattedDate}\r\n`;
    icsContent += `SUMMARY:${ev.title.replace(/,/g, "\\,")}\r\n`;
    if (ev.description) {
      icsContent += `DESCRIPTION:${ev.description.replace(/,/g, "\\,")}\r\n`;
    }
    icsContent += "END:VEVENT\r\n";
  });

  icsContent += "END:VCALENDAR\r\n";

  return new Response(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="lifeos-calendar.ics"'
    }
  });
}
