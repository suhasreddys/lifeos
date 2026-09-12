import { NextResponse } from "next/server";
import { callGeminiApi } from "../../../../lib/gemini";
import { readJsonStorage } from "@/lib/storage";

export type YouTubeQuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type YouTubeAnalysisResult = {
  id: string;
  youtubeUrl: string;
  videoTitle: string;
  authorName?: string;
  contentType: "study" | "travel" | "general";
  summary: string;

  // Study Mode fields
  studyGuide?: {
    topicBreakdown: Array<{
      topic: string;
      keyConcepts: string[];
      focusStrategy: string;
    }>;
    practiceQuiz: YouTubeQuizQuestion[];
  };

  // Travel Mode fields
  travelGuide?: {
    destination: string;
    overview: string;
    calendarFitNote?: string;
    itinerary: Array<{ dayOrPhase: string; activities: string[] }>;
    topAttractions: string[];
    packingChecklist: string[];
  };

  actionItems: Array<{
    title: string;
    category: string;
    priority: "High" | "Medium" | "Low";
    notes?: string;
  }>;
  createdAt: string;
};

function extractYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

function shuffleQuestionOptions(q: YouTubeQuizQuestion): YouTubeQuizQuestion {
  if (!q.options || q.options.length < 2) return q;

  const cleanOptions = q.options.map((opt) =>
    opt.replace(/^[A-D][\.\)]\s*/i, "").replace(/^[A-D]\s*-\s*/i, "").trim()
  );

  const rawCorrectIdx = typeof q.correctIndex === "number" && q.correctIndex >= 0 && q.correctIndex < cleanOptions.length ? q.correctIndex : 0;
  const correctText = cleanOptions[rawCorrectIdx];

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body as { url: string };

    if (!url || typeof url !== "string" || !url.trim()) {
      return NextResponse.json({ error: "Please enter a YouTube video URL." }, { status: 400 });
    }

    const trimmedUrl = url.trim();
    const videoId = extractYouTubeId(trimmedUrl);
    if (!videoId) {
      return NextResponse.json({ error: "Invalid YouTube URL format. Please paste a valid link (e.g. https://www.youtube.com/watch?v=... or https://youtu.be/...)." }, { status: 400 });
    }

    // 1. Fetch Video Metadata via oEmbed
    let videoTitle = "YouTube Video";
    let authorName = "";
    try {
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(trimmedUrl)}&format=json`);
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        if (oembedData.title) videoTitle = oembedData.title;
        if (oembedData.author_name) authorName = oembedData.author_name;
      }
    } catch {}

    // Gather Calendar & Public Holidays context to recommend specific travel dates and long weekends
    let calendarContext = "";
    try {
      const events = await readJsonStorage<any[]>("calendar", "events.json", []);
      const holidaysAndEvents: string[] = [];
      events.forEach((e) => {
        if (e.title && e.date) {
          holidaysAndEvents.push(`- ${e.date}: ${e.title} (${e.category || "Event"})`);
        }
      });

      if (holidaysAndEvents.length > 0) {
        calendarContext = "UPCOMING USER CALENDAR EVENTS & PUBLIC HOLIDAYS:\n" + 
          holidaysAndEvents.slice(0, 25).join("\n") + "\n\n";
      }
    } catch {}

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is missing in .env.local." }, { status: 500 });
    }

    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

    // 2. Prompt Gemini AI to classify content and generate study guide + quiz or travel itinerary
    const prompt = `You are an expert AI Video Content Analyst for LifeOS.
Analyze this YouTube video:
URL: ${trimmedUrl}
Title: "${videoTitle}"
Author/Channel: "${authorName}"

${calendarContext}
Determine if this video is primarily about:
- "study" (Educational, lectures, coding tutorials, science, history, academic concepts)
- "travel" (Travel guides, vlogs, destination tours, places to visit, trip advice)
- "general" (Productivity, tech reviews, news, entertainment, general topics)

CRITICAL QUIZ DIRECTIVE:
VARY the correctIndex across 0, 1, 2, and 3 (Options A, B, C, D) for the practice quiz. Do NOT put correctIndex as 0 for all questions.

