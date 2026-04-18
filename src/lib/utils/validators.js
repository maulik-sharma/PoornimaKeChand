// @ts-check
const { z } = require("zod");

const CurriculumGenerateSchema = z.object({
  studentId: z.string().min(1),
  diagnosticId: z.string().min(1),
});

const QuizGenerateSchema = z.object({
  moduleId: z.string().min(1),
  studentId: z.string().min(1),
  questionCount: z.number().int().min(3).max(20).default(10),
  examMode: z.boolean().default(false),
});

const QuizSubmitSchema = z.object({
  studentId: z.string().min(1),
  moduleId: z.string().min(1),
  answers: z.array(
    z.object({
      questionId: z.string(),
      answer: z.string(),
    })
  ),
  timeTakenSecs: z.number().int().min(0).default(0),
  examMode: z.boolean().default(false),
});

const NudgeSendSchema = z.object({
  studentId: z.string().min(1),
  type: z.enum([
    "return",
    "streak",
    "milestone",
    "weakness",
    "parent_report",
    "exam_countdown",
  ]),
  channel: z.enum(["sms", "push", "in_app"]).default("sms"),
});

const ClassAnalyticsSchema = z.object({
  teacherId: z.string().min(1),
  classGrade: z.number().int().min(6).max(12),
  subject: z.string().min(1),
});

module.exports = {
  CurriculumGenerateSchema,
  QuizGenerateSchema,
  QuizSubmitSchema,
  NudgeSendSchema,
  ClassAnalyticsSchema,
};
