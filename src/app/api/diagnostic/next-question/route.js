// @ts-check
import { NextResponse } from "next/server";
import { redis } from "@/lib/cache/redis";
import { CACHE_KEYS } from "@/lib/cache/keys";
import { NCERT_QUESTIONS } from "@/lib/content/question-bank";
import {
  updateTheta,
  selectNextDifficulty,
  shouldStopDiagnostic,
} from "@/lib/ai/irt";

/**
 * POST /api/diagnostic/next-question
 * Submit an answer, get feedback + next adaptive question.
 */
export async function POST(req) {
  try {
    const { sessionId, questionId, answer, timeTakenMs } = await req.json();

    if (!sessionId || !questionId) {
      return NextResponse.json({ error: "sessionId and questionId required" }, { status: 400 });
    }

    // Load session from Redis
    const session = await redis.get(CACHE_KEYS.diagnosticSession(sessionId));
    if (!session) {
      return NextResponse.json({ error: "Session expired or not found" }, { status: 404 });
    }

    const questions = NCERT_QUESTIONS[session.subject] ?? [];
    const currentQuestion = questions.find((q) => q.id === questionId);

    if (!currentQuestion) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Grade the answer
    const isTimeout = answer === "__timeout__";
    const isSkip = answer === "__skip__";
    const correct =
      !isTimeout &&
      !isSkip &&
      answer.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();

    // Update theta
    const newTheta = isTimeout || isSkip
      ? session.theta * 0.98 // Small penalty for timeout/skip
      : updateTheta(session.theta, correct, currentQuestion.difficulty);

    const newThetaHistory = [...session.thetaHistory, newTheta];
    const newAnswers = [
      ...session.answers,
      {
        topic: currentQuestion.topic,
        subtopic: currentQuestion.subtopic,
        difficulty: currentQuestion.difficulty,
        correct,
        timeTakenMs,
      },
    ];

    // Check if diagnostic should stop
    const stop = shouldStopDiagnostic(
      session.questionCount,
      newThetaHistory,
      20
    );

    if (stop) {
      // Update session with final data
      await redis.set(
        CACHE_KEYS.diagnosticSession(sessionId),
        { ...session, theta: newTheta, thetaHistory: newThetaHistory, answers: newAnswers },
        { ex: 60 * 60 }
      );
      return NextResponse.json({
        status: "complete",
        feedback: {
          correct,
          correctAnswer: currentQuestion.correctAnswer,
          explanation: currentQuestion.explanation,
        },
      });
    }

    // Select next difficulty and question
    const nextDifficulty = selectNextDifficulty(newTheta, correct);
    const availableNext = questions.filter(
      (q) =>
        q.difficulty === nextDifficulty &&
        !session.askedIds.includes(q.id) &&
        q.id !== questionId
    );

    // Fall back to any unasked question if no ideal difficulty available
    const nextQuestion =
      availableNext[Math.floor(Math.random() * availableNext.length)] ??
      questions.find((q) => !session.askedIds.includes(q.id) && q.id !== questionId) ??
      null;

    if (!nextQuestion) {
      // No more questions
      await redis.set(
        CACHE_KEYS.diagnosticSession(sessionId),
        { ...session, theta: newTheta, thetaHistory: newThetaHistory, answers: newAnswers },
        { ex: 60 * 60 }
      );
      return NextResponse.json({
        status: "complete",
        feedback: {
          correct,
          correctAnswer: currentQuestion.correctAnswer,
          explanation: currentQuestion.explanation,
        },
      });
    }

    // Update session
    const updatedSession = {
      ...session,
      theta: newTheta,
      thetaHistory: newThetaHistory,
      answers: newAnswers,
      askedIds: [...session.askedIds, nextQuestion.id],
      questionCount: session.questionCount + 1,
    };
    await redis.set(CACHE_KEYS.diagnosticSession(sessionId), updatedSession, {
      ex: 60 * 60,
    });

    return NextResponse.json({
      status: "continue",
      feedback: {
        correct,
        correctAnswer: currentQuestion.correctAnswer,
        explanation: currentQuestion.explanation,
      },
      nextQuestion: {
        id: nextQuestion.id,
        type: nextQuestion.type,
        question: nextQuestion.question,
        options: nextQuestion.options,
        topic: nextQuestion.topic,
        difficulty: nextQuestion.difficulty,
      },
    });
  } catch (err) {
    console.error("[diagnostic/next-question] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
