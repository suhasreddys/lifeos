import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
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

const tasksDir = path.join(process.cwd(), "data", "tasks");
const tasksFilePath = path.join(tasksDir, "tasks.json");
const deletedFilePath = path.join(tasksDir, "deleted.json");
const docsFilePath = path.join(process.cwd(), "data", "documents", "documents.json");

async function getUserTasks(): Promise<TaskRecord[]> {
  await mkdir(tasksDir, { recursive: true });
  try {
    return JSON.parse(await readFile(tasksFilePath, "utf8")) as TaskRecord[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function getDeletedTaskIds(): Promise<string[]> {
  await mkdir(tasksDir, { recursive: true });
  try {
    return JSON.parse(await readFile(deletedFilePath, "utf8")) as string[];
  } catch {
    return [];
  }
}

async function saveDeletedTaskIds(ids: string[]): Promise<void> {
  await mkdir(tasksDir, { recursive: true });
  await writeFile(deletedFilePath, JSON.stringify(ids, null, 2), "utf8");
}

async function getDocumentActionItems(): Promise<TaskRecord[]> {
  try {
    const docs = JSON.parse(await readFile(docsFilePath, "utf8")) as DocumentRecord[];
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
  await writeFile(tasksFilePath, JSON.stringify(updated, null, 2), "utf8");
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
    await writeFile(tasksFilePath, JSON.stringify(userTasks, null, 2), "utf8");
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
    await writeFile(tasksFilePath, JSON.stringify(updatedUserTasks, null, 2), "utf8");
  }

  const deletedIds = await getDeletedTaskIds();
  if (!deletedIds.includes(id)) {
    deletedIds.push(id);
    await saveDeletedTaskIds(deletedIds);
  }

  return Response.json({ success: true, id });
}
