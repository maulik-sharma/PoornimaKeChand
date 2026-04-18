"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DiagnosticResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState(""); // "rate_limit" | "generic"
  const [retryCountdown, setRetryCountdown] = useState(0);

  useEffect(() => {
    const raw = sessionStorage.getItem("diagnosticResult");
    if (!raw) { router.replace("/"); return; }
    setResult(JSON.parse(raw));
  }, [router]);

  // Countdown timer for rate-limit retry
  useEffect(() => {
    if (retryCountdown <= 0) return;
    const timer = setTimeout(() => setRetryCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [retryCountdown]);

  async function handleGenerateCurriculum() {
    setGenerating(true);
    setError("");
    setErrorType("");
    try {
      const studentId = sessionStorage.getItem("studentId");
      const diagnosticId = sessionStorage.getItem("diagnosticId");

      const res = await fetch("/api/curriculum/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, diagnosticId }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Detect rate-limit (Gemini quota exhausted)
        const isRateLimit =
          res.status === 503 ||
          (data?.error ?? "").toLowerCase().includes("quota") ||
          (data?.error ?? "").toLowerCase().includes("rate");

        setErrorType(isRateLimit ? "rate_limit" : "generic");
        if (isRateLimit) setRetryCountdown(60);
        throw new Error(data?.error ?? "Failed to generate curriculum");
      }

      sessionStorage.setItem("curriculumId", data.curriculumId);
      router.push("/learn");
    } catch (err) {
      if (!errorType) setErrorType("generic");
      setError(err.message || "Could not generate your plan. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  if (!result) return null;

  const abilityPct = Math.round((result.abilityScore ?? 0.5) * 100);
  const level =
    abilityPct >= 75 ? "Advanced" :
    abilityPct >= 50 ? "Intermediate" : "Beginner";

  const levelColor =
    abilityPct >= 75 ? "text-emerald-600 bg-emerald-50" :
    abilityPct >= 50 ? "text-blue-600 bg-blue-50" : "text-orange-600 bg-orange-50";

  return (
    <main className="min-h-dvh bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 px-5 py-8">
      <div className="max-w-md mx-auto space-y-6 animate-in">
        {/* Header */}
        <div className="text-center">
          <div className="text-5xl mb-3">🎯</div>
          <h1 className="font-display text-2xl font-bold text-stone-900">Diagnostic Complete!</h1>
          <p className="text-stone-500 text-sm mt-1">
            {result.questionsAnswered} questions · {result.subject}
          </p>
        </div>

        {/* Ability Score Ring */}
        <div className="card p-6 text-center">
          <div className="relative w-28 h-28 mx-auto mb-4">
            <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="#f3f4f6" strokeWidth="10" />
              <circle
                cx="60" cy="60" r="54" fill="none" stroke="#f97316" strokeWidth="10"
                strokeDasharray={`${2 * Math.PI * 54}`}
                strokeDashoffset={`${2 * Math.PI * 54 * (1 - abilityPct / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-bold text-stone-900">{abilityPct}%</span>
              <span className="text-xs text-stone-500">ability</span>
            </div>
          </div>
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${levelColor}`}>{level}</span>
        </div>

        {/* Gap Map */}
        {result.gapMap && (
          <div className="card p-5 space-y-4">
            <h2 className="font-display font-semibold text-stone-900">Your Knowledge Map</h2>

            {result.gapMap.mastered?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-600 uppercase mb-2">✅ Mastered</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.gapMap.mastered.map((t) => (
                    <span key={t} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {result.gapMap.partial?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-600 uppercase mb-2">🔄 Needs Practice</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.gapMap.partial.map((t) => (
                    <span key={t} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {result.gapMap.gaps?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-600 uppercase mb-2">📚 To Learn</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.gapMap.gaps.map((t) => (
                    <span key={t} className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className={`rounded-xl px-4 py-3 text-sm space-y-2 ${
            errorType === "rate_limit"
              ? "bg-amber-50 border border-amber-200 text-amber-800"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}>
            {errorType === "rate_limit" ? (
              <>
                <p className="font-semibold">⚡ AI is temporarily busy</p>
                <p className="text-xs">
                  The AI provider is rate-limited. Your plan will generate successfully in a moment.
                  {retryCountdown > 0 && (
                    <span className="font-bold"> Retry available in {retryCountdown}s.</span>
                  )}
                </p>
              </>
            ) : (
              <p>{error}</p>
            )}
          </div>
        )}

        <button
          onClick={handleGenerateCurriculum}
          disabled={generating || retryCountdown > 0}
          className="btn-primary w-full text-center"
        >
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Building your 4-week plan...
            </span>
          ) : retryCountdown > 0 ? (
            `Retry in ${retryCountdown}s…`
          ) : error ? (
            "Try Again →"
          ) : (
            "Generate My Study Plan →"
          )}
        </button>

        <p className="text-xs text-stone-400 text-center">
          AI will create a personalized 4-week NCERT-aligned curriculum just for you
        </p>
      </div>
    </main>
  );
}
