import { readJsonStorage, writeJsonStorage } from "@/lib/storage";
import type { DocumentRecord } from "../documents/route";

export type TransactionRecord = {
  id: string;
  title: string;
  amount: number;
  type: "Income" | "Expense";
  category: string;
  date: string;
  notes?: string;
  source: "user" | "document";
  documentId?: string;
  documentName?: string;
  createdAt: string;
};

async function getUserTransactions(): Promise<TransactionRecord[]> {
  return readJsonStorage<TransactionRecord[]>("finance", "transactions.json", []);
}

async function getDocumentFinancials(): Promise<TransactionRecord[]> {
  try {
    const docs = await readJsonStorage<DocumentRecord[]>("documents", "documents.json", []);
    const items: TransactionRecord[] = [];

    docs.forEach((doc) => {
      if (doc.category === "Bills" || doc.category === "Insurance") {
        items.push({
          id: `doc-fin-${doc.id}`,
          title: doc.name,
          amount: doc.analysis?.summary ? 0 : 0, // Recorded document reference
          type: "Expense",
          category: doc.category,
          date: doc.uploadedAt.split("T")[0],
          notes: doc.analysis?.summary || "Stored bill document",
          source: "document",
          documentId: doc.id,
          documentName: doc.name,
          createdAt: doc.uploadedAt
        });
      }
    });

    return items;
  } catch {
    return [];
  }
}

export async function GET() {
  const userTx = await getUserTransactions();
  const docTx = await getDocumentFinancials();
  const allTx = [...userTx, ...docTx];

  const totalIncome = userTx
    .filter((t) => t.type === "Income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = userTx
    .filter((t) => t.type === "Expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalIncome - totalExpenses;

  return Response.json({
    summary: {
      netBalance,
      totalIncome,
      totalExpenses,
      transactionCount: allTx.length
    },
    transactions: allTx
  });
}

export async function POST(request: Request) {
  const body = await request.json() as Partial<TransactionRecord>;
  if (!body.title || body.amount === undefined || !body.type) {
    return Response.json({ error: "Title, amount, and type are required." }, { status: 400 });
  }

  const userTx = await getUserTransactions();
  const newTx: TransactionRecord = {
    id: crypto.randomUUID(),
    title: body.title.trim(),
    amount: Number(body.amount),
    type: body.type,
    category: body.category?.trim() || "General",
    date: body.date || new Date().toISOString().split("T")[0],
    notes: body.notes?.trim() || undefined,
    source: "user",
    createdAt: new Date().toISOString()
  };

  const updated = [newTx, ...userTx];
  await writeJsonStorage("finance", "transactions.json", updated);
  return Response.json(newTx, { status: 201 });
}
