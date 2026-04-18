// @ts-check
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { redis } from "@/lib/cache/redis";
import { CACHE_KEYS, CACHE_TTL } from "@/lib/cache/keys";
import { NCERT_SEQUENCES } from "@/lib/content/ncert-sequences";

// ── Master Tutor System Prompt Template ─────────────────────────────────────
// All {variable} placeholders are replaced at runtime with real student data.
const TUTOR_SYSTEM_PROMPT = `## Role
You are an adaptive AI tutor for students in Classes 6–12 in India. You communicate in the student's chosen language (Hindi or English). You are warm, patient, and encouraging — never discouraging.

---

## Runtime context (injected by backend before every API call)
- Student name: {student_name}
- Language: {language}  (hindi | english)
- Class/Grade: {grade}
- Subject: {subject}
- Ability level: {theta_score}% (0% = complete beginner, 100% = expert)
- Gap map: {gap_map}  (JSON: each topic tagged "mastered" | "partial" | "gap")
- Knowledge graph path: {prerequisite_chain}  (JSON array: ordered list of prerequisite topics for any "gap" topic, traced back to their root — e.g. ["Class 7: Basics of Algebra", "Class 8: Linear Equations", "Class 9: Quadratic Equations"])
- Spaced repetition queue: {sr_queue}  (JSON: topics due for SM-2 review today, with interval in days)
- Metacognition log: {metacog_log}  (JSON: student's past confidence predictions vs. actual scores per topic)

If any variable above is null or missing, do NOT proceed — tell the student in plain language that their diagnostic is incomplete and ask them to finish it first.

---

## What you already know about this student (Phase 0 — complete)

Phase 0 is done. This means:
1. You have their name, language, grade, and subject from onboarding.
2. They completed a 5-minute adaptive diagnostic (IRT, ~15 questions, 3PL model).
3. You have their ability score and a full gap map of mastered / partial / gap topics.

Use this context from the very first message. Never ask the student to repeat information they already gave during onboarding or the diagnostic.

---

## Core behaviour — always active

### Session opening
Greet the student by name. In 2–3 sentences, summarize: what they are strong in, what needs work, and what today's session will focus on. Keep it motivating.

### Lesson structure (every new concept)
For every new topic you teach, follow this exact 4-step structure:
1. Hook — open with a surprising question or real-world scenario relevant to the student's age and environment (Indian context preferred).
2. Analogy — explain the concept using something the student already knows from everyday life.
3. Worked example — solve one problem step by step, narrating every line of reasoning.
4. Check question — ask one short question to confirm understanding before moving on.

If the student answers the check question incorrectly, re-explain using a DIFFERENT analogy. Never repeat the same explanation word for word.

### 4-week study plan
After the session opening, generate a structured 4-week curriculum based on the gap map:
- Week 1–2: Tackle all "gap" topics (but see Pillar 3 below — fix prerequisites first).
- Week 3: Reinforce "partial" topics with worked examples and practice.
- Week 4: Mixed retrieval practice + preview of next-level concepts.
Each week: list 3–5 daily study goals, each designed for 15–20 minutes.

### Spaced repetition
If sr_queue contains topics due today (SM-2 flag), open the session by reviewing those topics BEFORE introducing new content. Reference the review naturally: "Before we move forward, let's quickly check in on [topic] — it's been [N] days since you last saw it."

---

## Pillar 3 — Knowledge graph ("GPS for learning")

This is the most important diagnostic pillar. Do NOT skip it.

When a student has a "gap" in a topic, consult prerequisite_chain to find the root cause before teaching the gap topic itself.

How to apply it:
1. Look at the first (earliest) topic in prerequisite_chain for each gap topic.
2. If that prerequisite topic is itself marked "gap" or "partial" in gap_map, teach the prerequisite FIRST — even if it is from a lower class/grade.
3. Only teach the harder topic once the foundational gap is repaired.
4. Tell the student why you are doing this, in plain language. Example: "Before we work on Class 9 equations, I noticed you might be shaky on something from Class 7 — let's fix that foundation first. It will make everything else much easier."

Never make the student feel bad about having a lower-grade gap. Frame it as smart, targeted repair — like fixing the foundation before building the roof.

---

## Pillar 6 — Metacognition ("truth mirror")

Before every quiz or check question, ask the student a confidence question:
"On a scale of 1–3, how sure are you that you'll get this right? (1 = not sure, 2 = somewhat sure, 3 = very sure)"

After they answer the quiz/check question, compare their predicted confidence with their actual result:
- If confidence was 3 but answer was wrong: gently show the gap. Say something like: "You felt very confident, but this one tripped you up — that's actually useful data. Let's figure out exactly where the confusion came from."
- If confidence was 1 but answer was correct: celebrate it. "You doubted yourself, but you got it right! Let's make sure that knowledge sticks."
- If confidence matched result: acknowledge it. "Your sense of what you know is well-calibrated — that's a real skill."

Track the pattern across the session. If the student is consistently overconfident in a topic, flag it: "I've noticed you feel confident about [topic] but the answers suggest we should slow down here. That's not a criticism — it's the most useful thing I can tell you."

Never make metacognition feel like punishment. The goal is to teach the student to know exactly what they know and don't know — the most important study skill there is.

---

## Pillar 4 — Feynman technique ("become the teacher")

After every lesson (once the 4-step structure is complete and the check question is answered correctly), trigger a Feynman reversal:

1. Tell the student: "Now I want YOU to teach it back to me. Pretend I am a younger student who has never heard of this. Explain [concept] in your own words — in Hindi or English, whatever feels natural."
2. Evaluate their explanation against 3 criteria:
   a. Core idea — did they capture the main concept?
   b. Reasoning — did they explain WHY, not just WHAT?
   c. Example — did they give an example or analogy of their own?
3. Give specific feedback. Do NOT just say "good job." Say exactly what they got right and what they missed. Example: "Great — you explained what photosynthesis is really clearly. But you didn't mention why the plant needs sunlight specifically. Can you add that part?"
4. Ask them to try again if criterion (b) or (c) is missing. Maximum 2 attempts before you fill in the gap yourself.

Accept explanations in Hindi, English, or Hinglish. Language mixing is fine — prioritize understanding over linguistic purity.

---

## Hard constraints
- Never reference internal variable names ({theta_score}, SM-2, IRT, 3PL) in student-facing messages. Translate everything into plain language.
- Never skip the Hook → Analogy → Worked Example → Check Question structure for new concepts.
- Never repeat an analogy that already failed to help a student understand.
- Never proceed to a harder topic if a prerequisite gap exists in prerequisite_chain.
- Keep all explanations age-appropriate for Class {grade}. A Class 6 student and a Class 12 student need different vocabulary, examples, and depth.
- If the student seems frustrated, pause the curriculum and acknowledge it. Ask: "Should we slow down, or would you like to try a different kind of example?"`;

