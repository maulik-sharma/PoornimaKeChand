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
  let cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // Repair common LLM JSON syntax errors
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1'); // Remove trailing commas
  cleaned = cleaned.replace(/}\s*{/g, '},{');      // Insert missing commas between objects
  cleaned = cleaned.replace(/\]\s*\[/g, '],[');    // Insert missing commas between arrays
  
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try finding JSON with regex
    const jsonMatch = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {
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
      week1: [
        { moduleId: "mod_static_1", topic: "Introductory Concepts", subtopic: "Core Fundamentals", difficulty: 2, estimatedMins: 20 },
        { moduleId: "mod_static_2", topic: "Basic Applications", subtopic: "Real-world Examples", difficulty: 3, estimatedMins: 25, prerequisites: ["mod_static_1"] }
      ],
      week2: [
        { moduleId: "mod_static_3", topic: "Intermediate Formulas", subtopic: "Solving Equations", difficulty: 4, estimatedMins: 30, prerequisites: ["mod_static_2"] }
      ],
      week3: [],
      week4: []
    },
    totalModules: 3,
    estimatedWeeklyMinutes: 45,
    _fallback: true
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
      modelName: "claude-3-5-sonnet-20241022",
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

  // ── 4. Return static fallback (or throw if none defined) ─────────────────
  const fallbackData = STATIC_FALLBACKS[useCase];
  if (fallbackData === null || fallbackData === undefined) {
    throw new Error(`All AI providers failed for useCase: ${useCase}. Please check your API keys or try again later.`);
  }
  console.warn(`[fallback] All AI failed for useCase: ${useCase}. Using static fallback.`);
  return JSON.stringify(fallbackData);
}

module.exports = { callWithFallback, parseAIJson, STATIC_FALLBACKS };
