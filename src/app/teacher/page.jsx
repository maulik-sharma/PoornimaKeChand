"use client";

import { useEffect, useState, useCallback } from "react";

const SUBJECTS = ["maths", "science", "english", "social_science", "hindi"];
const CLASSES = [6, 7, 8, 9, 10, 11, 12];

const SEVERITY_CONFIG = {
  high: { color: "bg-red-100 text-red-700 border-red-200", label: "High Risk" },
  medium: { color: "bg-amber-100 text-amber-700 border-amber-200", label: "Needs Attention" },
  low: { color: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Good" },
};

export default function TeacherDashboard() {
  const [teacherId] = useState("teacher_meena_01");
  const [classGrade, setClassGrade] = useState(9);
  const [subject, setSubject] = useState("maths");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/teacher/class-analytics?teacherId=${teacherId}&classGrade=${classGrade}&subject=${subject}`
      );
      if (!res.ok) throw new Error("Failed to fetch analytics");
      setData(await res.json());
    } catch {
      setError("Could not load analytics. Please check the teacher ID.");
    } finally {
      setLoading(false);
    }
  }, [teacherId, classGrade, subject]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  return (
    <main className="min-h-dvh bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-100 px-5 py-4 flex items-center gap-3">
        <span className="text-xl">👩‍🏫</span>
        <h1 className="font-display font-bold text-stone-900">Teacher Dashboard</h1>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">
        {/* Filters */}
        <div className="card p-4 flex gap-3 flex-wrap">
          <select
            value={classGrade}
            onChange={(e) => setClassGrade(Number(e.target.value))}
            className="flex-1 min-w-[100px] px-3 py-2 rounded-xl border border-stone-200 text-sm bg-white focus:ring-2 focus:ring-orange-400 focus:outline-none"
          >
            {CLASSES.map((c) => (
              <option key={c} value={c}>Class {c}</option>
            ))}
          </select>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="flex-1 min-w-[120px] px-3 py-2 rounded-xl border border-stone-200 text-sm bg-white focus:ring-2 focus:ring-orange-400 focus:outline-none"
          >
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
          <button onClick={fetchAnalytics} className="btn-primary text-sm px-4 py-2">Refresh</button>
        </div>

        {error && <p className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {data && !loading && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Students", value: data.totalStudents },
                { label: "Topics Tracked", value: data.heatmap?.length ?? 0 },
                { label: "At Risk", value: data.heatmap?.filter((h) => h.severity === "high").length ?? 0 },
              ].map((stat) => (
                <div key={stat.label} className="card p-4 text-center">
                  <div className="font-display text-2xl font-bold text-stone-900">{stat.value}</div>
                  <div className="text-xs text-stone-500 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Topic Heatmap */}
            {data.heatmap?.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-100">
                  <h2 className="font-display font-semibold text-stone-900">Topic Heatmap</h2>
                  <p className="text-xs text-stone-500 mt-0.5">Sorted by lowest average score</p>
                </div>
                <div className="divide-y divide-stone-100">
                  {data.heatmap.map((row) => {
                    const cfg = SEVERITY_CONFIG[row.severity] ?? SEVERITY_CONFIG.low;
                    return (
                      <div key={row.topic} className="px-5 py-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-stone-900 truncate">{row.topic}</p>
                          <p className="text-xs text-stone-400">{row.totalAttempts} attempts · {row.studentsStruggling} struggling</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-bold text-stone-900">{row.avgScore}%</div>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Student List */}
            {data.studentSummaries?.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-100">
                  <h2 className="font-display font-semibold text-stone-900">Student Progress</h2>
                </div>
                <div className="divide-y divide-stone-100">
                  {data.studentSummaries.map((s) => (
                    <div key={s.studentId} className="px-5 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600 shrink-0">
                        {s.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-900">{s.name}</p>
                        <p className="text-xs text-stone-400">
                          {s.modulesCompleted}/{s.modulesTotal} modules · 🔥 {s.streakDays} days
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-stone-900">{s.avgScore}%</div>
                        <div className="text-xs text-stone-400">avg score</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.heatmap?.length === 0 && data.studentSummaries?.length === 0 && (
              <div className="card p-8 text-center text-stone-500">
                <p className="text-4xl mb-3">📊</p>
                <p>No data yet for Class {data.classGrade} {data.subject}.</p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