// ── Context injector ─────────────────────────────────────────────────────────

/**
 * Build the injected system prompt with real student context.
 * @param {object} ctx
 */
function buildSystemPrompt(ctx) {
  const thetaPct = Math.round((ctx.theta ?? 0.5) * 100);

  const gapMapStr = ctx.gapMap
    ? JSON.stringify(ctx.gapMap, null, 2)
    : "No gap map yet — diagnostic incomplete.";

  const prereqChainStr = ctx.prerequisiteChain?.length
    ? JSON.stringify(ctx.prerequisiteChain, null, 2)
    : "No prerequisite data available.";

  const srQueueStr = ctx.srQueue?.length
    ? JSON.stringify(ctx.srQueue, null, 2)
    : "No topics due for review today.";

  const metacogStr = ctx.metacogLog?.length
    ? JSON.stringify(ctx.metacogLog, null, 2)
    : "No metacognition data yet.";

  return TUTOR_SYSTEM_PROMPT
    .replace("{student_name}", ctx.studentName ?? "Student")
    .replace("{language}", ctx.language ?? "english")
    .replace("{grade}", String(ctx.classGrade ?? "?"))
    .replace("{subject}", ctx.subject ?? "?")
    .replace("{theta_score}", String(thetaPct))
    .replace("{gap_map}", gapMapStr)
    .replace("{prerequisite_chain}", prereqChainStr)
    .replace("{sr_queue}", srQueueStr)
    .replace("{metacog_log}", metacogStr)
    // Also replace the one inside the hard-constraints line
    .replace("Class {grade}", `Class ${ctx.classGrade ?? "?"}`);
}

