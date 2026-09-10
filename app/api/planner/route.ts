import { mkdir, readFile, writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";
import type { DayPlanRecord } from "./generate/route";

const dataDir = path.join(process.cwd(), "data");
const plannerDir = path.join(dataDir, "planner");
const plansPath = path.join(plannerDir, "plans.json");
const tasksDir = path.join(dataDir, "tasks");
const tasksPath = path.join(tasksDir, "tasks.json");

export async function GET() {
  try {
    const plans: DayPlanRecord[] = JSON.parse(await readFile(plansPath, "utf8"));
    return NextResponse.json(plans);
  } catch {
    return NextResponse.json([]);
  }
}

// POST endpoint to import plan action items into LifeOS Tasks
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { actionItems } = body as {
      actionItems: Array<{ title: string; category?: string; priority?: "High" | "Medium" | "Low"; notes?: string }>;
    };

    if (!Array.isArray(actionItems) || actionItems.length === 0) {
      return NextResponse.json({ error: "No action items to import." }, { status: 400 });
    }

    await mkdir(tasksDir, { recursive: true });
    let existingTasks: Array<{ id: string; title: string; category: string; priority: string; completed: boolean; dueDate?: string; notes?: string; source: string; createdAt: string }> = [];
    try {
      existingTasks = JSON.parse(await readFile(tasksPath, "utf8"));
    } catch {}

    const existingTitles = new Set(existingTasks.map((t) => t.title.trim().toLowerCase()));

    const todayStr = new Date().toISOString().split("T")[0];
    const newTasks: typeof existingTasks = [];

    actionItems.forEach((item) => {
      const cleanTitle = item.title.trim();
      if (!cleanTitle || existingTitles.has(cleanTitle.toLowerCase())) return;

      existingTitles.add(cleanTitle.toLowerCase());
      newTasks.push({
        id: crypto.randomUUID(),
        title: cleanTitle,
        category: item.category || "Personal",
        priority: item.priority || "Medium",
        completed: false,
        dueDate: todayStr,
        notes: item.notes ? `${item.notes} · Added from AI Daily Planner` : "Added from AI Daily Planner",
        source: "ai_planner",
        createdAt: new Date().toISOString()
      });
    });

    const updated = [...newTasks, ...existingTasks];
    await writeFile(tasksPath, JSON.stringify(updated, null, 2), "utf8");

    return NextResponse.json({ importedCount: newTasks.length });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to import tasks: " + (err instanceof Error ? err.message : "Error") },
      { status: 500 }
    );
  }
}

// PATCH endpoint to update plan items (action items, schedule blocks, topics)
export async function PATCH(request: Request) {
  try {
    const body = await request.json() as Partial<DayPlanRecord>;
    if (!body.id) {
      return NextResponse.json({ error: "Plan ID is required." }, { status: 400 });
    }

    await mkdir(plannerDir, { recursive: true });
    let plans: DayPlanRecord[] = [];
    try {
      plans = JSON.parse(await readFile(plansPath, "utf8"));
    } catch {}

    const index = plans.findIndex((p) => p.id === body.id);
    if (index !== -1) {
      plans[index] = { ...plans[index], ...body };
      await writeFile(plansPath, JSON.stringify(plans, null, 2), "utf8");
      return NextResponse.json(plans[index]);
    }

    return NextResponse.json({ error: "Plan not found." }, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update plan." }, { status: 500 });
  }
}
