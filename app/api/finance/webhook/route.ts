import { readJsonStorage, writeJsonStorage } from "@/lib/storage";
import type { TransactionRecord } from "../route";

async function getUserTransactions(): Promise<TransactionRecord[]> {
  return readJsonStorage<TransactionRecord[]>("finance", "transactions.json", []);
}

function parseSmsLocally(smsText: string): Partial<TransactionRecord> | null {
  const text = smsText.trim();
  if (!text) return null;

  // Extract amount
  const amountMatch = text.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i) || text.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr|₹)/i);
  if (!amountMatch) return null;

  const rawAmount = amountMatch[1].replace(/,/g, "");
  const amount = parseFloat(rawAmount);
  if (isNaN(amount) || amount <= 0) return null;

  // Determine Income vs Expense
  const isIncome = /credited|received|added|refund|cashback|deposited/i.test(text);
  const type: "Income" | "Expense" = isIncome ? "Income" : "Expense";

  // Extract merchant / vendor
  let title = "UPI Transaction";
  const vendorMatch = text.match(/(?:to|at|info:)\s+([A-Za-z0-9\s.&'-]+?)(?=\s+(?:on|via|ref|bal|using|val|\.|,|$))/i) ||
                      text.match(/vpa\s+([A-Za-z0-9.@_-]+)/i);
  if (vendorMatch && vendorMatch[1].trim().length > 1) {
    title = vendorMatch[1].trim();
  }

  // Deduce category
  let category = "Other";
  const lowerText = text.toLowerCase();
  if (/swiggy|zomato|starbucks|restaurant|food|dine|cafe|dominos|pizza/i.test(lowerText)) {
    category = "Food & Dining";
  } else if (/amazon|flipkart|myntra|zepto|blinkit|instamart|shopping|mart/i.test(lowerText)) {
    category = "Shopping";
  } else if (/uber|ola|rapido|petrol|fuel|shell|metro|transport/i.test(lowerText)) {
    category = "Utilities";
  } else if (/rent|lease|landlord/i.test(lowerText)) {
    category = "Rent";
  } else if (/electricity|bescom|water|broadband|wifi|recharge|airtel|jio/i.test(lowerText)) {
    category = "Bills";
  } else if (/salary|credited by|company/i.test(lowerText)) {
    category = "Salary";
  }

  return {
    title,
    amount,
    type,
    category,
    date: new Date().toISOString().split("T")[0],
    notes: `Auto-parsed from SMS: "${text.slice(0, 100)}..."`,
    source: "user"
  };
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let smsText = "";

    if (contentType.includes("application/json")) {
      const payload = await request.json();
      smsText = payload.message || payload.text || payload.sms || payload.body || payload.content || JSON.stringify(payload);
    } else {
      smsText = await request.text();
    }

    if (!smsText.trim()) {
      return Response.json({ error: "No SMS text provided in request body." }, { status: 400 });
    }

    let parsed = parseSmsLocally(smsText);

    // If local parse failed or lacks details, try Gemini AI
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
        const prompt = `You are a financial SMS parser. Extract JSON from this bank/UPI SMS:
"{ "title": "Merchant or Sender Name", "amount": number, "type": "Income" | "Expense", "category": "Food & Dining|Shopping|Rent|Utilities|Bills|Salary|Other" }"
SMS TEXT: ${smsText}`;

        const aiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
            })
          }
        );

        if (aiRes.ok) {
          const payload = await aiRes.json();
          const aiText = payload.candidates?.[0]?.content?.parts?.[0]?.text;
          if (aiText) {
            const aiParsed = JSON.parse(aiText);
            if (aiParsed.amount && aiParsed.title) {
              parsed = {
                title: aiParsed.title,
                amount: Number(aiParsed.amount),
                type: aiParsed.type === "Income" ? "Income" : "Expense",
                category: aiParsed.category || "Other",
                date: new Date().toISOString().split("T")[0],
                notes: `AI Auto-Synced via Android Webhook`,
                source: "user"
              };
            }
          }
        }
      } catch {
        // Fallback to local parsing
      }
    }

    if (!parsed || !parsed.amount) {
      return Response.json({ error: "Could not identify transaction amount from SMS." }, { status: 422 });
    }

    const userTx = await getUserTransactions();
    const newTx: TransactionRecord = {
      id: crypto.randomUUID(),
      title: parsed.title || "UPI Transaction",
      amount: parsed.amount,
      type: parsed.type || "Expense",
      category: parsed.category || "Other",
      date: parsed.date || new Date().toISOString().split("T")[0],
      notes: parsed.notes,
      source: "user",
      createdAt: new Date().toISOString()
    };

    await writeJsonStorage("finance", "transactions.json", [newTx, ...userTx]);

    return Response.json({ success: true, transaction: newTx }, { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Failed to process SMS webhook." }, { status: 500 });
  }
}
