import { readJsonStorage, writeJsonStorage } from "@/lib/storage";
import { callGeminiApi } from "../../../lib/gemini";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require("pdf-parse/lib/pdf-parse.js");

export type PropertyRecord = {
  id: string;
  name: string;
  unit: string;
  address: string;
  tenantName: string;
  tenantPhone?: string;
  tenantEmail?: string;
  monthlyRent: number;
  securityDeposit: number;
  leaseStart: string;
  leaseEnd: string;
  status: "Occupied" | "Vacant" | "Maintenance";
  createdAt: string;
};

export type RentPaymentRecord = {
  id: string;
  propertyId: string;
  propertyName: string;
  tenantName: string;
  amount: number;
  paymentDate: string;
  period: string;
  method: string;
  status: "Paid" | "Pending" | "Overdue";
  notes?: string;
  createdAt: string;
};

export type DepositRecord = {
  id: string;
  propertyId: string;
  propertyName: string;
  tenantName: string;
  type: "Security Deposit" | "Pet Deposit" | "Key Deposit";
  amount: number;
  paidDate: string;
  status: "Held" | "Refunded" | "Deducted";
  deductionAmount?: number;
  notes?: string;
  createdAt: string;
};

export type MaintenanceRecord = {
  id: string;
  propertyId: string;
  propertyName: string;
  title: string;
  description: string;
  priority: "Low" | "Medium" | "High" | "Emergency";
  status: "Open" | "In Progress" | "Resolved";
  cost?: number;
  requestedBy: string;
  createdAt: string;
};

export type MeterReadingRecord = {
  id: string;
  propertyId: string;
  propertyName: string;
  meterType: "Electricity" | "Water" | "Gas";
  previousReading: number;
  currentReading: number;
  consumption: number;
  unit: string;
  readingDate: string;
  amount?: number;
  notes?: string;
  createdAt: string;
};

export type NoticeRecord = {
  id: string;
  propertyId: string;
  propertyName: string;
  tenantName: string;
  noticeType: "Rent Due" | "Rent Increase" | "Maintenance Entry" | "Lease Expiry" | "Notice to Vacate";
  issueDate: string;
  effectiveDate: string;
  details: string;
  status: "Sent" | "Acknowledged" | "Pending Action";
  createdAt: string;
};

export type MoveInspectionRecord = {
  id: string;
  propertyId: string;
  propertyName: string;
  tenantName: string;
  type: "Move-In" | "Move-Out";
  inspectionDate: string;
  wallsCondition: string;
  plumbingCondition: string;
  keysHanded: number;
  cleanlinessScore: number;
  notes?: string;
  status: "Completed" | "Pending Sign-off";
  createdAt: string;
};

export type RentalDataStore = {
  properties: PropertyRecord[];
  payments: RentPaymentRecord[];
  deposits: DepositRecord[];
  maintenance: MaintenanceRecord[];
  meterReadings: MeterReadingRecord[];
  notices: NoticeRecord[];
  inspections: MoveInspectionRecord[];
};