// ── Build prerequisite chain from gap map + NCERT sequences ─────────────────

/**
 * Known prerequisite relationships between subjects and topics across grades.
 * Key = "subject:topic", Value = array of { class, topic } prerequisites.
 * @type {Record<string, { classGrade: number, topic: string }[]>}
 */
const PREREQ_MAP = {
  // Maths
  "maths:Polynomials": [
    { classGrade: 7, topic: "Algebraic Expressions" },
    { classGrade: 8, topic: "Algebraic Expressions and Identities" },
    { classGrade: 8, topic: "Factorisation" },
  ],
  "maths:Coordinate Geometry": [
    { classGrade: 6, topic: "Basic Geometrical Ideas" },
    { classGrade: 8, topic: "Introduction to Graphs" },
  ],
  "maths:Linear Equations in Two Variables": [
    { classGrade: 7, topic: "Simple Equations" },
    { classGrade: 8, topic: "Linear Equations in One Variable" },
  ],
  "maths:Quadratic Equations": [
    { classGrade: 7, topic: "Algebraic Expressions" },
    { classGrade: 8, topic: "Algebraic Expressions and Identities" },
    { classGrade: 9, topic: "Polynomials" },
  ],
  "maths:Circles": [
    { classGrade: 6, topic: "Basic Geometrical Ideas" },
    { classGrade: 7, topic: "The Triangle and its Properties" },
    { classGrade: 7, topic: "Congruence of Triangles" },
  ],
  "maths:Triangles": [
    { classGrade: 6, topic: "Understanding Elementary Shapes" },
    { classGrade: 7, topic: "The Triangle and its Properties" },
    { classGrade: 7, topic: "Congruence of Triangles" },
  ],
  "maths:Statistics": [
    { classGrade: 6, topic: "Data Handling" },
    { classGrade: 7, topic: "Data Handling" },
    { classGrade: 8, topic: "Data Handling" },
  ],
  "maths:Probability": [
    { classGrade: 8, topic: "Data Handling" },
    { classGrade: 9, topic: "Statistics" },
  ],
  "maths:Arithmetic Progressions": [
    { classGrade: 7, topic: "Simple Equations" },
    { classGrade: 9, topic: "Number Systems" },
  ],
  "maths:Introduction to Trigonometry": [
    { classGrade: 7, topic: "The Triangle and its Properties" },
    { classGrade: 9, topic: "Triangles" },
    { classGrade: 9, topic: "Coordinate Geometry" },
  ],
  "maths:Real Numbers": [
    { classGrade: 6, topic: "Knowing Our Numbers" },
    { classGrade: 7, topic: "Rational Numbers" },
    { classGrade: 8, topic: "Rational Numbers" },
  ],
  // Science
  "science:Atoms and Molecules": [
    { classGrade: 8, topic: "Materials: Metals and Non-Metals" },
  ],
  "science:Force and Laws of Motion": [
    { classGrade: 8, topic: "Force and Pressure" },
    { classGrade: 8, topic: "Friction" },
  ],
  "science:Gravitation": [
    { classGrade: 9, topic: "Force and Laws of Motion" },
    { classGrade: 9, topic: "Motion" },
  ],
  "science:Work and Energy": [
    { classGrade: 9, topic: "Force and Laws of Motion" },
    { classGrade: 9, topic: "Motion" },
  ],
};

/**
 * Build a structured prerequisite chain from gap topics, using NCERT sequences
 * and the known prerequisite map above.
 * @param {object} gapMap
 * @param {string} subject
 * @param {number} classGrade
 * @returns {{ gapTopic: string, classGrade: number, prerequisites: string[] }[]}
 */
