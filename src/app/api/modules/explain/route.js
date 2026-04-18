// @ts-check
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { redis } from "@/lib/cache/redis";
import { CACHE_KEYS } from "@/lib/cache/keys";
import { callWithFallback, parseAIJson } from "@/lib/ai/fallback";

/**
 * POST /api/modules/explain
 * Generate or retrieve cached explanation for a module.
 */
export async function POST(req) {
  try {
    const { moduleId, studentId } = await req.json();

    if (!moduleId || !studentId) {
      return NextResponse.json({ error: "moduleId and studentId required" }, { status: 400 });
    }

    const cacheKey = CACHE_KEYS.moduleContent(moduleId);
    const cached = await redis.get(cacheKey);
    if (cached) {
      return NextResponse.json({ content: typeof cached === "string" ? parseAIJson(cached) : cached, cached: true });
    }

    const dbModule = await prisma.module.findUnique({
      where: { id: moduleId },
      include: { curriculum: { include: { student: true } } },
    });

    if (!dbModule) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    if (dbModule.contentJson) {
      return NextResponse.json({ content: dbModule.contentJson, cached: true });
    }

    const student = dbModule.curriculum.student;

    const latestDiagnostic = await prisma.diagnosticSession.findFirst({
      where: { studentId, subject: dbModule.subject },
      orderBy: { completedAt: "desc" },
    });

    const abilityScore = latestDiagnostic?.abilityScore ?? 0.5;

    const promptRecord = await prisma.promptRegistry.findFirst({
      where: { name: "explanation_v1", isActive: true },
    });

    const systemPrompt =
      promptRecord?.template ??
      "You are a brilliant tutor for Indian government school students. Return ONLY valid JSON.";

    const userMessage = `
Generate a concept explanation for:
- Topic: ${dbModule.topic}
- Subtopic: ${dbModule.subtopic}
- Class: ${dbModule.classGrade}
- Subject: ${dbModule.subject}
- Language: ${student.languagePref}
- Student ability (0=beginner, 1=advanced): ${abilityScore.toFixed(2)}

Return JSON only with this shape:
{
  "title": "...",
  "hook": "...",
  "explanation": "...",
  "analogy": "...",
  "workedExample": { "problem": "...", "steps": ["..."], "answer": "..." },
  "formula": "..." or null,
  "summary": "...",
  "keyTerms": [{ "term": "...", "definition": "..." }]
}
    `.trim();

    const rawResponse = await callWithFallback({
      useCase: "explanation",
      cacheKey,
      systemPrompt,
      userMessage,
    });

    const content = parseAIJson(rawResponse);

    await prisma.module.update({
      where: { id: moduleId },
      data: { contentJson: content },
    });

    return NextResponse.json({ content, cached: false });
  } catch (err) {
    console.error("[modules/explain] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
