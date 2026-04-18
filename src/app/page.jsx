"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SUBJECTS = [
  { id: "maths", label: "Mathematics", emoji: "📐" },
  { id: "science", label: "Science", emoji: "🔬" },
  { id: "english", label: "English", emoji: "📖" },
  { id: "social_science", label: "Social Science", emoji: "🌍" },
  { id: "hindi", label: "Hindi", emoji: "📝" },
];

const CLASSES = Array.from({ length: 7 }, (_, i) => i + 6); // 6–12

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [classGrade, setClassGrade] = useState(null);
  const [subject, setSubject] = useState(null);
  const [lang, setLang] = useState("en");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleStart() {
    if (!name.trim() || !classGrade || !subject) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), classGrade, languagePref: lang }),
      });

      if (!res.ok) throw new Error("Failed to create student");
      const { studentId } = await res.json();

      sessionStorage.setItem("studentId", studentId);
      sessionStorage.setItem("subject", subject);

      router.push(`/diagnostic?subject=${subject}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex flex-col">
      {/* Header */}
      <header className="px-6 pt-8 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎓</span>
          <span className="font-display font-bold text-xl text-stone-900">AI Tutor</span>
        </div>
        <p className="text-xs text-stone-500 mt-1 ml-9">Class 6–12 · NCERT · Free</p>
      </header>

      <div className="flex-1 px-6 pb-8 flex flex-col justify-center max-w-md mx-auto w-full">

        {step === 1 && (
          <div className="animate-in space-y-6">
            <div>
              <h1 className="font-display text-3xl font-bold text-stone-900 leading-tight">
                Your personal<br />
                <span className="text-orange-500">AI teacher</span><br />
                is ready. 🚀
              </h1>
              <p className="mt-3 text-stone-600 text-sm leading-relaxed">
                Get a personalized study plan based on YOUR level — not your textbook&apos;s.
                Takes just 5 minutes to set up.
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-stone-700">Your name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900
                           placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 text-base"
                onKeyDown={(e) => e.key === "Enter" && name.trim() && setStep(2)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-stone-700">Language</p>
              <div className="flex gap-2">
                {["en", "hi"].map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      lang === l
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-white text-stone-600 border-stone-200 hover:border-orange-300"
                    }`}
                  >
                    {l === "en" ? "English" : "हिंदी"}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => name.trim() && setStep(2)} disabled={!name.trim()} className="btn-primary w-full">
              Continue →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in space-y-6">
            <div>
              <button onClick={() => setStep(1)} className="text-sm text-stone-500 mb-4 flex items-center gap-1">← Back</button>
              <h2 className="font-display text-2xl font-bold text-stone-900">
                Hi {name}! 👋<br />Which class are you in?
              </h2>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {CLASSES.map((c) => (
                <button
                  key={c}
                  onClick={() => setClassGrade(c)}
                  className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                    classGrade === c
                      ? "bg-orange-500 text-white border-orange-500 scale-105"
                      : "bg-white text-stone-700 border-stone-200 hover:border-orange-300"
                  }`}
                >
                  Class {c}
                </button>
              ))}
            </div>

            <button onClick={() => classGrade && setStep(3)} disabled={!classGrade} className="btn-primary w-full">
              Continue →
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="animate-in space-y-6">
            <div>
              <button onClick={() => setStep(2)} className="text-sm text-stone-500 mb-4 flex items-center gap-1">← Back</button>
              <h2 className="font-display text-2xl font-bold text-stone-900">
                Which subject do you<br />want to start with?
              </h2>
              <p className="text-sm text-stone-500 mt-1">You can add more subjects later</p>
            </div>

            <div className="space-y-2">
              {SUBJECTS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSubject(s.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all text-left ${
                    subject === s.id
                      ? "bg-orange-50 border-orange-500"
                      : "bg-white border-stone-200 hover:border-orange-200"
                  }`}
                >
                  <span className="text-2xl">{s.emoji}</span>
                  <span className="font-medium text-stone-800">{s.label}</span>
                  {subject === s.id && <span className="ml-auto text-orange-500">✓</span>}
                </button>
              ))}
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-lg">{error}</p>
            )}

            <button onClick={handleStart} disabled={!subject || loading} className="btn-primary w-full">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Setting up...
                </span>
              ) : (
                "Start my 5-min diagnostic →"
              )}
            </button>

            <p className="text-xs text-stone-400 text-center">Free forever · No ads · NCERT aligned</p>
          </div>
        )}
      </div>
    </main>
  );
}
