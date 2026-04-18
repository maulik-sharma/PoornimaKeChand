// @ts-check
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.info("🌱 Seeding database...");

  // ── Teacher ──────────────────────────────────────────────
  const teacher = await prisma.teacher.upsert({
    where: { id: "teacher_meena_01" },
    update: {},
    create: {
      id: "teacher_meena_01",
      name: "Ms. Meena Sharma",
      phone: "9876543210",
      school: "Government Higher Secondary School, Jaipur",
    },
  });
  console.info("✅ Created teacher:", teacher.name);

  // ── Student ──────────────────────────────────────────────
  const student = await prisma.student.upsert({
    where: { id: "student_priya_01" },
    update: {},
    create: {
      id: "student_priya_01",
      name: "Priya Sharma",
      phone: "9988776655",
      classGrade: 9,
      languagePref: "en",
      totalXp: 150,
      streakDays: 5,
    },
  });
  console.info("✅ Created student:", student.name);

  // ── Class enrollment ───────────────────────────────────
  await prisma.classEnrollment.upsert({
    where: {
      teacherId_studentId_subject: {
        teacherId: teacher.id,
        studentId: student.id,
        subject: "maths",
      },
    },
    update: {},
    create: {
      teacherId: teacher.id,
      studentId: student.id,
      classGrade: 9,
      subject: "maths",
    },
  });

  // ── Diagnostic Session ────────────────────────────────
  const diagnostic = await prisma.diagnosticSession.upsert({
    where: { id: "diag_priya_01" },
    update: {},
    create: {
      id: "diag_priya_01",
      studentId: student.id,
      subject: "maths",
      abilityScore: 0.62,
      gapMapJson: {
        mastered: ["Integers", "Fractions", "Whole Numbers"],
        gaps: ["Polynomials", "Coordinate Geometry", "Circles"],
        partial: ["Linear Equations in Two Variables", "Statistics", "Triangles"],
      },
      answersJson: [
        { topic: "Fractions", difficulty: 2, correct: true },
        { topic: "Integers", difficulty: 1, correct: true },
        { topic: "Polynomials", difficulty: 3, correct: false },
        { topic: "Coordinate Geometry", difficulty: 3, correct: false },
        { topic: "Linear Equations in Two Variables", difficulty: 2, correct: true },
      ],
    },
  });
  console.info("✅ Created diagnostic session");

  // ── Curriculum ────────────────────────────────────────
  const curriculum = await prisma.curriculum.upsert({
    where: { id: "curr_priya_01" },
    update: {},
    create: {
      id: "curr_priya_01",
      studentId: student.id,
      diagnosticId: diagnostic.id,
      subject: "maths",
      modulesJson: [],
      weeklyTargetJson: {
        week1: ["mod_01", "mod_02"],
        week2: ["mod_03"],
        week3: ["mod_04"],
        week4: ["mod_05"],
      },
      modules: {
        create: [
          {
            id: "mod_01",
            topic: "Linear Equations in Two Variables",
            subtopic: "Solving by Substitution",
            classGrade: 9,
            subject: "maths",
            difficulty: 2,
            estimatedMins: 20,
            orderIndex: 1,
            status: "completed",
            completedAt: new Date(),
          },
          {
            id: "mod_02",
            topic: "Polynomials",
            subtopic: "Types and Degree",
            classGrade: 9,
            subject: "maths",
            difficulty: 3,
            estimatedMins: 25,
            orderIndex: 2,
            status: "in_progress",
          },
          {
            id: "mod_03",
            topic: "Coordinate Geometry",
            subtopic: "Plotting Points and Quadrants",
            classGrade: 9,
            subject: "maths",
            difficulty: 3,
            estimatedMins: 20,
            orderIndex: 3,
            status: "not_started",
          },
          {
            id: "mod_04",
            topic: "Triangles",
            subtopic: "Congruence Criteria",
            classGrade: 9,
            subject: "maths",
            difficulty: 3,
            estimatedMins: 25,
            orderIndex: 4,
            status: "not_started",
          },
          {
            id: "mod_05",
            topic: "Circles",
            subtopic: "Theorems on Angles",
            classGrade: 9,
            subject: "maths",
            difficulty: 4,
            estimatedMins: 30,
            orderIndex: 5,
            status: "not_started",
          },
        ],
      },
    },
  });
  console.info("✅ Created curriculum with 5 modules");

  // ── Quiz Attempt ──────────────────────────────────────
  await prisma.quizAttempt.upsert({
    where: { id: "quiz_01" },
    update: {},
    create: {
      id: "quiz_01",
      studentId: student.id,
      moduleId: "mod_01",
      score: 80,
      timeTakenSecs: 240,
      examMode: false,
      questionsJson: [
        { question: "Solve: x + y = 5, x - y = 1", correctAnswer: "x=3, y=2", isCorrect: true },
      ],
    },
  });

  // ── Spaced Repetition Cards ─────────────────────────
  await prisma.spacedRepetitionCard.upsert({
    where: {
      studentId_topic_subject: {
        studentId: student.id,
        topic: "Linear Equations in Two Variables",
        subject: "maths",
      },
    },
    update: {},
    create: {
      studentId: student.id,
      topic: "Linear Equations in Two Variables",
      subject: "maths",
      ease: 2.6,
      interval: 6,
      repetitions: 2,
      nextReviewAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
    },
  });
  console.info("✅ Created SR cards");

  // ── Prompt Registry ───────────────────────────────────
  const prompts = [
    {
      name: "curriculum_v1",
      template:
        "You are an expert Indian school curriculum designer following NCERT guidelines. Generate a personalized 4-week learning path for the student. Prioritize filling knowledge gaps while reinforcing partial topics. Return ONLY valid JSON matching the WeeklyPlan schema.",
      version: 1,
    },
    {
      name: "explanation_v1",
      template:
        "You are a brilliant and empathetic tutor for Indian government school students (Class 6-12). Explain concepts using relatable Indian analogies, worked examples from daily life, and simple language. Always include a hook that creates curiosity. Return ONLY valid JSON.",
      version: 1,
    },
    {
      name: "quiz_v1",
      template:
        "You are an expert question paper setter for Indian government school exams following NCERT curriculum. Generate diverse, fair questions that test conceptual understanding rather than rote memory. Include MCQ, true/false, and fill-in-the-blank types. Return ONLY a valid JSON array.",
      version: 1,
    },
  ];

  for (const prompt of prompts) {
    await prisma.promptRegistry.upsert({
      where: { name: prompt.name },
      update: { template: prompt.template },
      create: prompt,
    });
  }
  console.info("✅ Created 3 prompt registry entries");

  console.info("\n🎉 Seeding complete!");
  console.info(`   Student: ${student.name} (ID: ${student.id})`);
  console.info(`   Teacher: ${teacher.name} (ID: ${teacher.id})`);
  console.info(`   Diagnostic: ${diagnostic.id}`);
  console.info(`   Curriculum: ${curriculum.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
