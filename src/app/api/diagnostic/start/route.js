// @ts-check
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { redis } from "@/lib/cache/redis";
import { CACHE_KEYS } from "@/lib/cache/keys";
import { NCERT_QUESTIONS } from "@/lib/content/question-bank";


/**
 * POST /api/diagnostic/start
 * Initialize a new IRT diagnostic session.
 */
export async function POST(req) {
  try {
    const { studentId, subject } = await req.json();

    if (!studentId || !subject) {
      return NextResponse.json({ error: "studentId and subject required" }, { status: 400 });
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const questions = NCERT_QUESTIONS[subject] ?? [];
    if (questions.length === 0) {
      return NextResponse.json({ error: `No questions available for subject: ${subject}` }, { status: 400 });
    }

    // Start with medium difficulty (difficulty = 2)
    const initialDifficulty = 2;
    const availableQuestions = questions.filter((q) => q.difficulty === initialDifficulty);
    const firstQuestion = availableQuestions[0] ?? questions[0];

    const sessionId = `diag_${studentId}_${Date.now()}`;
    const sessionData = {
      studentId,
      subject,
      theta: 0.5,
      thetaHistory: [0.5],
      askedIds: [firstQuestion.id],
      answers: [],
      questionCount: 1,
    };

    await redis.set(CACHE_KEYS.diagnosticSession(sessionId), sessionData, { ex: 60 * 60 });

    return NextResponse.json({
      sessionId,
      firstQuestion: {
        id: firstQuestion.id,
        type: firstQuestion.type,
        question: firstQuestion.question,
        options: firstQuestion.options,
        topic: firstQuestion.topic,
        difficulty: firstQuestion.difficulty,
      },
    });
  } catch (err) {
    console.error("[diagnostic/start] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