Return a strictly valid JSON response matching this schema:

IF "contentType" IS "study":
{
  "contentType": "study",
  "summary": "2-sentence executive summary of the educational content",
  "studyGuide": {
    "topicBreakdown": [
      {
        "topic": "string (Subject/Concept name)",
        "keyConcepts": ["string (3-4 key concepts)"],
        "focusStrategy": "string (e.g. Active recall, Feynman technique)"
      }
    ],
    "practiceQuiz": [
      {
        "question": "string (Concept test question based on topic - generate AT LEAST 5 distinct practice questions: Q1 to Q5)",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctIndex": 2,
        "explanation": "string (Detailed explanation of why this answer is correct)"
      }
    ]
  },
  "actionItems": [
    {
      "title": "string (Actionable study/revision item)",
      "category": "Work" | "Personal",
      "priority": "High" | "Medium" | "Low",
      "notes": "string"
    }
  ]
}

IF "contentType" IS "travel":
{
  "contentType": "travel",
  "summary": "2-sentence overview of the destination and travel advice",
  "travelGuide": {
    "destination": "string (City/Country/Region name)",
    "overview": "string",
    "calendarFitNote": "string (CROSS-REFERENCE the UPCOMING USER CALENDAR EVENTS & PUBLIC HOLIDAYS provided above. Recommend specific upcoming public holiday dates, long weekend dates, or optimal leave dates from the calendar to visit this destination)",
    "itinerary": [
      {
        "dayOrPhase": "Day 1 / Morning",
        "activities": ["string (Activity / Location)"]
      }
    ],
    "topAttractions": ["string (Must-visit spots)"],
    "packingChecklist": ["string (Essential items to pack or prep)"]
  },
  "actionItems": [
    {
      "title": "string (Travel prep action item)",
      "category": "Personal",
      "priority": "High" | "Medium" | "Low",
      "notes": "string"
    }
  ]
},

IF "contentType" IS "general":
{
  "contentType": "general",
  "summary": "2-sentence summary of the video content",
  "actionItems": [
    {
      "title": "string (Key takeaway action step)",
      "category": "Personal",
      "priority": "Medium",
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

    let parsed: any;
    try {
      parsed = JSON.parse(cleanJsonStr);
    } catch {
      return NextResponse.json({ error: "AI response format error. Please try generating again." }, { status: 500 });
    }

    // Attach quiz IDs if quiz exists, ensure at least 5 questions, and shuffle options
    if (parsed.studyGuide) {
      let qList = parsed.studyGuide.practiceQuiz || [];
      if (!Array.isArray(qList)) qList = [];

      while (qList.length < 5) {
        const qNum = qList.length + 1;
        const targetCorrectIdx = Math.floor(Math.random() * 4);
        qList.push({
          id: `quiz-${qNum}-${Date.now()}`,
          question: `Which core concept from "${videoTitle}" is key for mastering this material? (Question ${qNum} of 5)`,
          options: [
            "Understanding fundamental principles and applying practice problems.",
            "Memorizing terms without understanding the underlying mechanics.",
            "Ignoring video summary notes.",
            "Skipping active recall exercises."
          ],
          correctIndex: targetCorrectIdx,
          explanation: "Active recall and applying concepts in practice leads to reliable understanding."
        });
      }

      parsed.studyGuide.practiceQuiz = qList.map((q: any, idx: number) => {
        const base = {
          ...q,
          id: q.id || `quiz-${idx}-${Date.now()}`
        };
        return shuffleQuestionOptions(base);
      });
    }

    const resultRecord: YouTubeAnalysisResult = {
      id: `yt-${Date.now()}`,
      youtubeUrl: trimmedUrl,
      videoTitle,
      authorName,
      contentType: parsed.contentType || "general",
      summary: parsed.summary || "Summary of YouTube Video",
      studyGuide: parsed.studyGuide || undefined,
      travelGuide: parsed.travelGuide || undefined,
      actionItems: parsed.actionItems || [],
      createdAt: new Date().toISOString()
    };

    return NextResponse.json(resultRecord);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to analyze YouTube video: " + (err instanceof Error ? err.message : "Error") },
      { status: 500 }
    );
  }
}