function buildPrerequisiteChain(gapMap, subject, classGrade) {
  const gaps = gapMap?.gaps ?? [];
  if (!gaps.length) return [];

  return gaps.map((gapTopic) => {
    const key = `${subject}:${gapTopic}`;
    const known = PREREQ_MAP[key];

    if (known) {
      // Use curated prerequisite map
      return {
        gapTopic,
        classGrade,
        prerequisites: known.map((p) => `Class ${p.classGrade}: ${p.topic}`),
      };
    }

    // Heuristic fallback: find topic in prior grades via NCERT_SEQUENCES
    const subjectSequences = NCERT_SEQUENCES[subject] ?? {};
    const prereqs = [];

    for (let grade = classGrade - 1; grade >= 6; grade--) {
      const gradeTopics = subjectSequences[grade] ?? [];
      // Look for thematically adjacent topics (fuzzy keyword match)
      const words = gapTopic.toLowerCase().split(/\s+/);
      const match = gradeTopics.find((t) =>
        words.some((w) => w.length > 3 && t.toLowerCase().includes(w))
      );
      if (match) {
        prereqs.unshift(`Class ${grade}: ${match}`);
        break;
      }
    }

    return {
      gapTopic,
      classGrade,
      prerequisites: prereqs,
    };
  });
}

// ── Build enriched metacognition log ─────────────────────────────────────────

/**
 * Build an enriched metacognition log from quiz attempt history.
 * Since we don't store explicit confidence ratings yet, we derive a proxy
 * from performance consistency: high-score topics the student got wrong
 * suggest overconfidence; low-score topics the student attempted suggest
 * possible underconfidence.
 * @param {any[]} attempts
 * @returns {object[]}
 */
function buildMetacogLog(attempts) {
  if (!attempts.length) return [];

  // Group by topic
  /** @type {Record<string, { scores: number[], topic: string, subject: string }>} */
  const byTopic = {};

  for (const attempt of attempts) {
    const topic = attempt.module?.topic ?? "Unknown";
    const subject = attempt.module?.subject ?? "Unknown";
    if (!byTopic[topic]) {
      byTopic[topic] = { scores: [], topic, subject };
    }
    byTopic[topic].scores.push(attempt.score);
  }

  return Object.values(byTopic).map(({ topic, subject, scores }) => {
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const consistency = scores.length > 1
      ? Math.round(Math.max(...scores) - Math.min(...scores))
      : null;

    // Proxy confidence tier based on average performance
    const inferredConfidence =
      avgScore >= 80 ? "high" : avgScore >= 50 ? "medium" : "low";

    // Flag potential miscalibration: high inferred confidence + high variance
    const possibleOverconfidence =
      inferredConfidence === "high" && consistency !== null && consistency > 30;

    return {
      topic,
      subject,
      avgScore,
      attempts: scores.length,
      inferredConfidenceTier: inferredConfidence,
      scoreConsistency: consistency !== null ? `±${consistency}pts` : "single attempt",
      ...(possibleOverconfidence && {
        calibrationAlert: "High average score but inconsistent — review carefully",
      }),
    };
  });
}

// ── POST /api/tutor/chat ─────────────────────────────────────────────────────

/**
 * POST /api/tutor/chat
 * Body: { studentId, subject, message, resetHistory? }
 */
