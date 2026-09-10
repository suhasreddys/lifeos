import { NextResponse } from "next/server";
import { callGeminiApi } from "../../../../lib/gemini";
import { readJsonStorage, writeJsonStorage } from "@/lib/storage";

export type DayPlanScheduleItem = {
  timeBlock: string;
  title: string;
  category: "Study" | "Deep Work" | "Break" | "Personal";
  description: string;
  actionItems?: string[];
  isCalendarEvent?: boolean;
};

export type TopicPracticeQuestion = {
  id?: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type TopicBreakdownItem = {
  topic: string;
  keyConcepts: string[];
  suggestedDurationMinutes: number;
  focusStrategy: string;
  practiceQuestions?: TopicPracticeQuestion[];
};

export type TravelGuideInfo = {
  destination: string;
  suggestedDurationDays: number;
  calendarFitNote: string;
  topAttractions: string[];
  itinerary: Array<{
    dayOrPhase: string;
    activities: string[];
  }>;
  packingChecklist: string[];
};

export type DayPlanRecord = {
  id: string;
  date: string; // YYYY-MM-DD
  mode: "study" | "work" | "travel" | "balanced" | "custom";
  intentions: string;
  targetHours?: number;
  focusMantra: string;
  summary: string;
  schedule: DayPlanScheduleItem[];
  studyGuide?: {
    topicBreakdown: TopicBreakdownItem[];
    focusTips: string[];
  };
  travelGuide?: TravelGuideInfo;
  actionItems: Array<{
    title: string;
    category: string;
    priority: "High" | "Medium" | "Low";
    notes?: string;
  }>;
  createdAt: string;
};

// Helper function to shuffle question options and dynamically re-index correctIndex
function shuffleQuestionOptions(q: TopicPracticeQuestion): TopicPracticeQuestion {
  if (!q.options || q.options.length < 2) return q;

  const cleanOptions = q.options.map((opt) =>
    opt.replace(/^[A-D][\.\)]\s*/i, "").replace(/^[A-D]\s*-\s*/i, "").trim()
  );

  const rawCorrectIdx = typeof q.correctIndex === "number" && q.correctIndex >= 0 && q.correctIndex < cleanOptions.length ? q.correctIndex : 0;
  const correctText = cleanOptions[rawCorrectIdx];

  // Fisher-Yates Shuffle
  const shuffledOptions = [...cleanOptions];
  for (let i = shuffledOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
  }

  let newCorrectIndex = shuffledOptions.indexOf(correctText);
  if (newCorrectIndex === -1) newCorrectIndex = 0;

  return {
    ...q,
    options: shuffledOptions,
    correctIndex: newCorrectIndex
  };
}

