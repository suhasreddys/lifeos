import { readJsonStorage } from "@/lib/storage";

function formatICalDate(dateStr: string): string {
  const cleanDate = dateStr.replace(/-/g, "");
  return `${cleanDate}T090000Z`;
}

export async function GET() {
  let events: Array<{ id: string; title: string; date: string; category?: string; description?: string }> = [];

  // 1. Custom & Synced Events
  const custom = await readJsonStorage<any[]>("calendar", "events.json", []);
  events = [...custom];

  // 2. Documents Expiry Events
  const docs = await readJsonStorage<any[]>("documents", "documents.json", []);
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

  // 3. Rental Lease Expiry Events
  const rentals = await readJsonStorage<any>("rental", "rentals.json", {});
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
