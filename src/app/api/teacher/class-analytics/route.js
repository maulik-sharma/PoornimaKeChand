// @ts-check
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { redis } from "@/lib/cache/redis";
import { CACHE_KEYS, CACHE_TTL } from "@/lib/cache/keys";
import { ClassAnalyticsSchema } from "@/lib/utils/validators";

/**
 * GET /api/teacher/class-analytics
 * Returns class-level topic heatmap and student progress data.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = ClassAnalyticsSchema.safeParse({
      teacherId: searchParams.get("teacherId"),
      classGrade: Number(searchParams.get("classGrade")),
      subject: searchParams.get("subject"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query params", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { teacherId, classGrade, subject } = parsed.data;

    const cacheKey = CACHE_KEYS.classAnalytics(teacherId, classGrade, subject);
    const cached = await redis.get(cacheKey);
    if (cached) {
      return NextResponse.json({ ...(typeof cached === "object" ? cached : {}), cached: true });
    }

    const enrollments = await prisma.classEnrollment.findMany({
      where: { teacherId, classGrade, subject },
      include: {
        student: {
          include: {
            curricula: {
              where: { subject },
              include: {
                modules: {
                  include: {
                    quizAttempts: { orderBy: { createdAt: "desc" }, take: 3 },
                  },
                },
              },
            },
          },
        },
      },
    });

    const topicStats = {};

    const studentSummaries = enrollments.map(({ student }) => {
      const curriculum = student.curricula[0];
      if (!curriculum) {
        return {
          studentId: student.id, name: student.name,
          modulesCompleted: 0, modulesTotal: 0, avgScore: 0,
          streakDays: student.streakDays, lastActiveAt: student.lastActiveAt,
        };
      }

      let totalScore = 0, attemptCount = 0, modulesCompleted = 0;

      for (const module of curriculum.modules) {
        if (module.status === "completed") modulesCompleted++;
        for (const attempt of module.quizAttempts) {
          totalScore += attempt.score;
          attemptCount++;
          if (!topicStats[module.topic]) {
            topicStats[module.topic] = { totalAttempts: 0, totalScore: 0, studentsStruggling: 0 };
          }
          topicStats[module.topic].totalAttempts++;
          topicStats[module.topic].totalScore += attempt.score;
          if (attempt.score < 60) topicStats[module.topic].studentsStruggling++;
        }
      }

      return {
        studentId: student.id, name: student.name,
        modulesCompleted, modulesTotal: curriculum.modules.length,
        avgScore: attemptCount > 0 ? Math.round(totalScore / attemptCount) : 0,
        streakDays: student.streakDays, lastActiveAt: student.lastActiveAt,
      };
    });

    const heatmap = Object.entries(topicStats)
      .map(([topic, stats]) => ({
        topic,
        avgScore: stats.totalAttempts > 0 ? Math.round(stats.totalScore / stats.totalAttempts) : 100,
        studentsStruggling: stats.studentsStruggling,
        totalAttempts: stats.totalAttempts,
        severity:
          stats.totalScore / (stats.totalAttempts || 1) < 50 ? "high" :
          stats.totalScore / (stats.totalAttempts || 1) < 70 ? "medium" : "low",
      }))
      .sort((a, b) => a.avgScore - b.avgScore);

    const result = {
      classGrade, subject,
      totalStudents: enrollments.length,
      heatmap, studentSummaries,
      generatedAt: new Date().toISOString(),
    };

    await redis.set(cacheKey, result, { ex: CACHE_TTL.CLASS_ANALYTICS });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[teacher/class-analytics] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
