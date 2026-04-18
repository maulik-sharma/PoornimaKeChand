// @ts-check
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { redis } from "@/lib/cache/redis";
import { CACHE_KEYS } from "@/lib/cache/keys";
import { callWithFallback, parseAIJson } from "@/lib/ai/fallback";
import { QuizGenerateSchema } from "@/lib/utils/validators";
import { v4 as uuidv4 } from "uuid";

/**
 * POST /api/quiz/generate
 * Generate fresh quiz questions for a module.
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const parsed = QuizGenerateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { moduleId, studentId, questionCount, examMode } = parsed.data;

    const dbModule = await prisma.module.findUnique({
      where: { id: moduleId },
      include: { curriculum: true },
    });

    if (!dbModule) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const fingerprintKey = CACHE_KEYS.recentQuizFingerprints(studentId, moduleId);
    const recentFingerprints = (await redis.get(fingerprintKey)) ?? [];

    const promptRecord = await prisma.promptRegistry.findFirst({
      where: { name: "quiz_v1", isActive: true },
    });

    const systemPrompt =
      promptRecord?.template ??
      "You are an expert question paper setter for Indian government school exams. Return ONLY a valid JSON array.";

    const userMessage = `
Generate ${questionCount} quiz questions for:
- Topic: ${dbModule.topic}
- Subtopic: ${dbModule.subtopic}
- Class: ${dbModule.classGrade}
- Subject: ${dbModule.subject}
- Difficulty range: ${examMode ? "3-5" : "2-4"} (1=easiest, 5=hardest)
- Avoid these question fingerprints (already asked recently): ${recentFingerprints.slice(-20).join(", ") || "none"}

Return a JSON array only. Format:
[{
  "id": "q1",
  "type": "mcq",
  "question": "...",
  "options": ["A", "B", "C", "D"],
  "correctAnswer": "A",
  "difficulty": 3,
  "explanation": "...",
  "fingerprint": "unique-topic-subtopic-hash"
}]
    `.trim();

    const cacheKey = `quiz:gen:${moduleId}:${studentId}:${Date.now()}`;

    const rawResponse = await callWithFallback({
      useCase: "quiz",
      cacheKey,
      systemPrompt,
      userMessage,
    });

    let questions = [];
    try {
      const parsed = parseAIJson(rawResponse);
      questions = Array.isArray(parsed) ? parsed : [];
    } catch {
      questions = [];
    }

    questions = questions.map((q) => ({ ...q, id: q.id || uuidv4() }));

    const newFingerprints = [
      ...recentFingerprints,
      ...questions.map((q) => q.fingerprint).filter(Boolean),
    ].slice(-50);

    await redis.set(fingerprintKey, newFingerprints, { ex: 30 * 24 * 60 * 60 });

    return NextResponse.json({
      questions: questions.map((q) => ({
        id: q.id,
        type: q.type,
        question: q.question,
        options: q.options,
        difficulty: q.difficulty,
        // correctAnswer + explanation NOT exposed before submission
      })),
      // Server stores full questions for grading (in production, store in Redis)
      _serverQuestions: questions,
      moduleId,
      examMode,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[quiz/generate] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