export async function POST(req) {
  try {
    const { studentId, subject, message, resetHistory } = await req.json();

    if (!studentId || !subject || !message) {
      return NextResponse.json(
        { error: "studentId, subject, and message are required" },
        { status: 400 }
      );
    }

    // ── 1. Load student context from DB ──────────────────────────────────────
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Latest diagnostic for this subject
    const diagnostic = await prisma.diagnosticSession.findFirst({
      where: { studentId, subject },
      orderBy: { completedAt: "desc" },
    });

    // Spaced repetition cards due today
    const now = new Date();
    const srQueue = await prisma.spacedRepetitionCard.findMany({
      where: { studentId, subject, nextReviewAt: { lte: now } },
      orderBy: { nextReviewAt: "asc" },
      take: 5,
    });

    // Recent quiz attempts for metacognition log (last 15)
    const recentAttempts = await prisma.quizAttempt.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { module: { select: { topic: true, subject: true } } },
    });

    const metacogLog = buildMetacogLog(recentAttempts);

    const gapMap = /** @type {any} */ (diagnostic?.gapMapJson) ?? null;
    const prerequisiteChain = gapMap
      ? buildPrerequisiteChain(gapMap, subject, student.classGrade)
      : [];

    const ctx = {
      studentName: student.name,
      language: student.languagePref === "hi" ? "hindi" : "english",
      classGrade: student.classGrade,
      subject,
      theta: diagnostic?.abilityScore ?? null,
      gapMap,
      prerequisiteChain,
      srQueue: srQueue.map((c) => ({
        topic: c.topic,
        daysSinceReview: Math.round(
          (now.getTime() - c.lastReviewAt.getTime()) / (1000 * 60 * 60 * 24)
        ),
        interval: c.interval,
        dueNow: true,
      })),
      metacogLog,
    };

    // ── 2. Load or reset chat history from Redis ──────────────────────────────
    const historyKey = CACHE_KEYS.tutorChat(studentId, subject);
    /** @type {{ role: "user"|"assistant", content: string }[]} */
    let history = [];

    if (!resetHistory) {
      const cached = await redis.get(historyKey);
      if (cached && Array.isArray(cached)) {
        history = cached;
      }
    }

    // ── 3. Append new user message ────────────────────────────────────────────
    history.push({ role: "user", content: message });

    // Keep last 40 turns to avoid context overflow (20 exchanges)
    if (history.length > 40) history = history.slice(-40);

    // ── 4. Call AI (Claude → Gemini fallback) ────────────────────────────────
    const systemPrompt = buildSystemPrompt(ctx);
    let aiReply = "";

    // Try Claude first
    try {
      const { ChatAnthropic } = require("@langchain/anthropic");
      const claude = new ChatAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
        modelName: "claude-3-5-sonnet-20241022",
        maxTokens: 2048,
        temperature: 0.7,
      });

      const messages = [
        { role: "system", content: systemPrompt },
        ...history,
      ];

      const response = await claude.invoke(messages);
      aiReply = response.content?.toString() ?? "";
    } catch (claudeErr) {
      console.warn("[tutor/chat] Claude failed, trying Gemini:", claudeErr.message);

      // Try Gemini
      try {
        const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
        const gemini = new ChatGoogleGenerativeAI({
          apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
          modelName: "gemini-1.5-flash",
          maxOutputTokens: 2048,
          temperature: 0.7,
        });

        const messages = [
          { role: "system", content: systemPrompt },
          ...history,
        ];

        const response = await gemini.invoke(messages);
        aiReply = response.content?.toString() ?? "";
      } catch (geminiErr) {
        console.error("[tutor/chat] Both AI providers failed:", geminiErr.message);
        return NextResponse.json(
          { error: "AI service unavailable. Please try again in a moment." },
          { status: 503 }
        );
      }
    }

    if (!aiReply) {
      return NextResponse.json(
        { error: "AI returned an empty response. Please try again." },
        { status: 503 }
      );
    }

    // ── 5. Persist updated history ────────────────────────────────────────────
    history.push({ role: "assistant", content: aiReply });
    await redis.set(historyKey, history, { ex: CACHE_TTL.TUTOR_CHAT });

    // ── 6. Respond ────────────────────────────────────────────────────────────
    return NextResponse.json({
      reply: aiReply,
      historyLength: history.length,
      studentContext: {
        name: student.name,
        classGrade: student.classGrade,
        subject,
        language: ctx.language,
        abilityPct: Math.round((diagnostic?.abilityScore ?? 0.5) * 100),
        srDueCount: srQueue.length,
        hasGapMap: !!gapMap,
        gapMap,
        metacogTopicCount: metacogLog.length,
      },
    });
  } catch (err) {
    console.error("[tutor/chat] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/tutor/chat?studentId=...&subject=...
 * Reset the chat history for a student/subject pair.
 */
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const subject = searchParams.get("subject");

    if (!studentId || !subject) {
      return NextResponse.json({ error: "studentId and subject required" }, { status: 400 });
    }

    await redis.del(CACHE_KEYS.tutorChat(studentId, subject));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[tutor/chat] DELETE Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
