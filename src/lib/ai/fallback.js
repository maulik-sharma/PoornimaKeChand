// @ts-check
const { redis } = require("@/lib/cache/redis");
const { CACHE_TTL } = require("@/lib/cache/keys");

/**
 * Try to parse JSON from AI response, stripping markdown fences if present.
 * @param {string} raw
 * @returns {any}
 */
function parseAIJson(raw) {
  if (!raw) return null;
  // Strip markdown code fences
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try finding JSON with regex
    const jsonMatch = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (err2) {
        return null;
      }
    }
    return null;
  }
}

/**
 * Static fallback responses per use case.
 * @type {Record<string, object>}
 */
const STATIC_FALLBACKS = {
  curriculum: {
    weeklyPlan: {
      week1: [],
      week2: [],
      week3: [],
      week4: [],
    },
    totalModules: 0,
    estimatedWeeklyMinutes: 0,
    _fallback: true,
  },
  explanation: {
    title: "Content Loading...",
    hook: "Great question! Let me explain this concept.",
    explanation: "This content is being generated. Please refresh.",
    analogy: "Think of it like water flowing through pipes.",
    workedExample: { problem: "", steps: [], answer: "" },
    formula: null,
    summary: "Please refresh to load content.",
    keyTerms: [],
    _fallback: true,
  },
  quiz: [],
};

/**
 * Call AI with Claude → Gemini → cache → static fallback chain.
 * @param {{ useCase: string, cacheKey: string, systemPrompt: string, userMessage: string }} options
 * @returns {Promise<string>}
 */
async function callWithFallback({ useCase, cacheKey, systemPrompt, userMessage }) {
  // ── 1. Check Redis cache ───────────────────────────────────
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return typeof cached === "string" ? cached : JSON.stringify(cached);
    }
  } catch (_e) {
    console.warn("[fallback] Redis unavailable, skipping cache check");
  }

  // ── 2. Try Claude 3.5 Sonnet ──────────────────────────────
  try {
    const { ChatAnthropic } = require("@langchain/anthropic");
    const claude = new ChatAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      modelName: "claude-haiku-4-5",
      maxTokens: 4096,
      temperature: 0.3,
    });

    const response = await claude.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ]);

    const text = response.content?.toString() ?? "";
    if (text) {
      // Cache the result
      try {
        await redis.set(cacheKey, text, { ex: CACHE_TTL.MODULE_CONTENT });
      } catch (_e) {
        console.warn("[fallback] Failed to cache Claude response");
      }
      return text;
    }
  } catch (claudeErr) {
    console.warn("[fallback] Claude failed, trying Gemini:", claudeErr.message);
  }

  // ── 3. Try Gemini 1.5 Flash ───────────────────────────────
  try {
    const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
    const gemini = new ChatGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      model: "gemini-2.5-flash",
      maxOutputTokens: 4096,
      temperature: 0.3,
    });

    const response = await gemini.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ]);

    const text = response.content?.toString() ?? "";
    if (text) {
      try {
        await redis.set(cacheKey, text, { ex: CACHE_TTL.MODULE_CONTENT });
      } catch (_e) {
        console.warn("[fallback] Failed to cache Gemini response");
      }
      return text;
    }
  } catch (geminiErr) {
    console.warn("[fallback] Gemini also failed:", geminiErr.message);
  }

  // ── 4. Return static fallback ─────────────────────────────
  console.warn(`[fallback] All AI failed for useCase: ${useCase}. Using static fallback.`);
  return JSON.stringify(STATIC_FALLBACKS[useCase] ?? { _fallback: true, error: "AI unavailable" });
}

module.exports = { callWithFallback, parseAIJson };
