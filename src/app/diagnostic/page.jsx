"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const QUESTION_TIME = 30;

export default function DiagnosticPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subject = searchParams.get("subject") ?? "maths";

  const [sessionId, setSessionId] = useState(null);
  const [question, setQuestion] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());

  useEffect(() => {
    const studentId = sessionStorage.getItem("studentId");
    if (!studentId) { router.replace("/"); return; }

    fetch("/api/diagnostic/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, subject }),
    })
      .then((r) => r.json())
      .then((data) => {
        setSessionId(data.sessionId);
        setQuestion(data.firstQuestion);
        setLoading(false);
        setStartTime(Date.now());
      })
      .catch(() => router.replace("/"));
  }, [subject, router]);

  useEffect(() => {
    if (!question || feedback) return;
    setTimeLeft(QUESTION_TIME);
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(interval); handleSubmitAnswer("__timeout__"); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id, !!feedback]);

  const handleSubmitAnswer = useCallback(
    async (answer) => {
      if (!sessionId || !question || submitting) return;
      setSubmitting(true);
      setSelectedAnswer(answer);
      const timeTakenMs = Date.now() - startTime;

      try {
        const res = await fetch("/api/diagnostic/next-question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, questionId: question.id, answer, timeTakenMs }),
        });
        const data = await res.json();
        setFeedback(data.feedback);

        setTimeout(() => {
          if (data.status === "complete") {
            const studentId = sessionStorage.getItem("studentId");
            fetch("/api/diagnostic/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId, studentId }),
            })
              .then((r) => r.json())
              .then((result) => {
                sessionStorage.setItem("diagnosticId", result.diagnosticId);
                sessionStorage.setItem("diagnosticResult", JSON.stringify(result));
                router.push("/diagnostic/results");
              });
          } else {
            setQuestion(data.nextQuestion);
            setQuestionNumber((n) => n + 1);
            setFeedback(null);
            setSelectedAnswer(null);
            setStartTime(Date.now());
          }
          setSubmitting(false);
        }, 1800);
      } catch {
        setSubmitting(false);
      }
    },
    [sessionId, question, submitting, startTime, router]
  );

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-stone-50">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-stone-600 text-sm">Preparing your diagnostic...</p>
        </div>
      </div>
    );
  }

  if (!question) return null;

  const timerPct = (timeLeft / QUESTION_TIME) * 100;
  const timerColor = timeLeft > 15 ? "#10b981" : timeLeft > 7 ? "#f59e0b" : "#ef4444";

  return (
    <div className="question-screen bg-white">
      {/* Header */}
      <div className="px-5 pt-6 pb-3 flex items-center justify-between">
        <div className="text-sm text-stone-500">
          Question <span className="font-semibold text-stone-800">{questionNumber + 1}</span>
          <span className="text-stone-400"> / ~15</span>
        </div>

        {/* Timer */}
        <div className="flex items-center gap-2">
          <div className="relative w-8 h-8">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="14" fill="none" stroke="#e7e5e4" strokeWidth="3" />
              <circle
                cx="16" cy="16" r="14" fill="none"
                stroke={timerColor} strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 14}`}
                strokeDashoffset={`${2 * Math.PI * 14 * (1 - timerPct / 100)}`}
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <span
              className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
              style={{ color: timerColor }}
            >
              {timeLeft}
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-stone-100">
        <div
          className="h-full bg-orange-500 transition-all duration-500"
          style={{ width: `${Math.min(100, ((questionNumber + 1) / 15) * 100)}%` }}
        />
      </div>

      {/* Question */}
      <div className="flex-1 px-5 py-6 space-y-6">
        <div>
          <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">
            {question.topic}
          </span>
          <p className="mt-4 text-lg font-semibold text-stone-900 leading-snug">
            {question.question}
          </p>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {question.options.map((option) => {
            let optionStyle = "bg-white border-stone-200 text-stone-800 hover:border-orange-300 hover:bg-orange-50";
            if (feedback) {
              if (option === feedback.correctAnswer) {
                optionStyle = "bg-emerald-50 border-emerald-500 text-emerald-800";
              } else if (option === selectedAnswer && !feedback.correct) {
                optionStyle = "bg-red-50 border-red-400 text-red-800";
              } else {
                optionStyle = "bg-stone-50 border-stone-200 text-stone-400";
              }
            } else if (selectedAnswer === option) {
              optionStyle = "bg-orange-50 border-orange-500 text-orange-800";
            }

            return (
              <button
                key={option}
                onClick={() => !feedback && !submitting && handleSubmitAnswer(option)}
                disabled={!!feedback || submitting}
                className={`w-full text-left px-4 py-3.5 rounded-xl border-2 font-medium text-sm transition-all duration-200 ${optionStyle}`}
              >
                {option}
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`mt-4 p-4 rounded-xl text-sm animate-in ${
            feedback.correct ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"
          }`}>
            <p className={`font-semibold mb-1 ${feedback.correct ? "text-emerald-700" : "text-red-700"}`}>
              {feedback.correct ? "✓ Correct!" : "✗ Not quite"}
            </p>
            <p className={feedback.correct ? "text-emerald-600" : "text-red-600"}>
              {feedback.explanation}
            </p>
          </div>
        )}
      </div>

      {/* Skip */}
      {!feedback && (
        <div className="px-5 pb-8">
          <button onClick={() => handleSubmitAnswer("__skip__")}
            className="w-full text-stone-400 text-sm py-2 hover:text-stone-600 transition-colors">
            Skip this question
          </button>
        </div>
      )}
    </div>
  );
}
