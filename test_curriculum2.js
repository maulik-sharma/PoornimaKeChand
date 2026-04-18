require('dotenv').config();
const { prisma } = require('./src/lib/db/prisma.js');
const { redis } = require('./src/lib/cache/redis.js');
const { CACHE_KEYS } = require('./src/lib/cache/keys.js');
const { callWithFallback, parseAIJson } = require('./src/lib/ai/fallback.js');
const { CurriculumGenerateSchema } = require('./src/lib/utils/validators.js');
const { NCERT_SEQUENCES } = require('./src/lib/content/ncert-sequences.js');

async function main() {
  const student = await prisma.student.findFirst({ orderBy: { createdAt: 'desc' } });
  const diagnostic = await prisma.diagnosticSession.findFirst({
    where: { studentId: student.id },
    orderBy: { completedAt: 'desc' },
  });

  console.log("studentId:", student.id);
  console.log("diagnosticId:", diagnostic.id);
  
  const gapMap = diagnostic.gapMapJson;
  const ncertSequence = NCERT_SEQUENCES[diagnostic.subject]?.[student.classGrade] ?? [];

  const systemPrompt = "You are an expert Indian school curriculum designer. Return ONLY valid JSON.";
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

Generate a 4-week personalized curriculum. Return JSON only with this shape:
{
  "weeklyPlan": {
    "week1": [{ "moduleId": "...", "topic": "...", "subtopic": "...", "difficulty": 3, "estimatedMins": 20, "prerequisites": [] }],
    "week2": [], "week3": [], "week4": []
  },
  "totalModules": 12,
  "estimatedWeeklyMinutes": 90
}
  `.trim();

  const cacheKey = CACHE_KEYS.curriculum(student.id, diagnostic.subject);

  console.log("\n--- Calling AI ---");
  try {
    const rawResponse = await callWithFallback({
      useCase: "curriculum",
      cacheKey,
      systemPrompt,
      userMessage,
    });
    const parsed = parseAIJson(rawResponse);
    console.log("SUCCESS! Modules in week1:", parsed?.weeklyPlan?.week1?.length);
    console.log("Total modules:", [
      ...(parsed?.weeklyPlan?.week1 ?? []),
      ...(parsed?.weeklyPlan?.week2 ?? []),
      ...(parsed?.weeklyPlan?.week3 ?? []),
      ...(parsed?.weeklyPlan?.week4 ?? []),
    ].length);
  } catch (e) {
    console.error("AI CALL FAILED:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
