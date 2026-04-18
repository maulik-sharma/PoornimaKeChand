"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ── Prerequisite helpers ──────────────────────────────────────────────────────

function isUnlocked(module, moduleMap) {
  if (!module.prerequisites || module.prerequisites.length === 0) return true;
  return module.prerequisites.every(
    (prereq) => moduleMap.get(prereq.id)?.status === "completed"
  );
}

function getBlockingPrereqs(module, moduleMap) {
  if (!module.prerequisites) return [];
  return module.prerequisites
    .map((p) => moduleMap.get(p.id))
    .filter((p) => p && p.status !== "completed")
    .map((p) => p.topic);
}

// ── Confidence prompt detection ───────────────────────────────────────────────

function isConfidencePrompt(content = "") {
  return /scale of 1.{0,8}3|1 = not sure|how sure are you/i.test(content);
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  completed:   { label: "Completed",   color: "text-emerald-600 bg-emerald-50 border-emerald-200",  icon: "✅" },
  in_progress: { label: "In Progress", color: "text-blue-600 bg-blue-50 border-blue-200",            icon: "🔄" },
  not_started: { label: "Start",       color: "text-stone-500 bg-stone-50 border-stone-200",         icon: "→"  },
  locked:      { label: "Locked",      color: "text-stone-400 bg-stone-50 border-stone-200",         icon: "🔒" },
};

