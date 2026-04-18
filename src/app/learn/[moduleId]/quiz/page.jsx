"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function QuizPage() {
  const router = useRouter();
  const params = useParams();
  const moduleId = params.moduleId;

  const [questions, setQuestions] = useState([]);
  const [serverQuestions, setServerQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    const studentId = sessionStorage.getItem("studentId");
    if (!studentId || !moduleId) { router.replace("/learn"); return; }

    fetch("/api/quiz/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleId, studentId, questionCount: 5, examMode: false }),
    })
      .then((r) => r.json())
      .then((data) => {
        setQuestions(data.questions ?? []);
        setServerQuestions(data._serverQuestions ?? []);
        setLoading(false);
      })
      .catch(() => { router.replace(`/learn/${moduleId}`); });
  }, [moduleId, router]);

  function handleSelect(questionId, answer) {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }

  async function handleSubmit() {
    const studentId = sessionStorage.getItem("studentId");
    setSubmitting(true);
    const timeTakenSecs = Math.round((Date.now() - startTime) / 1000);

    const answersArr = Object.entries(answers).map(([questionId, answer]) => ({
      questionId, answer,
    }));

    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          moduleId,
          answers: answersArr,
          timeTakenSecs,
          examMode: false,
          questionsWithAnswers: serverQuestions,
        }),
      });
      const data = await res.json();
      setResult(data);
      setSubmitted(true);
    } catch {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-stone-50">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-stone-500">Generating quiz...</p>
        </div>
      </div>
    );
  }

  if (submitted && result) {
    const passed = result.passed;
    return (
      <main className="min-h-dvh bg-stone-50 px-5 py-8">
        <div className="max-w-lg mx-auto space-y-5 animate-in">
          <div className="text-center">
            <div className="text-5xl mb-3">{passed ? "🎉" : "📚"}</div>
            <h1 className="font-display text-2xl font-bold text-stone-900">
              {passed ? "Great job!" : "Keep practicing!"}
            </h1>
            <p className="text-stone-500 text-sm mt-1">
              {result.correctCount} / {result.totalQuestions} correct
            </p>
          </div>

          {/* Score */}
          <div className="card p-6 text-center">
            <div className="text-4xl font-display font-bold text-stone-900">{result.score}%</div>
            <div className={`mt-2 text-sm font-medium ${passed ? "text-emerald-600" : "text-red-500"}`}>
              {passed ? "✅ Passed" : "❌ Not passed (need 60%)"}
            </div>
            {result.xpEarned > 0 && (
              <div className="mt-2 text-sm text-orange-500 font-semibold">+{result.xpEarned} XP earned!</div>
            )}
            {result.nextReviewAt && (
              <p className="text-xs text-stone-400 mt-2">
                Next review: {new Date(result.nextReviewAt).toLocaleDateString()}
                {" "}(spaced repetition)
              </p>
            )}
          </div>

          {/* Graded answers */}
          {result.gradedAnswers?.length > 0 && (
            <div className="card divide-y divide-stone-100">
              {result.gradedAnswers.map((ga, i) => (
                <div key={i} className="p-4 space-y-1">
                  <p className="text-sm font-semibold text-stone-900">{ga.question}</p>
                  <p className={`text-xs ${ga.isCorrect ? "text-emerald-600" : "text-red-500"}`}>
                    {ga.isCorrect ? "✓ Correct" : `✗ You said: ${ga.studentAnswer}`}
                  </p>
                  {!ga.isCorrect && (
                    <p className="text-xs text-stone-500">Correct: {ga.correctAnswer}</p>
                  )}
                  <p className="text-xs text-stone-400">{ga.explanation}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => router.push("/learn")} className="btn-secondary flex-1">← Back to Plan</button>
            {!passed && (
              <button onClick={() => { setSubmitted(false); setResult(null); setAnswers({}); setCurrentIdx(0); }}
                className="btn-primary flex-1">Try Again</button>
            )}
          </div>
        </div>
      </main>
    );
  }

  const q = questions[currentIdx];
  if (!q) return null;

  return (
    <main className="question-screen bg-white">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-stone-500 text-sm">← Back</button>
        <span className="text-sm text-stone-500">
          {currentIdx + 1} / {questions.length}
        </span>
      </div>

      {/* Progress */}
      <div className="h-1 bg-stone-100">
        <div className="h-full bg-orange-500 transition-all duration-300"
          style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }} />
      </div>

      <div className="flex-1 px-5 py-6 space-y-5">
        <p className="font-semibold text-stone-900 text-lg leading-snug">{q.question}</p>

        <div className="space-y-3">
          {(q.options ?? []).map((option) => {
            const selected = answers[q.id] === option;
            return (
              <button
                key={option}
                onClick={() => handleSelect(q.id, option)}
                className={`w-full text-left px-4 py-3.5 rounded-xl border-2 font-medium text-sm transition-all duration-200 ${
                  selected
                    ? "bg-orange-50 border-orange-500 text-orange-800"
                    : "bg-white border-stone-200 text-stone-800 hover:border-orange-300 hover:bg-orange-50"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="px-5 pb-8 flex gap-3">
        {currentIdx > 0 && (
          <button onClick={() => setCurrentIdx((i) => i - 1)} className="btn-secondary flex-1">← Prev</button>
        )}
        {currentIdx < questions.length - 1 ? (
          <button onClick={() => setCurrentIdx((i) => i + 1)} className="btn-primary flex-1">Next →</button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting || Object.keys(answers).length < questions.length}
            className="btn-primary flex-1"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </span>
            ) : "Submit Quiz →"}
          </button>
        )}
      </div>
    </main>
  );
}