const initialSeedData: RentalDataStore = {
  properties: [
    {
      id: "prop-1",
      name: "Sunset Heights",
      unit: "Apt 4B",
      address: "124 Park Ave, Suite 4B",
      tenantName: "Sarah Jenkins",
      tenantPhone: "+1 (555) 234-5678",
      tenantEmail: "sarah.j@example.com",
      monthlyRent: 2200,
      securityDeposit: 2200,
      leaseStart: "2026-01-01",
      leaseEnd: "2026-12-31",
      status: "Occupied",
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "prop-2",
      name: "Greenwood Villa",
      unit: "House #12",
      address: "88 Greenwood Lane",
      tenantName: "David Miller",
      tenantPhone: "+1 (555) 876-5432",
      tenantEmail: "david.m@example.com",
      monthlyRent: 3500,
      securityDeposit: 3500,
      leaseStart: "2025-09-01",
      leaseEnd: "2026-08-31",
      status: "Occupied",
      createdAt: "2025-09-01T00:00:00.000Z"
    }
  ],
  payments: [
    {
      id: "pay-1",
      propertyId: "prop-1",
      propertyName: "Sunset Heights (Apt 4B)",
      tenantName: "Sarah Jenkins",
      amount: 2200,
      paymentDate: "2026-09-01",
      period: "September 2026",
      method: "Bank Transfer",
      status: "Paid",
      notes: "Paid on time",
      createdAt: "2026-09-01T10:00:00.000Z"
    },
    {
      id: "pay-2",
      propertyId: "prop-2",
      propertyName: "Greenwood Villa (House #12)",
      tenantName: "David Miller",
      amount: 3500,
      paymentDate: "2026-09-05",
      period: "September 2026",
      method: "UPI",
      status: "Paid",
      notes: "Received full rent",
      createdAt: "2026-09-05T14:30:00.000Z"
    }
  ],
  deposits: [
    {
      id: "dep-1",
      propertyId: "prop-1",
      propertyName: "Sunset Heights (Apt 4B)",
      tenantName: "Sarah Jenkins",
      type: "Security Deposit",
      amount: 2200,
      paidDate: "2026-01-01",
      status: "Held",
      notes: "Held in escrow account",
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "dep-2",
      propertyId: "prop-2",
      propertyName: "Greenwood Villa (House #12)",
      tenantName: "David Miller",
      type: "Security Deposit",
      amount: 3500,
      paidDate: "2025-09-01",
      status: "Held",
      notes: "Held in bank deposit",
      createdAt: "2025-09-01T00:00:00.000Z"
    }
  ],
  maintenance: [
    {
      id: "maint-1",
      propertyId: "prop-1",
      propertyName: "Sunset Heights (Apt 4B)",
      title: "Kitchen Sink Leak",
      description: "Minor water dripping underneath the kitchen sink pipe.",
      priority: "Medium",
      status: "In Progress",
      cost: 150,
      requestedBy: "Sarah Jenkins",
      createdAt: "2026-09-07T09:00:00.000Z"
    }
  ],
  meterReadings: [
    {
      id: "mr-1",
      propertyId: "prop-1",
      propertyName: "Sunset Heights (Apt 4B)",
      meterType: "Electricity",
      previousReading: 1420,
      currentReading: 1650,
      consumption: 230,
      unit: "kWh",
      readingDate: "2026-09-01",
      amount: 46,
      notes: "Monthly electric reading",
      createdAt: "2026-09-01T08:00:00.000Z"
    },
    {
      id: "mr-2",
      propertyId: "prop-1",
      propertyName: "Sunset Heights (Apt 4B)",
      meterType: "Water",
      previousReading: 310,
      currentReading: 345,
      consumption: 35,
      unit: "kl",
      readingDate: "2026-09-01",
      amount: 25,
      notes: "Water meter check",
      createdAt: "2026-09-01T08:05:00.000Z"
    }
  ],
  notices: [
    {
      id: "not-1",
      propertyId: "prop-1",
      propertyName: "Sunset Heights (Apt 4B)",
      tenantName: "Sarah Jenkins",
      noticeType: "Maintenance Entry",
      issueDate: "2026-09-08",
      effectiveDate: "2026-09-10",
      details: "Plumber visit scheduled between 10 AM - 12 PM for sink pipe repair.",
      status: "Sent",
      createdAt: "2026-09-08T11:00:00.000Z"
    }
  ],
  inspections: [
    {
      id: "insp-1",
      propertyId: "prop-1",
      propertyName: "Sunset Heights (Apt 4B)",
      tenantName: "Sarah Jenkins",
      type: "Move-In",
      inspectionDate: "2026-01-01",
      wallsCondition: "Good, fresh paint",
      plumbingCondition: "No leaks observed",
      keysHanded: 3,
      cleanlinessScore: 9,
      notes: "Tenant verified initial condition report.",
      status: "Completed",
      createdAt: "2026-01-01T12:00:00.000Z"
    }
  ]
};

