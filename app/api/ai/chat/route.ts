import { callGeminiApi } from "../../../../lib/gemini";
import { readJsonStorage, writeJsonStorage } from "@/lib/storage";
import type { DocumentRecord } from "../../documents/route";

type Message = { role: "user" | "model"; content: string };

async function gatherLifeOSContext(): Promise<string> {
  let contextStr = "=== LIFEOS PERSONAL COMMAND CENTER CONTEXT ===\n\n";

  // 1. Documents Context
  try {
    const docs = await readJsonStorage<DocumentRecord[]>("documents", "documents.json", []);
    contextStr += `📁 SAVED DOCUMENTS (${docs.length}):\n`;
    docs.forEach((doc) => {
      contextStr += `- ${doc.name} (Category: ${doc.category}, Uploaded: ${doc.uploadedAt.split("T")[0]})\n`;
      if (doc.analysis) {
        contextStr += `  AI Summary: ${doc.analysis.summary}\n`;
        if (doc.analysis.expiryDate) contextStr += `  Expiry Date: ${doc.analysis.expiryDate}\n`;
        if (doc.analysis.keyDates?.length) contextStr += `  Key Dates: ${JSON.stringify(doc.analysis.keyDates)}\n`;
        if (doc.analysis.actionItems?.length) contextStr += `  Action Items: ${JSON.stringify(doc.analysis.actionItems)}\n`;
      }
    });
    contextStr += "\n";
  } catch {
    contextStr += "📁 SAVED DOCUMENTS: None recorded.\n\n";
  }

  // 2. Calendar Events Context
  try {
    const events = await readJsonStorage<any[]>("calendar", "events.json", []);
    contextStr += `📅 CALENDAR & REMINDERS (${events.length}):\n`;
    events.forEach((ev: { title: string; date: string; category: string; description?: string }) => {
      contextStr += `- ${ev.date}: ${ev.title} (${ev.category}) ${ev.description ? `- ${ev.description}` : ""}\n`;
    });
    contextStr += "\n";
  } catch {
    contextStr += "📅 CALENDAR: No custom events recorded.\n\n";
  }

  // 3. Tasks Context
  try {
    const tasks = await readJsonStorage<any[]>("tasks", "tasks.json", []);
    contextStr += `✓ TASKS & TO-DOS (${tasks.length}):\n`;
    tasks.forEach((t: { title: string; category: string; priority: string; completed: boolean; dueDate?: string }) => {
      contextStr += `- [${t.completed ? "X" : " "}] ${t.title} (Priority: ${t.priority}, Category: ${t.category}${t.dueDate ? `, Due: ${t.dueDate}` : ""})\n`;
    });
    contextStr += "\n";
  } catch {
    contextStr += "✓ TASKS: No custom tasks recorded.\n\n";
  }

  // 4. Financial Transactions Context
  try {
    const txs = await readJsonStorage<any[]>("finance", "transactions.json", []);
    contextStr += `💰 FINANCIAL TRANSACTIONS (${txs.length}):\n`;
    txs.forEach((tx: { title: string; amount: number; type: string; category: string; date: string }) => {
      contextStr += `- ${tx.date}: ${tx.type === "Income" ? "+" : "-"}₹${tx.amount} — ${tx.title} (${tx.category})\n`;
    });
    contextStr += "\n";
  } catch {
    contextStr += "💰 FINANCES: No transactions recorded.\n\n";
  }

  // 5. Tenant & Landlord Rental Context
  try {
    const rentals = await readJsonStorage<any>("rental", "rentals.json", {});
    contextStr += `🏠 TENANT & LANDLORD RENTAL MANAGER:\n`;
    contextStr += `Properties (${rentals.properties?.length || 0}): ${JSON.stringify(rentals.properties || [])}\n`;
    contextStr += `Rent Payments (${rentals.payments?.length || 0}): ${JSON.stringify(rentals.payments || [])}\n`;
    contextStr += `Deposits (${rentals.deposits?.length || 0}): ${JSON.stringify(rentals.deposits || [])}\n`;
    contextStr += `Maintenance Tickets (${rentals.maintenance?.length || 0}): ${JSON.stringify(rentals.maintenance || [])}\n`;
    contextStr += `Meter Readings (${rentals.meterReadings?.length || 0}): ${JSON.stringify(rentals.meterReadings || [])}\n`;
    contextStr += `Notices (${rentals.notices?.length || 0}): ${JSON.stringify(rentals.notices || [])}\n`;
    contextStr += `Inspections (${rentals.inspections?.length || 0}): ${JSON.stringify(rentals.inspections || [])}\n\n`;
  } catch {
    contextStr += "🏠 RENTALS: No property data recorded.\n\n";
  }

  return contextStr;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { messages?: Message[] };
    const messages = body.messages || [];

    if (messages.length === 0) {
      return Response.json({ error: "Messages array is required." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "GEMINI_API_KEY is missing. Please set GEMINI_API_KEY in your .env.local file." }, { status: 500 });
    }

    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
    const systemContext = await gatherLifeOSContext();

    const latestUserMessage = messages[messages.length - 1].content;

    const fullPrompt = `${systemContext}
You are the helpful, intelligent personal AI assistant for LifeOS.
Today's date is: ${new Date().toISOString().split("T")[0]}.

Your goal is to answer user queries accurately using the LifeOS context above.
If the user asks to set a reminder, add a task, or schedule an event (e.g. "Remind me to renew my passport on Nov 20, 2026"), parse the date into ISO format (YYYY-MM-DD) and return a JSON object with this shape:
{
  "reply": "string (Friendly confirmation response to the user)",
  "action": {
    "type": "add_reminder" | "add_task" | "none",
    "title": "string",
    "date": "YYYY-MM-DD",
    "category": "Reminder" | "Personal" | "Work" | "Important",
    "description": "string"
  }
}

If no action is needed, set action to {"type": "none"}.
Always output valid JSON matching this exact structure.

USER QUESTION:
${latestUserMessage}`;

    const geminiRes = await callGeminiApi({
      prompt: fullPrompt,
      apiKey,
      model,
      responseMimeType: "application/json",
      temperature: 0.1
    });

    if (geminiRes.error || !geminiRes.text) {
      return Response.json({ error: geminiRes.error || "Failed to reach Gemini API." }, { status: geminiRes.isRateLimit ? 429 : 500 });
    }

    const textResult = geminiRes.text;

    let parsedResult: { reply: string; action?: { type: string; title?: string; date?: string; category?: string; description?: string } };
    try {
      parsedResult = JSON.parse(textResult);
    } catch {
      return Response.json({ text: textResult });
    }

    // Execute actions if Gemini recognized reminder/task creation intent
    if (parsedResult.action && parsedResult.action.type !== "none" && parsedResult.action.title && parsedResult.action.date) {
      const { type, title, date, category, description } = parsedResult.action;

      if (type === "add_reminder") {
        let events = await readJsonStorage<any[]>("calendar", "events.json", []);
        events.unshift({
          id: crypto.randomUUID(),
          title,
          date,
          category: category || "Reminder",
          description: description || "Added via LifeOS Personal AI Assistant",
          createdAt: new Date().toISOString()
        });
        await writeJsonStorage("calendar", "events.json", events);
      } else if (type === "add_task") {
        let tasks = await readJsonStorage<any[]>("tasks", "tasks.json", []);
        tasks.unshift({
          id: crypto.randomUUID(),
          title,
          category: category || "Personal",
          priority: "High",
          completed: false,
          dueDate: date,
          notes: description || "Added via LifeOS Personal AI Assistant",
          source: "user",
          createdAt: new Date().toISOString()
        });
        await writeJsonStorage("tasks", "tasks.json", tasks);
      }
    }

    return Response.json({ text: parsedResult.reply || textResult });
  } catch (error) {
    return Response.json({ error: "LifeOS Personal AI Assistant error: " + (error instanceof Error ? error.message : "An error occurred.") }, { status: 500 });
  }
}
