// @ts-check
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { redis } from "@/lib/cache/redis";
import { CACHE_KEYS } from "@/lib/cache/keys";
import { buildGapMap } from "@/lib/ai/irt";

/**
 * POST /api/diagnostic/complete
 * Finalize the diagnostic session, build gap map, save to DB.
 */
export async function POST(req) {
  try {
    const { sessionId, studentId } = await req.json();

    if (!sessionId || !studentId) {
      return NextResponse.json({ error: "sessionId and studentId required" }, { status: 400 });
    }

    const session = await redis.get(CACHE_KEYS.diagnosticSession(sessionId));
    if (!session) {
      return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
    }

    if (session.studentId !== studentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const gapMap = buildGapMap(session.answers);

    const diagnosticSession = await prisma.diagnosticSession.create({
      data: {
        studentId,
        subject: session.subject,
        abilityScore: Math.round(session.theta * 100) / 100,
        gapMapJson: gapMap,
        answersJson: session.answers,
      },
    });

    // Clean up Redis session
    await redis.del(CACHE_KEYS.diagnosticSession(sessionId));

    return NextResponse.json({
      diagnosticId: diagnosticSession.id,
      abilityScore: diagnosticSession.abilityScore,
      gapMap,
      subject: session.subject,
      questionsAnswered: session.answers.length,
    });
  } catch (err) {
    console.error("[diagnostic/complete] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
