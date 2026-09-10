import { readJsonStorage, writeJsonStorage } from "@/lib/storage";
import type { DocumentRecord } from "../documents/route";

export type TaskRecord = {
  id: string;
  title: string;
  category: string;
  priority: "High" | "Medium" | "Low";
  completed: boolean;
  dueDate?: string;
  notes?: string;
  source: "user" | "document";
  documentId?: string;
  documentName?: string;
  createdAt: string;
};

async function getUserTasks(): Promise<TaskRecord[]> {
  return readJsonStorage<TaskRecord[]>("tasks", "tasks.json", []);
}

async function getDeletedTaskIds(): Promise<string[]> {
  return readJsonStorage<string[]>("tasks", "deleted.json", []);
}

async function saveDeletedTaskIds(ids: string[]): Promise<void> {
  await writeJsonStorage("tasks", "deleted.json", ids);
}

async function getDocumentActionItems(): Promise<TaskRecord[]> {
  try {
    const docs = await readJsonStorage<DocumentRecord[]>("documents", "documents.json", []);
    const items: TaskRecord[] = [];

    docs.forEach((doc) => {
      if (!doc.analysis?.actionItems) return;
      doc.analysis.actionItems.forEach((action, idx) => {
        items.push({
          id: `doc-action-${doc.id}-${idx}`,
          title: action,
          category: doc.category,
          priority: "High",
          completed: false,
          source: "document",
          documentId: doc.id,
          documentName: doc.name,
          createdAt: doc.uploadedAt
        });
      });
    });

    return items;
  } catch {
    return [];
  }
}

export async function GET() {
  const userTasks = await getUserTasks();
  const docActionItems = await getDocumentActionItems();
  const deletedIds = new Set(await getDeletedTaskIds());

  const seenTitles = new Set<string>();
  const uniqueTasks: TaskRecord[] = [];

  [...userTasks, ...docActionItems].forEach((t) => {
    if (deletedIds.has(t.id)) return;
    const normTitle = t.title.trim().toLowerCase();
    if (seenTitles.has(normTitle)) return;
    seenTitles.add(normTitle);
    uniqueTasks.push(t);
  });

  return Response.json(uniqueTasks);
}

export async function POST(request: Request) {
  const body = await request.json() as Partial<TaskRecord>;
  if (!body.title) {
    return Response.json({ error: "Task title is required." }, { status: 400 });
  }

  const userTasks = await getUserTasks();
  const newTask: TaskRecord = {
    id: crypto.randomUUID(),
    title: body.title.trim(),
    category: body.category?.trim() || "Personal",
    priority: body.priority || "Medium",
    completed: false,
    dueDate: body.dueDate || undefined,
    notes: body.notes?.trim() || undefined,
    source: "user",
    createdAt: new Date().toISOString()
  };

  const updated = [newTask, ...userTasks];
  await writeJsonStorage("tasks", "tasks.json", updated);
  return Response.json(newTask, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await request.json() as { id: string; completed: boolean };
  if (!body.id) {
    return Response.json({ error: "Task ID is required." }, { status: 400 });
  }

  const userTasks = await getUserTasks();
  const index = userTasks.findIndex((t) => t.id === body.id);
  if (index !== -1) {
    userTasks[index].completed = body.completed;
    await writeJsonStorage("tasks", "tasks.json", userTasks);
    return Response.json(userTasks[index]);
  }

  return Response.json({ error: "Task not found." }, { status: 404 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  let id = searchParams.get("id");

  if (!id) {
    try {
      const body = await request.json() as { id?: string };
      id = body.id || null;
    } catch {}
  }

  if (!id) {
    return Response.json({ error: "Task ID is required." }, { status: 400 });
  }

  const userTasks = await getUserTasks();
  const updatedUserTasks = userTasks.filter((t) => t.id !== id);
  if (updatedUserTasks.length !== userTasks.length) {
    await writeJsonStorage("tasks", "tasks.json", updatedUserTasks);
  }

  const deletedIds = await getDeletedTaskIds();
  if (!deletedIds.includes(id)) {
    deletedIds.push(id);
    await saveDeletedTaskIds(deletedIds);
  }

  return Response.json({ success: true, id });
}