export async function getRentalData(): Promise<RentalDataStore> {
  const parsed = await readJsonStorage<Partial<RentalDataStore>>("rental", "rentals.json", initialSeedData);
  return {
    properties: parsed.properties || [],
    payments: parsed.payments || [],
    deposits: parsed.deposits || [],
    maintenance: parsed.maintenance || [],
    meterReadings: parsed.meterReadings || [],
    notices: parsed.notices || [],
    inspections: parsed.inspections || []
  };
}

export async function saveRentalData(data: RentalDataStore): Promise<void> {
  await writeJsonStorage("rental", "rentals.json", data);
}

export async function GET() {
  const data = await getRentalData();
  
  const totalProperties = data.properties.length;
  const occupiedUnits = data.properties.filter(p => p.status === "Occupied").length;
  const totalMonthlyRent = data.properties.reduce((sum, p) => sum + p.monthlyRent, 0);
  const totalCollectedRent = data.payments.filter(p => p.status === "Paid").reduce((sum, p) => sum + p.amount, 0);
  const totalDepositsHeld = data.deposits.filter(d => d.status === "Held").reduce((sum, d) => sum + d.amount, 0);
  const openMaintenanceTickets = data.maintenance.filter(m => m.status !== "Resolved").length;

  return Response.json({
    summary: {
      totalProperties,
      occupiedUnits,
      totalMonthlyRent,
      totalCollectedRent,
      totalDepositsHeld,
      openMaintenanceTickets
    },
    data
  });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const data = await getRentalData();

  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return Response.json({ error: "No document file uploaded." }, { status: 400 });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return Response.json({ error: "GEMINI_API_KEY is missing. Please set GEMINI_API_KEY in .env.local" }, { status: 500 });
      }

      const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
      const buffer = Buffer.from(await file.arrayBuffer());

      let contents: any[] = [];
      const promptText = `You are an expert real estate AI. Analyze the rental or lease agreement document below. Extract lease details into valid JSON:
{
  "propertyName": "string (Property or Apartment building name)",
  "unit": "string (Unit or Flat number)",
  "address": "string (Full address)",
  "tenantName": "string (Full tenant name)",
  "tenantPhone": "string (Phone number if present)",
  "tenantEmail": "string (Email address if present)",
  "monthlyRent": number (Monthly rent amount in numbers only),
  "securityDeposit": number (Security deposit amount in numbers only),
  "leaseStart": "YYYY-MM-DD (Lease start date)",
  "leaseEnd": "YYYY-MM-DD (Lease end date)"
}`;

      if (file.type.startsWith("image/")) {
        const base64Data = buffer.toString("base64");
        contents = [{
          parts: [
            { inlineData: { mimeType: file.type || "image/jpeg", data: base64Data } },
            { text: promptText }
          ]
        }];
      } else {
        let docText = "";
        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
          const parsed = await pdf(buffer);
          docText = parsed.text;
        } else {
          docText = buffer.toString("utf8");
        }

        if (!docText.trim()) {
          return Response.json({ error: "Could not extract readable text from document." }, { status: 400 });
        }

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
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json"
            }
          })
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        return Response.json({ error: "Gemini API error: " + (payload?.error?.message || "Failed to analyze document.") }, { status: response.status });
      }

      const textResult = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResult) {
        return Response.json({ error: "Gemini returned empty lease data." }, { status: 502 });
      }

      let parsedLease: Partial<PropertyRecord>;
      try {
        parsedLease = JSON.parse(textResult);
      } catch {
        return Response.json({ error: "Could not parse extracted lease JSON." }, { status: 502 });
      }

      const newProp: PropertyRecord = {
        id: `prop-${crypto.randomUUID()}`,
        name: parsedLease.name || (parsedLease.tenantName ? `${parsedLease.tenantName}'s Unit` : file.name.replace(/\.[^/.]+$/, "")),
        unit: parsedLease.unit || "Main Unit",
        address: parsedLease.address || "Agreed Premises",
        tenantName: parsedLease.tenantName || "Tenant",
        tenantPhone: parsedLease.tenantPhone || undefined,
        tenantEmail: parsedLease.tenantEmail || undefined,
        monthlyRent: Number(parsedLease.monthlyRent || 0),
        securityDeposit: Number(parsedLease.securityDeposit || parsedLease.monthlyRent || 0),
        leaseStart: parsedLease.leaseStart || new Date().toISOString().split("T")[0],
        leaseEnd: parsedLease.leaseEnd || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split("T")[0],
        status: "Occupied",
        createdAt: new Date().toISOString()
      };

      data.properties.unshift(newProp);

      if (newProp.securityDeposit > 0) {
        data.deposits.unshift({
          id: `dep-${newProp.id}`,
          propertyId: newProp.id,
          propertyName: `${newProp.name} (${newProp.unit})`,
          tenantName: newProp.tenantName,
          type: "Security Deposit",
          amount: newProp.securityDeposit,
          paidDate: newProp.leaseStart,
          status: "Held",
          notes: `Uploaded Document: ${file.name}`,
          createdAt: new Date().toISOString()
        });
      }

      await saveRentalData(data);
      return Response.json({ success: true, item: newProp, extractedData: parsedLease }, { status: 201 });
    } catch (err) {
      return Response.json({ error: "File parsing error: " + (err instanceof Error ? err.message : "Failed to process file.") }, { status: 500 });
    }
  }

  const body = await request.json();
  const { action } = body;

  if (action === "create_property") {
    const { name, unit, address, tenantName, tenantPhone, tenantEmail, monthlyRent, securityDeposit, leaseStart, leaseEnd } = body;
    if (!name || !tenantName || !monthlyRent) {
      return Response.json({ error: "Property name, tenant name, and monthly rent are required." }, { status: 400 });
    }
    const newProp: PropertyRecord = {
      id: `prop-${crypto.randomUUID()}`,
      name: name.trim(),
      unit: unit?.trim() || "Main",
      address: address?.trim() || "",
      tenantName: tenantName.trim(),
      tenantPhone: tenantPhone?.trim(),
      tenantEmail: tenantEmail?.trim(),
      monthlyRent: Number(monthlyRent),
      securityDeposit: Number(securityDeposit || monthlyRent),
      leaseStart: leaseStart || new Date().toISOString().split("T")[0],
      leaseEnd: leaseEnd || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      status: "Occupied",
      createdAt: new Date().toISOString()
    };
    data.properties.unshift(newProp);
    await saveRentalData(data);
    return Response.json({ success: true, item: newProp }, { status: 201 });
  }

  if (action === "log_payment") {
    const { propertyId, amount, period, method, status, notes } = body;
    const prop = data.properties.find(p => p.id === propertyId);
    if (!propertyId || !amount) {
      return Response.json({ error: "Property and payment amount are required." }, { status: 400 });
    }
    const newPayment: RentPaymentRecord = {
      id: `pay-${crypto.randomUUID()}`,
      propertyId,
      propertyName: prop ? `${prop.name} (${prop.unit})` : "Property",
      tenantName: prop?.tenantName || "Tenant",
      amount: Number(amount),
      paymentDate: new Date().toISOString().split("T")[0],
      period: period || "Current Month",
      method: method || "Bank Transfer",
      status: status || "Paid",
      notes: notes?.trim(),
      createdAt: new Date().toISOString()
    };
    data.payments.unshift(newPayment);
    await saveRentalData(data);
    return Response.json({ success: true, item: newPayment }, { status: 201 });
  }

  if (action === "create_maintenance") {
    const { propertyId, title, description, priority, requestedBy, cost } = body;
    const prop = data.properties.find(p => p.id === propertyId);
    if (!title || !description) {
      return Response.json({ error: "Title and description are required." }, { status: 400 });
    }
    const newTicket: MaintenanceRecord = {
      id: `maint-${crypto.randomUUID()}`,
      propertyId: propertyId || data.properties[0]?.id || "general",
      propertyName: prop ? `${prop.name} (${prop.unit})` : "General",
      title: title.trim(),
      description: description.trim(),
      priority: priority || "Medium",
      status: "Open",
      cost: cost ? Number(cost) : undefined,
      requestedBy: requestedBy?.trim() || prop?.tenantName || "Tenant",
      createdAt: new Date().toISOString()
    };
    data.maintenance.unshift(newTicket);
    await saveRentalData(data);
    return Response.json({ success: true, item: newTicket }, { status: 201 });
  }

  if (action === "log_meter_reading") {
    const { propertyId, meterType, previousReading, currentReading, unit, amount, notes } = body;
    const prop = data.properties.find(p => p.id === propertyId);
    const prev = Number(previousReading || 0);
    const curr = Number(currentReading || 0);
    const consumption = Math.max(0, curr - prev);

    const newReading: MeterReadingRecord = {
      id: `mr-${crypto.randomUUID()}`,
      propertyId: propertyId || data.properties[0]?.id || "general",
      propertyName: prop ? `${prop.name} (${prop.unit})` : "General",
      meterType: meterType || "Electricity",
      previousReading: prev,
      currentReading: curr,
      consumption,
      unit: unit || (meterType === "Water" ? "kl" : "kWh"),
      readingDate: new Date().toISOString().split("T")[0],
      amount: amount ? Number(amount) : undefined,
      notes: notes?.trim(),
      createdAt: new Date().toISOString()
    };
    data.meterReadings.unshift(newReading);
    await saveRentalData(data);
    return Response.json({ success: true, item: newReading }, { status: 201 });
  }

  if (action === "create_notice") {
    const { propertyId, noticeType, issueDate, effectiveDate, details } = body;
    const prop = data.properties.find(p => p.id === propertyId);
    if (!noticeType || !details) {
      return Response.json({ error: "Notice type and details are required." }, { status: 400 });
    }
    const newNotice: NoticeRecord = {
      id: `not-${crypto.randomUUID()}`,
      propertyId: propertyId || data.properties[0]?.id || "general",
      propertyName: prop ? `${prop.name} (${prop.unit})` : "General",
      tenantName: prop?.tenantName || "Tenant",
      noticeType: noticeType,
      issueDate: issueDate || new Date().toISOString().split("T")[0],
      effectiveDate: effectiveDate || new Date().toISOString().split("T")[0],
      details: details.trim(),
      status: "Sent",
      createdAt: new Date().toISOString()
    };
    data.notices.unshift(newNotice);
    await saveRentalData(data);
    return Response.json({ success: true, item: newNotice }, { status: 201 });
  }

  if (action === "create_inspection") {
    const { propertyId, type, wallsCondition, plumbingCondition, keysHanded, cleanlinessScore, notes } = body;
    const prop = data.properties.find(p => p.id === propertyId);
    const newInspection: MoveInspectionRecord = {
      id: `insp-${crypto.randomUUID()}`,
      propertyId: propertyId || data.properties[0]?.id || "general",
      propertyName: prop ? `${prop.name} (${prop.unit})` : "General",
      tenantName: prop?.tenantName || "Tenant",
      type: type || "Move-In",
      inspectionDate: new Date().toISOString().split("T")[0],
      wallsCondition: wallsCondition || "Satisfactory",
      plumbingCondition: plumbingCondition || "No leaks",
      keysHanded: Number(keysHanded || 2),
      cleanlinessScore: Number(cleanlinessScore || 8),
      notes: notes?.trim(),
      status: "Completed",
      createdAt: new Date().toISOString()
    };
    data.inspections.unshift(newInspection);
    await saveRentalData(data);
    return Response.json({ success: true, item: newInspection }, { status: 201 });
  }

  if (action === "delete_item") {
    const { section, id } = body;
    if (!section || !id || !(section in data)) {
      return Response.json({ error: "Valid section and item ID required for deletion." }, { status: 400 });
    }
    const secKey = section as keyof RentalDataStore;
    (data as any)[secKey] = (data[secKey] as any[]).filter(item => item.id !== id);
    await saveRentalData(data);
    return Response.json({ success: true, deletedId: id });
  }

  if (action === "update_property") {
    const { id, name, unit, address, tenantName, tenantPhone, tenantEmail, monthlyRent, securityDeposit, leaseStart, leaseEnd, status } = body;
    const index = data.properties.findIndex(p => p.id === id);
    if (index === -1) return Response.json({ error: "Property not found." }, { status: 404 });

    data.properties[index] = {
      ...data.properties[index],
      name: name?.trim() || data.properties[index].name,
      unit: unit?.trim() || data.properties[index].unit,
      address: address?.trim() || data.properties[index].address,
      tenantName: tenantName?.trim() || data.properties[index].tenantName,
      tenantPhone: tenantPhone?.trim() ?? data.properties[index].tenantPhone,
      tenantEmail: tenantEmail?.trim() ?? data.properties[index].tenantEmail,
      monthlyRent: monthlyRent !== undefined ? Number(monthlyRent) : data.properties[index].monthlyRent,
      securityDeposit: securityDeposit !== undefined ? Number(securityDeposit) : data.properties[index].securityDeposit,
      leaseStart: leaseStart || data.properties[index].leaseStart,
      leaseEnd: leaseEnd || data.properties[index].leaseEnd,
      status: status || data.properties[index].status
    };
    await saveRentalData(data);
    return Response.json({ success: true, item: data.properties[index] });
  }

  if (action === "update_payment") {
    const { id, amount, period, method, status, notes } = body;
    const index = data.payments.findIndex(p => p.id === id);
    if (index === -1) return Response.json({ error: "Payment record not found." }, { status: 404 });

    data.payments[index] = {
      ...data.payments[index],
      amount: amount !== undefined ? Number(amount) : data.payments[index].amount,
      period: period || data.payments[index].period,
      method: method || data.payments[index].method,
      status: status || data.payments[index].status,
      notes: notes !== undefined ? notes.trim() : data.payments[index].notes
    };
    await saveRentalData(data);
    return Response.json({ success: true, item: data.payments[index] });
  }

  if (action === "update_maintenance") {
    const { id, title, description, priority, status, cost } = body;
    const index = data.maintenance.findIndex(m => m.id === id);
    if (index === -1) return Response.json({ error: "Maintenance ticket not found." }, { status: 404 });

    data.maintenance[index] = {
      ...data.maintenance[index],
      title: title?.trim() || data.maintenance[index].title,
      description: description?.trim() || data.maintenance[index].description,
      priority: priority || data.maintenance[index].priority,
      status: status || data.maintenance[index].status,
      cost: cost !== undefined ? Number(cost) : data.maintenance[index].cost
    };
    await saveRentalData(data);
    return Response.json({ success: true, item: data.maintenance[index] });
  }

  if (action === "update_meter_reading") {
    const { id, previousReading, currentReading, amount, notes } = body;
    const index = data.meterReadings.findIndex(mr => mr.id === id);
    if (index === -1) return Response.json({ error: "Meter reading not found." }, { status: 404 });

    const prev = previousReading !== undefined ? Number(previousReading) : data.meterReadings[index].previousReading;
    const curr = currentReading !== undefined ? Number(currentReading) : data.meterReadings[index].currentReading;

    data.meterReadings[index] = {
      ...data.meterReadings[index],
      previousReading: prev,
      currentReading: curr,
      consumption: Math.max(0, curr - prev),
      amount: amount !== undefined ? Number(amount) : data.meterReadings[index].amount,
      notes: notes !== undefined ? notes.trim() : data.meterReadings[index].notes
    };
    await saveRentalData(data);
    return Response.json({ success: true, item: data.meterReadings[index] });
  }

  if (action === "update_notice") {
    const { id, noticeType, details, effectiveDate, status } = body;
    const index = data.notices.findIndex(n => n.id === id);
    if (index === -1) return Response.json({ error: "Notice not found." }, { status: 404 });

    data.notices[index] = {
      ...data.notices[index],
      noticeType: noticeType || data.notices[index].noticeType,
      details: details?.trim() || data.notices[index].details,
      effectiveDate: effectiveDate || data.notices[index].effectiveDate,
      status: status || data.notices[index].status
    };
    await saveRentalData(data);
    return Response.json({ success: true, item: data.notices[index] });
  }

  if (action === "update_inspection") {
    const { id, wallsCondition, plumbingCondition, keysHanded, cleanlinessScore, notes, status } = body;
    const index = data.inspections.findIndex(ins => ins.id === id);
    if (index === -1) return Response.json({ error: "Inspection record not found." }, { status: 404 });

    data.inspections[index] = {
      ...data.inspections[index],
      wallsCondition: wallsCondition || data.inspections[index].wallsCondition,
      plumbingCondition: plumbingCondition || data.inspections[index].plumbingCondition,
      keysHanded: keysHanded !== undefined ? Number(keysHanded) : data.inspections[index].keysHanded,
      cleanlinessScore: cleanlinessScore !== undefined ? Number(cleanlinessScore) : data.inspections[index].cleanlinessScore,
      notes: notes !== undefined ? notes.trim() : data.inspections[index].notes,
      status: status || data.inspections[index].status
    };
    await saveRentalData(data);
    return Response.json({ success: true, item: data.inspections[index] });
  }

  if (action === "parse_agreement_text") {
    const { agreementText } = body;
    if (!agreementText || typeof agreementText !== "string" || !agreementText.trim()) {
      return Response.json({ error: "Agreement text is required." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "GEMINI_API_KEY is missing. Please set GEMINI_API_KEY in .env.local" }, { status: 500 });
    }

    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
    const prompt = `You are an expert real estate AI. Parse the rental / lease agreement text below and extract lease details into valid JSON:
{
  "propertyName": "string (Property or Apartment building name)",
  "unit": "string (Unit or Flat number)",
  "address": "string (Full address)",
  "tenantName": "string (Full tenant name)",
  "tenantPhone": "string (Phone number if present)",
  "tenantEmail": "string (Email address if present)",
  "monthlyRent": number (Monthly rent amount in numbers only),
  "securityDeposit": number (Security deposit amount in numbers only),
  "leaseStart": "YYYY-MM-DD (Lease start date)",
  "leaseEnd": "YYYY-MM-DD (Lease end date)"
}

AGREEMENT TEXT:
${agreementText.slice(0, 24000)}`;

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

    let parsedLease: Partial<PropertyRecord>;
    try {
      parsedLease = JSON.parse(textResult);
    } catch {
      return Response.json({ error: "Could not parse extracted lease JSON." }, { status: 502 });
    }

    const newProp: PropertyRecord = {
      id: `prop-${crypto.randomUUID()}`,
      name: parsedLease.name || parsedLease.tenantName ? `${parsedLease.tenantName}'s Unit` : "Extracted Property",
      unit: parsedLease.unit || "Main Unit",
      address: parsedLease.address || "Agreed Premises",
      tenantName: parsedLease.tenantName || "Tenant",
      tenantPhone: parsedLease.tenantPhone || undefined,
      tenantEmail: parsedLease.tenantEmail || undefined,
      monthlyRent: Number(parsedLease.monthlyRent || 0),
      securityDeposit: Number(parsedLease.securityDeposit || parsedLease.monthlyRent || 0),
      leaseStart: parsedLease.leaseStart || new Date().toISOString().split("T")[0],
      leaseEnd: parsedLease.leaseEnd || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split("T")[0],
      status: "Occupied",
      createdAt: new Date().toISOString()
    };

    data.properties.unshift(newProp);

    if (newProp.securityDeposit > 0) {
      data.deposits.unshift({
        id: `dep-${newProp.id}`,
        propertyId: newProp.id,
        propertyName: `${newProp.name} (${newProp.unit})`,
        tenantName: newProp.tenantName,
        type: "Security Deposit",
        amount: newProp.securityDeposit,
        paidDate: newProp.leaseStart,
        status: "Held",
        notes: "Extracted via AI Agreement Scanner",
        createdAt: new Date().toISOString()
      });
    }

    await saveRentalData(data);
    return Response.json({ success: true, item: newProp, extractedData: parsedLease });
  }

  return Response.json({ error: "Invalid action type." }, { status: 400 });
}
