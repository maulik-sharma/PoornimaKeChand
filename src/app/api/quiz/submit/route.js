// @ts-check
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { QuizSubmitSchema } from "@/lib/utils/validators";
import { processQuizResult, DEFAULT_CARD } from "@/lib/spaced-repetition/scheduler";

/**
 * POST /api/quiz/submit
 * Submit quiz answers, score them, trigger spaced repetition update.
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const parsed = QuizSubmitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { studentId, moduleId, answers, timeTakenSecs, examMode } = parsed.data;

    const dbModule = await prisma.module.findUnique({ where: { id: moduleId } });
    if (!dbModule) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const questionsWithAnswers = body.questionsWithAnswers;
    if (!questionsWithAnswers || !Array.isArray(questionsWithAnswers)) {
      return NextResponse.json(
        { error: "questionsWithAnswers required for grading" },
        { status: 400 }
      );
    }

    const gradedAnswers = answers.map((submission) => {
      const question = questionsWithAnswers.find((q) => q.id === submission.questionId);
      if (!question) return { ...submission, isCorrect: false, explanation: "" };

      const isCorrect =
        submission.answer.trim().toLowerCase() ===
        question.correctAnswer.trim().toLowerCase();

      return {
        questionId: submission.questionId,
        question: question.question,
        type: question.type,
        options: question.options,
        studentAnswer: submission.answer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        explanation: question.explanation,
      };
    });

    const correctCount = gradedAnswers.filter((a) => a.isCorrect).length;
    const score = Math.round((correctCount / gradedAnswers.length) * 100);

    const quizAttempt = await prisma.quizAttempt.create({
      data: {
        studentId,
        moduleId,
        score,
        timeTakenSecs,
        examMode,
        questionsJson: gradedAnswers,
      },
    });

    let xpEarned = 0;
    if (score >= 60 && dbModule.status !== "completed") {
      await prisma.module.update({
        where: { id: moduleId },
        data: { status: "completed", completedAt: new Date() },
      });
      xpEarned = Math.round(score * 0.5) + (examMode ? 20 : 0);
      await prisma.student.update({
        where: { id: studentId },
        data: { totalXp: { increment: xpEarned }, lastActiveAt: new Date() },
      });
    }

    const existingCard = await prisma.spacedRepetitionCard.findUnique({
      where: { studentId_topic_subject: { studentId, topic: dbModule.topic, subject: dbModule.subject } },
    });

    const cardState = existingCard ?? DEFAULT_CARD;
    const srResult = processQuizResult(cardState, score);

    await prisma.spacedRepetitionCard.upsert({
      where: { studentId_topic_subject: { studentId, topic: dbModule.topic, subject: dbModule.subject } },
      update: {
        ease: srResult.ease,
        interval: srResult.interval,
        repetitions: srResult.repetitions,
        nextReviewAt: srResult.nextReviewAt,
        lastReviewAt: new Date(),
      },
      create: {
        studentId,
        topic: dbModule.topic,
        subject: dbModule.subject,
        ease: srResult.ease,
        interval: srResult.interval,
        repetitions: srResult.repetitions,
        nextReviewAt: srResult.nextReviewAt,
        lastReviewAt: new Date(),
      },
    });

    // Insert remedial module if student failed badly
    if (score < 50) {
      const existingRemedial = await prisma.module.findFirst({
        where: { curriculumId: dbModule.curriculumId, topic: dbModule.topic, difficulty: { lt: 3 }, status: "not_started" },
      });
      if (!existingRemedial) {
        await prisma.module.create({
          data: {
            curriculumId: dbModule.curriculumId,
            topic: dbModule.topic,
            subtopic: `${dbModule.topic} — Remedial Practice`,
            classGrade: dbModule.classGrade,
            subject: dbModule.subject,
            difficulty: Math.max(1, 2),
            estimatedMins: 10,
            status: "not_started",
            orderIndex: module.orderIndex - 0.5,
          },
        });
      }
    }

    return NextResponse.json({
      quizAttemptId: quizAttempt.id,
      score,
      correctCount,
      totalQuestions: gradedAnswers.length,
      passed: score >= 60,
      gradedAnswers: examMode ? [] : gradedAnswers,
      nextReviewAt: srResult.nextReviewAt,
      nextReviewInterval: srResult.interval,
      xpEarned,
    });
  } catch (err) {
    console.error("[quiz/submit] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
