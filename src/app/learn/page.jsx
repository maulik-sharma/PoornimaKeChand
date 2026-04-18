"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STATUS_CONFIG = {
  completed: { label: "Completed", color: "text-emerald-600 bg-emerald-50 border-emerald-200", icon: "✅" },
  in_progress: { label: "In Progress", color: "text-blue-600 bg-blue-50 border-blue-200", icon: "🔄" },
  not_started: { label: "Start", color: "text-stone-500 bg-stone-50 border-stone-200", icon: "→" },
};

export default function LearnPage() {
  const router = useRouter();
  const [modules, setModules] = useState([]);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const curriculumId = typeof window !== "undefined" ? sessionStorage.getItem("curriculumId") : null;

  useEffect(() => {
    const studentId = sessionStorage.getItem("studentId");
    if (!studentId) { router.replace("/"); return; }

    // For demo: fetch curriculum from DB via a simple student endpoint
    // In production this would be a dedicated /api/learn endpoint
    setLoading(false);
    setStudent({ name: "Student", streakDays: 3, totalXp: 150 });
    // Modules would be fetched from the curriculum
    setModules([]);
  }, [router]);

  const completedCount = modules.filter((m) => m.status === "completed").length;
  const progressPct = modules.length > 0 ? Math.round((completedCount / modules.length) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-dvh bg-stone-50">
      {/* Top bar */}
      <header className="bg-white border-b border-stone-100 px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎓</span>
          <span className="font-display font-bold text-stone-900">My Curriculum</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1 text-orange-500 font-semibold">
            <span className="streak-fire">🔥</span> {student?.streakDays ?? 0}
          </span>
          <span className="flex items-center gap-1 text-stone-600">
            ⭐ {student?.totalXp ?? 0} XP
          </span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-5">
        {/* Progress overview */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-display font-semibold text-stone-900">4-Week Plan</h2>
              <p className="text-sm text-stone-500">{completedCount} of {modules.length} modules done</p>
            </div>
            <div className="relative w-14 h-14">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="22" fill="none" stroke="#f3f4f6" strokeWidth="5" />
                <circle
                  cx="28" cy="28" r="22" fill="none" stroke="#f97316" strokeWidth="5"
                  strokeDasharray={`${2 * Math.PI * 22}`}
                  strokeDashoffset={`${2 * Math.PI * 22 * (1 - progressPct / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-stone-700">
                {progressPct}%
              </span>
            </div>
          </div>
          <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Module list */}
        {modules.length === 0 ? (
          <div className="card p-8 text-center space-y-3">
            <div className="text-4xl">📚</div>
            <h3 className="font-display font-semibold text-stone-800">No modules yet</h3>
            <p className="text-sm text-stone-500">
              Complete the diagnostic first to generate your personalized curriculum.
            </p>
            <Link href="/" className="btn-primary inline-block mt-2 text-center">
              Start Diagnostic →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {modules.map((module, idx) => {
              const config = STATUS_CONFIG[module.status] ?? STATUS_CONFIG.not_started;
              return (
                <Link
                  key={module.id}
                  href={module.status !== "not_started" || idx === 0 ? `/learn/${module.id}` : "#"}
                  className={`card p-4 flex items-center gap-4 transition-all ${
                    module.status === "not_started" && idx > 0
                      ? "opacity-60 cursor-default"
                      : "hover:shadow-md hover:-translate-y-0.5"
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-orange-50 border-2 border-orange-100
                                  flex items-center justify-center text-sm font-bold text-orange-500 shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-stone-900 text-sm truncate">{module.topic}</p>
                    <p className="text-xs text-stone-500 truncate">{module.subtopic}</p>
                    <p className="text-xs text-stone-400 mt-0.5">~{module.estimatedMins} min</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${config.color}`}>
                    {config.icon} {config.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
