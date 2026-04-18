// @ts-check
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { redis } from "@/lib/cache/redis";
import { CACHE_KEYS } from "@/lib/cache/keys";
import { callWithFallback, parseAIJson } from "@/lib/ai/fallback";
import { CurriculumGenerateSchema } from "@/lib/utils/validators";
import { NCERT_SEQUENCES } from "@/lib/content/ncert-sequences";

/**
 * POST /api/curriculum/generate
 * Generate a personalized 4-week curriculum from a completed diagnostic.
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const parsed = CurriculumGenerateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { studentId, diagnosticId } = parsed.data;

    const [student, diagnostic] = await Promise.all([
      prisma.student.findUnique({ where: { id: studentId } }),
      prisma.diagnosticSession.findUnique({ where: { id: diagnosticId } }),
    ]);

    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
    if (!diagnostic) return NextResponse.json({ error: "Diagnostic session not found" }, { status: 404 });
    if (diagnostic.studentId !== studentId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const cacheKey = CACHE_KEYS.curriculum(studentId, diagnostic.subject);
    const cached = await redis.get(cacheKey);
    if (cached) {
      return NextResponse.json({ curriculum: typeof cached === "string" ? parseAIJson(cached) : cached, cached: true });
    }

    const promptRecord = await prisma.promptRegistry.findFirst({
      where: { name: "curriculum_v1", isActive: true },
    });

    const gapMap = diagnostic.gapMapJson;
    const ncertSequence = NCERT_SEQUENCES[diagnostic.subject]?.[student.classGrade] ?? [];

    const systemPrompt =
      promptRecord?.template ??
      "You are an expert Indian school curriculum designer. Return ONLY valid JSON.";

    const userMessage = `
Student Profile:
- Class: ${student.classGrade}
- Subject: ${diagnostic.subject}
- Language preference: ${student.languagePref}
- Ability score (0=beginner, 1=expert): ${diagnostic.abilityScore.toFixed(2)}
- Mastered topics: ${gapMap.mastered?.join(", ") || "none"}
- Gap topics (not yet learned): ${gapMap.gaps?.join(", ") || "none"}
- Partial topics (needs reinforcement): ${gapMap.partial?.join(", ") || "none"}

NCERT chapter sequence for ${diagnostic.subject} Class ${student.classGrade}:
${ncertSequence.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Generate a 4-week personalized curriculum. Return JSON exactly matching this shape. Distribute topics evenly across all 4 weeks. DO NOT leave any week empty.
{
  "weeklyPlan": {
    "week1": [{ "moduleId": "m1", "topic": "...", "subtopic": "...", "difficulty": 3, "estimatedMins": 20, "prerequisites": [] }],
    "week2": [{ "moduleId": "m2", "topic": "...", "subtopic": "...", "difficulty": 3, "estimatedMins": 20, "prerequisites": ["m1"] }],
    "week3": [{ "moduleId": "m3", "topic": "...", "subtopic": "...", "difficulty": 3, "estimatedMins": 20, "prerequisites": [] }],
    "week4": [{ "moduleId": "m4", "topic": "...", "subtopic": "...", "difficulty": 3, "estimatedMins": 20, "prerequisites": [] }]
  },
  "totalModules": 12,
  "estimatedWeeklyMinutes": 90
}
    `.trim();

    const rawResponse = await callWithFallback({
      useCase: "curriculum",
      cacheKey,
      systemPrompt,
      userMessage,
    });

    const curriculumData = parseAIJson(rawResponse) || {};

    const allModules = [
      ...(curriculumData?.weeklyPlan?.week1 ?? []),
      ...(curriculumData?.weeklyPlan?.week2 ?? []),
      ...(curriculumData?.weeklyPlan?.week3 ?? []),
      ...(curriculumData?.weeklyPlan?.week4 ?? []),
    ];

    if (allModules.length === 0) {
      console.error("[curriculum/generate] AI returned an empty plan — all AI providers may be down or keys are invalid.");
      return NextResponse.json(
        { error: "AI could not generate a study plan. Please check your API keys or try again later." },
        { status: 503 }
      );
    }

    // ── Step 1: Create curriculum + all modules (no prerequisite links yet) ──
    const curriculum = await prisma.curriculum.create({
      data: {
        studentId,
        diagnosticId,
        subject: diagnostic.subject,
        modulesJson: allModules,
        weeklyTargetJson: {
          week1: curriculumData.weeklyPlan?.week1?.map((m) => m.moduleId) ?? [],
          week2: curriculumData.weeklyPlan?.week2?.map((m) => m.moduleId) ?? [],
          week3: curriculumData.weeklyPlan?.week3?.map((m) => m.moduleId) ?? [],
          week4: curriculumData.weeklyPlan?.week4?.map((m) => m.moduleId) ?? [],
        },
        modules: {
          create: allModules.map((m, index) => ({
            topic: m.topic,
            subtopic: m.subtopic,
            classGrade: student.classGrade,
            subject: diagnostic.subject,
            difficulty: m.difficulty ?? 3,
            estimatedMins: m.estimatedMins ?? 20,
            orderIndex: index,
            status: "not_started",
          })),
        },
      },
      include: { modules: { orderBy: { orderIndex: "asc" } } },
    });

    // ── Step 2: Link prerequisites using the AI's moduleId as a stable key ──
    // Build a map from the AI's temp moduleId → real DB id (by orderIndex match)
    const aiIdToDbId = new Map();
    allModules.forEach((aiMod, index) => {
      const dbMod = curriculum.modules[index];
      if (dbMod && aiMod.moduleId) {
        aiIdToDbId.set(aiMod.moduleId, dbMod.id);
      }
    });

    // For every module that has prerequisites listed, link them in the DB
    const prereqUpdates = allModules
      .map((aiMod, index) => {
        const prereqIds = (aiMod.prerequisites ?? [])
          .map((prereqAiId) => aiIdToDbId.get(prereqAiId))
          .filter(Boolean);

        if (prereqIds.length === 0) return null;

        const dbModId = curriculum.modules[index]?.id;
        if (!dbModId) return null;

        return prisma.module.update({
          where: { id: dbModId },
          data: {
            prerequisites: {
              connect: prereqIds.map((id) => ({ id })),
            },
          },
        });
      })
      .filter(Boolean);

    if (prereqUpdates.length > 0) {
      await Promise.all(prereqUpdates);
    }

    return NextResponse.json({
      curriculum: curriculumData,
      curriculumId: curriculum.id,
      totalModules: curriculum.modules.length,
      cached: false,
    });
  } catch (err) {
    console.error("[curriculum/generate] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
