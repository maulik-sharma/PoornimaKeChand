// @ts-check
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sendSMS, NUDGE_TEMPLATES } from "@/lib/sms/fast2sms";
import { NudgeSendSchema } from "@/lib/utils/validators";

/**
 * POST /api/nudges/send
 * Dispatch a nudge (SMS, push, in-app) to a student or parent.
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const parsed = NudgeSendSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { studentId, type, channel } = parsed.data;

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const appUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/learn`;
    let message = "";

    switch (type) {
      case "return": {
        const latestModule = await prisma.module.findFirst({
          where: { curriculum: { studentId }, status: "in_progress" },
          orderBy: { orderIndex: "asc" },
        });
        message = NUDGE_TEMPLATES.return(student.name, latestModule?.topic ?? "your last topic", appUrl);
        break;
      }
      case "streak": {
        const weekSessions = await prisma.quizAttempt.count({
          where: { studentId, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        });
        message = NUDGE_TEMPLATES.streak7(student.name, weekSessions * 12);
        break;
      }
      case "milestone": {
        const lastCompleted = await prisma.module.findFirst({
          where: { curriculum: { studentId }, status: "completed" },
          orderBy: { completedAt: "desc" },
        });
        const nextModule = await prisma.module.findFirst({
          where: { curriculum: { studentId }, status: "not_started" },
          orderBy: { orderIndex: "asc" },
        });
        const lastAttempt = await prisma.quizAttempt.findFirst({
          where: { studentId, moduleId: lastCompleted?.id },
          orderBy: { createdAt: "desc" },
        });
        message = NUDGE_TEMPLATES.milestone(
          student.name,
          lastCompleted?.topic ?? "a module",
          Math.round(lastAttempt?.score ?? 80),
          nextModule?.topic ?? "the next topic"
        );
        break;
      }
      case "weakness": {
        const weakAttempts = await prisma.quizAttempt.findMany({
          where: { studentId, score: { lt: 50 } },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { module: true },
        });
        message = NUDGE_TEMPLATES.weakness(student.name, weakAttempts[0]?.module?.topic ?? "a challenging topic");
        break;
      }
      case "parent_report": {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const [completedModules, weekAttempts] = await Promise.all([
          prisma.module.count({
            where: { curriculum: { studentId }, status: "completed", completedAt: { gte: oneWeekAgo } },
          }),
          prisma.quizAttempt.findMany({ where: { studentId, createdAt: { gte: oneWeekAgo } } }),
        ]);
        const avgScore =
          weekAttempts.length > 0
            ? Math.round(weekAttempts.reduce((sum, a) => sum + a.score, 0) / weekAttempts.length)
            : 0;
        message = NUDGE_TEMPLATES.parentReport(
          student.name, student.classGrade, completedModules, avgScore, "Mathematics, Science", "Linear Equations"
        );
        break;
      }
      case "exam_countdown": {
        const daysUntilExam = body.daysUntilExam ?? 30;
        const [completedCount, totalCount] = await Promise.all([
          prisma.module.count({ where: { curriculum: { studentId }, status: "completed" } }),
          prisma.module.count({ where: { curriculum: { studentId } } }),
        ]);
        const completedPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        const todayModule = await prisma.module.findFirst({
          where: { curriculum: { studentId }, status: "not_started" },
          orderBy: { orderIndex: "asc" },
        });
        message = NUDGE_TEMPLATES.examCountdown(
          student.name, daysUntilExam, completedPct, todayModule?.topic ?? "your study plan"
        );
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown nudge type" }, { status: 400 });
    }

    let smsResult = null;
    if (channel === "sms") {
      smsResult = await sendSMS({ phone: student.phone, message });
    }

    const nudgeLog = await prisma.nudgeLog.create({
      data: { studentId, type, channel, message },
    });

    return NextResponse.json({
      success: true,
      nudgeLogId: nudgeLog.id,
      message,
      smsRequestId: smsResult?.requestId,
    });
  } catch (err) {
    console.error("[nudges/send] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