async function gatherContext(): Promise<string> {
  let contextStr = "";
  const todayStr = new Date().toISOString().split("T")[0];
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const currentDayOfWeek = dayNames[new Date().getDay()];

  // Aggregate events across ALL LifeOS Calendar sources
  const allCalendarEvents: Array<{ title: string; date: string; category: string; detail?: string }> = [];

  // 1a. LifeOS Calendar Events, Synced Google Calendar & Public Holidays
  try {
    const events = await readJsonStorage<any[]>("calendar", "events.json", []);
    events.forEach((e: any) => {
      if (e.date && e.title) {
        allCalendarEvents.push({
          title: e.title,
          date: e.date,
          category: e.category || "Personal",
          detail: e.description
        });
      }
    });
  } catch {}

  // 1b. Document Expiration & Key Dates (Medical/Doctor Appointments, Renewals)
  try {
    const docs = await readJsonStorage<any[]>("documents", "documents.json", []);
    docs.forEach((d: any) => {
      if (d.analysis?.expiryDate) {
        allCalendarEvents.push({
          title: `Document Expiration: ${d.name}`,
          date: d.analysis.expiryDate,
          category: "Document Expiry",
          detail: `Category: ${d.category}`
        });
      }
      d.analysis?.keyDates?.forEach((kd: any) => {
        if (kd.date && kd.label) {
          allCalendarEvents.push({
            title: `${kd.label} (${d.name})`,
            date: kd.date,
            category: "Key Date / Appointment",
            detail: kd.context
          });
        }
      });
    });
  } catch {}

  // 1c. Rent & Property Due Dates
  try {
    const rentals = await readJsonStorage<any>("rental", "rentals.json", {});
    rentals.properties?.forEach((p: any) => {
      if (p.leaseEnd) {
        allCalendarEvents.push({
          title: `Lease Expiry: ${p.name}`,
          date: p.leaseEnd,
          category: "Rent & Property",
          detail: `Monthly Rent: ₹${p.monthlyRent}`
        });
      }
    });
  } catch {}

  // Filter events for TODAY and UPCOMING WEEK
  const todayEvents = allCalendarEvents.filter((e) => e.date === todayStr);

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split("T")[0];

  const upcomingWeekEvents = allCalendarEvents.filter((e) => e.date > todayStr && e.date <= nextWeekStr);

  contextStr += `LIFEOS CALENDAR INTEGRATION (Today: ${todayStr}, ${currentDayOfWeek}):\n`;
  if (todayEvents.length > 0) {
    contextStr += `🚨 CALENDAR COMMITMENTS & EVENTS SCHEDULED FOR TODAY (${todayEvents.length}):\n`;
    todayEvents.forEach((e) => {
      contextStr += `- ${e.title} (Category: ${e.category}${e.detail ? `, Details: ${e.detail}` : ""})\n`;
    });
    contextStr += `👉 DIRECTIVE: You MUST slot these specific calendar events directly into today's daily time-blocked schedule and set "isCalendarEvent": true!\n\n`;
  } else {
    contextStr += `No fixed calendar commitments logged for today (${todayStr}). Free day window available for study/deep work.\n\n`;
  }

  if (upcomingWeekEvents.length > 0) {
    contextStr += `UPCOMING CALENDAR EVENTS & HOLIDAYS THIS WEEK (${upcomingWeekEvents.length}):\n`;
    upcomingWeekEvents.forEach((e) => {
      contextStr += `- Date: ${e.date} | ${e.title} (${e.category})\n`;
    });
    contextStr += "\n";
  }

  // 2. Pending LifeOS Tasks
  try {
    const tasks = await readJsonStorage<any[]>("tasks", "tasks.json", []);
    const pending = tasks.filter((t: any) => !t.completed);
    if (pending.length > 0) {
      contextStr += `EXISTING PENDING TASKS (${pending.length}):\n`;
      pending.slice(0, 10).forEach((t: any) => {
        contextStr += `- ${t.title} (Priority: ${t.priority}, Category: ${t.category}${t.dueDate ? `, Due: ${t.dueDate}` : ""})\n`;
      });
      contextStr += "\n";
    }
  } catch {}

  // 3. Vault Documents Context
  try {
    const docs = await readJsonStorage<any[]>("documents", "documents.json", []);
    const actionable = docs.filter((d: any) => d.analysis && !d.category?.toLowerCase().includes("resume") && !d.name?.toLowerCase().includes("resume"));
    if (actionable.length > 0) {
      contextStr += `ACTIONABLE LIFE DOCUMENTS IN VAULT:\n`;
      actionable.forEach((d: any) => {
        contextStr += `- ${d.name} (${d.category}): ${d.analysis?.summary || ""}\n`;
      });
      contextStr += "\n";
    }
  } catch {}

  return contextStr;
}

