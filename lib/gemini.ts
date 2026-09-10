export type GeminiResponse = {
  text: string;
  error?: string;
  isRateLimit?: boolean;
};

/**
 * Robust Gemini API Client with automatic rate-limit backoff retries and fallback models.
 * Handles HTTP 429 and free tier quota limit errors gracefully.
 */
export async function callGeminiApi(options: {
  prompt: string;
  apiKey: string;
  model?: string;
  responseMimeType?: string;
  temperature?: number;
  maxRetries?: number;
}): Promise<GeminiResponse> {
  const {
    prompt,
    apiKey,
    model = process.env.GEMINI_MODEL || "gemini-3.5-flash",
    responseMimeType,
    temperature = 0.2,
    maxRetries = 2
  } = options;

  // Fallback candidate models if primary model hits quota limits
  const fallbackModels = [
    model,
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-3.6-flash",
    "gemini-3.8-flash"
  ].filter((m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx);

  let lastErrorMessage = "";
  let isRateLimitError = false;

  for (const currentModel of fallbackModels) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        // Backoff delay: 1.5s, 3s
        await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      }

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: responseMimeType
                ? { temperature, responseMimeType }
                : { temperature }
            })
          }
        );

        const payload = await response.json();

        if (response.ok) {
          const textResult = payload.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textResult) {
            return { text: textResult };
          }
        }

        const msg: string = payload?.error?.message || "";
        lastErrorMessage = msg || `HTTP ${response.status} error from Gemini API.`;

        // Check if rate limit / quota exceeded error (429 or quota message)
        const isQuotaMsg =
          response.status === 429 ||
          msg.toLowerCase().includes("quota") ||
          msg.toLowerCase().includes("rate limit") ||
          msg.toLowerCase().includes("limit: 20") ||
          msg.toLowerCase().includes("exceeded your current quota");

        if (isQuotaMsg) {
          isRateLimitError = true;
          // Continue loop to retry with backoff or switch to fallback model
        } else {
          // If non-quota error (e.g. invalid API key or bad request), break out of retries for this model
          break;
        }
      } catch (err) {
        lastErrorMessage = err instanceof Error ? err.message : "Network error contacting Gemini API.";
      }
    }
  }

  if (isRateLimitError) {
    return {
      text: "",
      isRateLimit: true,
      error: "Gemini API rate limit reached (Free Tier 20 req/min limit). Please wait ~20-30 seconds and try again, or check your API key quota at ai.google.dev."
    };
  }

  return {
    text: "",
    error: `Gemini API Error: ${lastErrorMessage}`
  };
}