const CONF_CONFIG = [
  { value: "1", label: "Not sure",      emoji: "😬", className: "border-red-300 bg-red-50 text-red-700 hover:bg-red-100" },
  { value: "2", label: "Somewhat sure", emoji: "🤔", className: "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100" },
  { value: "3", label: "Very sure",     emoji: "😎", className: "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
];

// ── Week grouping helper ──────────────────────────────────────────────────────

function groupModulesByWeek(modules, weeklyTargetJson) {
  const modById = new Map(modules.map((m) => [m.id, m]));
  const weeks = {};
  let totalMapped = 0;

  if (weeklyTargetJson && Object.keys(weeklyTargetJson).length > 0) {
    for (const [week, ids] of Object.entries(weeklyTargetJson)) {
      const mapped = (ids || [])
        .map((id) => (typeof id === "string" ? modById.get(id) : null))
        .filter(Boolean);
      
      weeks[week] = mapped;
      totalMapped += mapped.length;
    }
  }

  // If no targets defined, or if the IDs in targets didn't match our modules (common on mismatch)
  // then fallback to automatic even distribution.
  if (totalMapped === 0) {
    return modules.reduce((acc, mod, i) => {
      const week = `week${Math.floor(i / 4) + 1}`;
      if (!acc[week]) acc[week] = [];
      acc[week].push(mod);
      return acc;
    }, {});
  }

  return weeks;
}

// ── Skeleton component ────────────────────────────────────────────────────────

function ModuleSkeleton() {
  return (
    <div className="space-y-2 animate-pulse px-3 py-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-stone-100 bg-stone-50">
          <div className="w-7 h-7 rounded-full bg-stone-200 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-stone-200 rounded-full w-4/5" />
            <div className="h-2.5 bg-stone-100 rounded-full w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LearnPage() {
  const router = useRouter();

  // Curriculum / module state
  const [modules, setModules] = useState([]);
  const [weeklyTarget, setWeeklyTarget] = useState({});
  const [curriculumLoading, setCurriculumLoading] = useState(true);
  const [curriculumError, setCurriculumError] = useState("");

  // Session / tutor state
  const [studentId, setStudentId] = useState(null);
  const [subject, setSubject]     = useState(null);
  const [messages, setMessages]   = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping]   = useState(false);
  const [contextData, setContextData] = useState(null);
  const [sessionStarted, setSessionStarted] = useState(false);

  // Active tab: "session" | "plan"
  const [activeTab, setActiveTab] = useState("session");

  const endRef    = useRef(null);
  const inputRef  = useRef(null);

  // ── Init: load curriculum from DB ─────────────────────────────────────────

  useEffect(() => {
    const sid = sessionStorage.getItem("studentId");
    if (!sid) { router.replace("/"); return; }

    const sub = sessionStorage.getItem("subject") || "maths";
    const curriculumId = sessionStorage.getItem("curriculumId");

    setStudentId(sid);
    setSubject(sub);

    if (!curriculumId) {
      setCurriculumLoading(false);
      setCurriculumError("no_curriculum");
      return;
    }

    fetch(`/api/curriculum/${curriculumId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error || !data.curriculum) {
          setCurriculumError("load_failed");
        } else {
          setModules(data.curriculum.modules ?? []);
          setWeeklyTarget(data.curriculum.weeklyTargetJson ?? {});
        }
      })
      .catch(() => setCurriculumError("load_failed"))
      .finally(() => setCurriculumLoading(false));
  }, [router]);

  // Auto-start AI tutor session once IDs are ready
  useEffect(() => {
    if (studentId && subject && !sessionStarted) {
      setSessionStarted(true);
      sendMessage("Hello! I am ready to start my session today.", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, subject]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (textOverride, hidden = false) => {
      const text = textOverride ?? inputValue;
      if (!text.trim() || !studentId || !subject) return;
      if (!textOverride) setInputValue("");

      setMessages((prev) => [...prev, { role: "user", content: text, isHidden: hidden }]);
      setIsTyping(true);

      try {
        const res = await fetch("/api/tutor/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, subject, message: text }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");

        if (data.studentContext) setContextData(data.studentContext);
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, I'm having trouble connecting right now. Let's try again in a moment." },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [inputValue, studentId, subject]
  );

  function handleConfidenceTap(value) {
    const label = CONF_CONFIG.find((c) => c.value === value)?.label ?? value;
    sendMessage(`My confidence level is ${value} — ${label}.`);
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const moduleMap      = new Map(modules.map((m) => [m.id, m]));
  const completedCount = modules.filter((m) => m.status === "completed").length;
  const progressPct    = modules.length > 0
    ? Math.round((completedCount / modules.length) * 100)
    : 0;

  const weekGroups = groupModulesByWeek(modules, weeklyTarget);

  const visibleMessages = messages.filter((m) => !m.isHidden);
  const lastAssistant   = [...visibleMessages].reverse().find((m) => m.role === "assistant");
  const showConfidence  = lastAssistant && isConfidencePrompt(lastAssistant.content) && !isTyping;

  const srDue  = contextData?.srDueCount ?? 0;
  const student = contextData ?? { name: "Student", streakDays: 0, totalXp: 0 };

  // ── Sidebar module list (shared between desktop sidebar + mobile plan tab) ─

  function ModuleList({ compact = false }) {
    if (curriculumLoading) return <ModuleSkeleton />;

    if (curriculumError === "no_curriculum") {
      return (
        <div className="px-4 py-6 text-center space-y-3">
          <p className="text-3xl">📋</p>
          <p className="text-sm font-semibold text-stone-700">No study plan yet</p>
          <p className="text-xs text-stone-500">Complete the diagnostic to generate your personalized 4-week plan.</p>
          <Link href="/" className="inline-block text-xs font-semibold text-orange-500 hover:text-orange-600 underline">
            Start Diagnostic →
          </Link>
        </div>
      );
    }

    if (curriculumError === "load_failed") {
      return (
        <div className="px-4 py-6 text-center space-y-2">
          <p className="text-sm text-red-500">Failed to load your study plan.</p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-orange-500 underline"
          >
            Try again
          </button>
        </div>
      );
    }

    if (modules.length === 0) {
      return (
        <div className="px-4 py-6 text-center space-y-2">
          <p className="text-sm text-stone-500">Your plan is empty. Please regenerate from the diagnostic results.</p>
        </div>
      );
    }

    return (
      <div className={`${compact ? "px-4 py-4" : "px-3 py-3"} space-y-4`}>
        {Object.entries(weekGroups).map(([week, weekModules]) => {
          if (!weekModules || weekModules.length === 0) return null;
          const weekNum = week.replace("week", "");
          return (
            <div key={week}>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">
                Week {weekNum}
              </p>
              <div className="space-y-2">
                {weekModules.map((module, _idx) => {
                  const unlocked = isUnlocked(module, moduleMap);
                  const blocking = getBlockingPrereqs(module, moduleMap);
                  const displayStatus = !unlocked ? "locked" : module.status;
                  const config = STATUS_CONFIG[displayStatus] ?? STATUS_CONFIG.not_started;
                  const globalIdx = modules.findIndex((m) => m.id === module.id);

                  return (
                    <Link
                      key={module.id}
                      href={unlocked ? `/learn/${module.id}` : "#"}
                      aria-disabled={!unlocked}
                      onClick={!unlocked ? (e) => e.preventDefault() : undefined}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                        !unlocked
                          ? "opacity-50 cursor-not-allowed bg-stone-50 border-stone-100"
                          : "bg-white border-stone-100 hover:border-orange-200 hover:shadow-sm cursor-pointer"
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                        !unlocked
                          ? "bg-stone-100 border-stone-200 text-stone-400"
                          : "bg-orange-50 border-orange-100 text-orange-500"
                      }`}>
                        {!unlocked ? "🔒" : globalIdx + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-stone-900 leading-tight">{module.topic}</p>
                        <p className="text-[11px] text-stone-400 mt-0.5">{module.subtopic}</p>
                        {!unlocked && blocking.length > 0 ? (
                          <p className="text-[10px] text-amber-600 mt-1 font-medium leading-snug">
                            Finish first: {blocking[0]}
                          </p>
                        ) : (
                          <p className="text-[10px] text-stone-400 mt-1">~{module.estimatedMins} min</p>
                        )}
                      </div>

                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0 ${config.color}`}>
                        {config.icon}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-stone-50 flex flex-col">

      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-stone-100 px-5 py-3.5 flex items-center justify-between sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🎓</span>
          <span className="font-display font-bold text-stone-900 text-sm">My Curriculum</span>
          {srDue > 0 && (
            <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
              {srDue} review{srDue !== 1 ? "s" : ""} due
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1 text-orange-500 font-semibold">
            <span className="streak-fire">🔥</span>
            {student.streakDays ?? 0}
          </span>
          <span className="flex items-center gap-1 text-stone-600">
            ⭐ {student.totalXp ?? 0} XP
          </span>
        </div>
      </header>

      {/* ── Body: two-column layout on md+ ──────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ═══════════════════════════════════════════════════════════════════
            LEFT SIDEBAR — Module list (hidden on mobile, shown ≥ md)
        ═══════════════════════════════════════════════════════════════════════ */}
        <aside className="hidden md:flex flex-col w-72 lg:w-80 shrink-0 border-r border-stone-200 bg-white overflow-y-auto">
          <div className="px-4 py-4 border-b border-stone-100">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">4-Week Plan</p>

            {/* Progress bar */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs font-bold text-stone-500 shrink-0">{progressPct}%</span>
            </div>
            {!curriculumLoading && modules.length > 0 && (
              <p className="text-xs text-stone-400">{completedCount} of {modules.length} modules done</p>
            )}
          </div>

          <ModuleList />
        </aside>

        {/* ═══════════════════════════════════════════════════════════════════
            RIGHT PANEL — AI Tutor Session
        ═══════════════════════════════════════════════════════════════════════ */}
        <main className="flex-1 flex flex-col overflow-hidden">

          {/* Tab bar (mobile only) */}
          <div className="md:hidden flex border-b border-stone-200 bg-white shrink-0">
            {(["session", "plan"]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-xs font-semibold capitalize transition-colors ${
                  activeTab === tab
                    ? "text-orange-500 border-b-2 border-orange-500 bg-orange-50/50"
                    : "text-stone-500"
                }`}
              >
                {tab === "session" ? "🤖 Today's Session" : "📚 My Plan"}
              </button>
            ))}
          </div>

          {/* Mobile: plan tab */}
          {activeTab === "plan" && (
            <div className="md:hidden flex-1 overflow-y-auto">
              <div className="flex items-center gap-3 px-4 pt-4 mb-1">
                <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full" style={{ width: `${progressPct}%` }} />
                </div>
                <span className="text-xs font-bold text-stone-500">{progressPct}%</span>
              </div>
              <ModuleList compact />
            </div>
          )}

          {/* Session panel */}
          <div className={`flex-1 flex flex-col overflow-hidden ${activeTab !== "session" ? "hidden md:flex" : "flex"}`}>

            {/* Session sub-header */}
            <div className="bg-white border-b border-stone-100 px-5 py-2.5 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🤖</span>
                <div>
                  <p className="text-xs font-bold text-stone-800">AI Tutor Session</p>
                  {contextData && (
                    <p className="text-[10px] text-stone-400">
                      {contextData.name} · Class {contextData.classGrade} · {contextData.subject}
                    </p>
                  )}
                </div>
              </div>
              <Link
                href="/tutor"
                className="text-[11px] text-stone-500 hover:text-orange-500 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-orange-50 transition-colors"
              >
                Full Session →
              </Link>
            </div>

            {/* ── Chat messages ─────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 space-y-4">

              {/* Spaced repetition banner */}
              {srDue > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
                  <span className="text-lg shrink-0">⏰</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      {srDue} topic{srDue !== 1 ? "s" : ""} due for review today
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Your tutor will review these before introducing new content.
                    </p>
                  </div>
                </div>
              )}

              {visibleMessages.map((msg, i) => {
                const isUser = msg.role === "user";
                return (
                  <div key={i} className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-sm ${
                      isUser
                        ? "bg-gradient-to-br from-stone-600 to-stone-800 text-white"
                        : "bg-gradient-to-br from-orange-400 to-orange-600 text-white"
                    }`}>
                      {isUser ? (contextData?.name?.[0]?.toUpperCase() ?? "S") : "🤖"}
                    </div>

                    {/* Bubble */}
                    <div className={`rounded-2xl px-4 py-3 max-w-[85%] text-sm leading-relaxed
                      prose prose-sm max-w-none
                      prose-p:my-1 prose-ul:my-1 prose-ol:my-1
                      prose-li:my-0.5 prose-headings:my-1.5 prose-code:text-xs
                      ${isUser
                        ? "bg-stone-900 text-white prose-invert rounded-tr-sm"
                        : "bg-white border border-stone-200 shadow-sm text-stone-800 rounded-tl-sm"
                      }`}
                    >
                      <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center shrink-0 text-white text-sm shadow-sm">
                    🤖
                  </div>
                  <div className="bg-white border border-stone-200 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" />
                  </div>
                </div>
              )}

              {/* Empty state */}
              {visibleMessages.length === 0 && !isTyping && (
                <div className="text-center py-12 space-y-3">
                  <div className="text-5xl">🤖</div>
                  <p className="text-stone-400 text-sm">Starting your session…</p>
                </div>
              )}

              <div ref={endRef} className="h-1" />
            </div>

            {/* ── Input footer ───────────────────────────────────────────────── */}
            <footer className="bg-white border-t border-stone-200 px-4 py-3 shrink-0">
              <div className="space-y-2">

                {/* Confidence quick-tap */}
                {showConfidence && (
                  <div className="flex items-center gap-2 animate-in">
                    <span className="text-xs text-stone-500 shrink-0 font-medium">Confidence:</span>
                    {CONF_CONFIG.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => handleConfidenceTap(c.value)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all active:scale-95 ${c.className}`}
                      >
                        <span>{c.emoji}</span>
                        <span className="hidden sm:inline">{c.label}</span>
                        <span className="sm:hidden">{c.value}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Text input */}
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Ask your tutor anything… (Enter to send)"
                    className="flex-1 max-h-28 min-h-[46px] resize-none px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all placeholder:text-stone-400"
                    rows={1}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!inputValue.trim() || isTyping}
                    className="w-[46px] h-[46px] shrink-0 bg-stone-900 text-white rounded-xl flex items-center justify-center hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                    aria-label="Send"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>
                    </svg>
                  </button>
                </div>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