function extractYouTubeUrl(text: string): { url: string; videoId: string } | null {
  const match = text.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11})/i);
  if (match) {
    return { url: match[0], videoId: match[1] };
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mode = "study", targetHours = 6 } = body;
    let intentions = typeof body.intentions === "string" ? body.intentions.trim() : "";

    if (!intentions) {
      intentions = "Plan my day using my LifeOS calendar schedule. If there are no events scheduled on my calendar for today, generate the gold-standard, most popular high-productivity daily schedule used by top performers (Deep Work, Study, Refresh Breaks, and Personal Wellness).";
    }

    // Auto-detect YouTube URL in user intentions prompt
    let youtubeContext = "";
    const ytMatch = extractYouTubeUrl(intentions);
    if (ytMatch) {
      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(ytMatch.url)}&format=json`);
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          youtubeContext = `\n🎥 DETECTED YOUTUBE VIDEO IN USER INTENTIONS:\n- Video Title: "${oembedData.title || "YouTube Video"}"\n- Channel / Author: "${oembedData.author_name || "Unknown"}"\n- Video URL: ${ytMatch.url}\n👉 DIRECTIVE: Incorporate a dedicated video study & analysis session for this YouTube video into today's schedule, and generate a topic breakdown & practice quiz in the studyGuide for it!\n`;
        }
      } catch {}
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not set in .env.local." }, { status: 500 });
    }

    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
    const existingContext = await gatherContext();
    const todayStr = new Date().toISOString().split("T")[0];

    const prompt = `You are the intelligent LifeOS Personal AI Assistant & Daily Productivity Architect.
Today's date: ${todayStr}.
User Planning Mode: ${mode.toUpperCase()} (Target time: ~${targetHours} hours).

User Intentions / Goals for Today:
"${intentions}"
${youtubeContext}

LifeOS Context (Vault documents, pending tasks & LifeOS calendar schedule / holidays):
${existingContext}

INTELLIGENT LIFEOS RULES FOR PLAN GENERATION:
1. CALENDAR EVENT INTEGRATION DIRECTIVE:
   - Check "CALENDAR COMMITMENTS & EVENTS SCHEDULED FOR TODAY" provided in context.
   - IF there are events listed for today, YOU MUST INCLUDE THEM in the daily time-blocked schedule at their scheduled time blocks!
   - Set "isCalendarEvent": true on those schedule items in the JSON output, or prefix title with 'Calendar'.
   - Build Focus Blocks (Deep Work / Study) and Refresh Breaks seamlessly AROUND these calendar events so there are zero double-booking conflicts!

2. GOLD-STANDARD POPULAR DAILY SCHEDULE (WHEN CALENDAR HAS NO EVENTS TODAY):
   - IF "CALENDAR COMMITMENTS & EVENTS SCHEDULED FOR TODAY" has 0 events, generate the most popular, gold-standard high-productivity daily schedule:
     • 08:30 AM - 09:00 AM: 🌅 Morning Kickoff, Priority Planning & Hydration
     • 09:00 AM - 10:30 AM: 💻 Deep Work / Study Focus Sprint 1 (High Cognitive Load Tasks)
     • 10:30 AM - 10:45 AM: ☕ Refresh Break (15-min stretch, eye rest & water)
     • 10:45 AM - 12:15 PM: 📚 Deep Work / Study Focus Sprint 2 (Core Execution & Problem Solving)
     • 12:15 PM - 01:15 PM: 🥗 Healthy Lunch Reset & Mindful Disconnect
     • 01:15 PM - 03:00 PM: ⚡ Afternoon Focus Sprint 3 (Practice Questions, Revision & Application)
     • 03:00 PM - 03:20 PM: 🏃 Mid-Afternoon Movement & Coffee/Tea Reset
     • 03:20 PM - 04:30 PM: 📋 Life Admin, Pending Tasks Sync & Day Recap
     • 05:00 PM onwards: 🌱 Personal Evening Recharge, Fitness & Family Time

3. PRIMARY WORK & STUDY FOCUS WITH STRUCTURED BREAKS:
   - Unless the user explicitly asks for a Travel Guide or Trip Plan, the Daily Planner MUST focus heavily on WORK & STUDY.
   - Structure a clear time-blocked schedule alternating between intense focus blocks (45-90 min for Study / Deep Work) and structured Refresh Breaks (15-min stretch & hydration, lunch reset, eye rest) to maximize productivity.

4. INTELLIGENT TRAVEL GUIDE & TRIP PLANNER WITH LIFEOS CALENDAR INTEGRATION:
   - IF the user asks for a Travel Guide, Trip Plan, Vacation, or Holiday Itinerary (or if Planning Mode is "TRAVEL"):
     a) INSPECT the LifeOS Calendar schedule and holidays provided in context above.
     b) DETERMINE how many days are required for the trip (e.g. 3 Days, 5 Days) based on destination highlights & user's calendar schedule / holidays.
     c) INCLUDE a "travelGuide" object in the JSON output.

5. STRICT DOCUMENT HANDLING RULE:
   - NEVER create tasks to edit, update, or rewrite static records like Resumes, Certificates, Transcripts, or Historical PDFs unless explicitly requested.

6. CRITICAL QUIZ RANDOMIZATION DIRECTIVE:
   - If studyGuide is present, generate AT LEAST 5 multiple-choice questions per topic with correctIndex randomized evenly across 0, 1, 2, and 3 (Options A, B, C, D).

Required JSON Output Schema (strictly output ONLY JSON matching this format):
{
  "focusMantra": "string (Inspiring 1-sentence mantra balancing focus and well-being)",
  "summary": "string (2-sentence summary of main focus and key life admin items)",
  "schedule": [
    {
      "timeBlock": "e.g. 09:00 AM - 10:30 AM",
      "title": "string",
      "category": "Study" | "Deep Work" | "Break" | "Personal",
      "description": "string",
      "isCalendarEvent": boolean (true if this time block comes from a LifeOS calendar commitment/meeting/event),
      "actionItems": ["string"]
    }
  ],
  "studyGuide": {
    "topicBreakdown": [
      {
        "topic": "string",
        "keyConcepts": ["string"],
        "suggestedDurationMinutes": 45,
        "focusStrategy": "string",
        "practiceQuestions": [
          {
            "question": "string (Question 1 of 5)",
            "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
            "correctIndex": 2,
            "explanation": "string"
          }
        ]
      }
    ],
    "focusTips": ["string"]
  },
  "travelGuide": {
    "destination": "string",
    "suggestedDurationDays": 3,
    "calendarFitNote": "string (Details on how many days are required and how it fits with LifeOS calendar schedule and holidays)",
    "topAttractions": ["string"],
    "itinerary": [
      {
        "dayOrPhase": "Day 1: Arrival & Exploration",
        "activities": ["Activity 1", "Activity 2"]
      }
    ],
    "packingChecklist": ["Item 1", "Item 2"]
  },
  "actionItems": [
    {
      "title": "string",
      "category": "Work" | "Personal" | "Bills",
      "priority": "High" | "Medium" | "Low",
      "notes": "string"
    }
  ]
}`;

    const geminiRes = await callGeminiApi({
      prompt,
      apiKey,
      model,
      responseMimeType: "application/json",
      temperature: 0.2
    });

    if (geminiRes.error || !geminiRes.text) {
      return NextResponse.json({ error: geminiRes.error || "Failed to reach Gemini API." }, { status: geminiRes.isRateLimit ? 429 : 500 });
    }

    const textResult = geminiRes.text;

    let cleanJsonStr = textResult.trim();
    if (cleanJsonStr.startsWith("```")) {
      cleanJsonStr = cleanJsonStr.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    }
    const firstBrace = cleanJsonStr.indexOf("{");
    const lastBrace = cleanJsonStr.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanJsonStr = cleanJsonStr.substring(firstBrace, lastBrace + 1);
    }

    let generated: any;
    try {
      generated = JSON.parse(cleanJsonStr);
    } catch (parseErr) {
      return NextResponse.json({ error: "Gemini AI returned invalid JSON structure. Please click Generate again." }, { status: 500 });
    }

    // Process & Shuffle EVERY question to guarantee random distribution across A, B, C, D
    if (generated.studyGuide?.topicBreakdown?.length) {
      generated.studyGuide.topicBreakdown = generated.studyGuide.topicBreakdown.map((t: any) => {
        let qList = t.practiceQuestions || [];
        if (!Array.isArray(qList)) qList = [];

        // Fallback generator if fewer than 5
        while (qList.length < 5) {
          const qNum = qList.length + 1;
          const concept = t.keyConcepts?.[qList.length % (t.keyConcepts?.length || 1)] || t.topic || "this topic";

          const rawFallbackOptions = [
            `Understanding the core principles of ${concept} and applying active recall.`,
            `Ignoring ${concept} until exam day.`,
            `Memorizing definitions without practical problem solving.`,
            `Skipping revision for ${concept}.`
          ];
          // Pick a random correct answer position
          const targetCorrectIdx = Math.floor(Math.random() * 4);

          qList.push({
            question: `Which strategy or concept is essential when mastering ${concept}? (Question ${qNum} of 5)`,
            options: rawFallbackOptions,
            correctIndex: targetCorrectIdx,
            explanation: `Active recall and deep understanding of ${concept} ensures long-term mastery.`
          });
        }

        // Shuffle options and recalculate correctIndex for ALL questions
        const shuffledQuestions = qList.map((q: TopicPracticeQuestion) => shuffleQuestionOptions(q));
        return { ...t, practiceQuestions: shuffledQuestions };
      });
    }

    const planRecord: DayPlanRecord = {
      id: `plan-${Date.now()}`,
      date: todayStr,
      mode,
      intentions: intentions.trim(),
      targetHours: Number(targetHours),
      focusMantra: generated.focusMantra || "Conquer today with focus and purpose.",
      summary: generated.summary || "Here is your customized day schedule.",
      schedule: generated.schedule || [],
      studyGuide: generated.studyGuide || undefined,
      actionItems: generated.actionItems || [],
      createdAt: new Date().toISOString()
    };

    // Save plan
    let plans = await readJsonStorage<DayPlanRecord[]>("planner", "plans.json", []);
    plans = plans.filter((p) => p.date !== todayStr);
    plans.unshift(planRecord);
    await writeJsonStorage("planner", "plans.json", plans);

    return NextResponse.json(planRecord);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to generate day plan: " + (err instanceof Error ? err.message : "Error") },
      { status: 500 }
    );
  }
}
