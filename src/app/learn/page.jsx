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

// ── Demo modules with prerequisite chain ─────────────────────────────────────

const DEMO_MODULES = [
  {
    id: "mod_01", topic: "Linear Equations in Two Variables",
    subtopic: "Solving by Substitution", estimatedMins: 20,
    status: "completed", orderIndex: 0, prerequisites: [],
  },
  {
    id: "mod_02", topic: "Polynomials",
    subtopic: "Types and Degree", estimatedMins: 25,
    status: "in_progress", orderIndex: 1, prerequisites: [{ id: "mod_01" }],
  },
  {
    id: "mod_03", topic: "Coordinate Geometry",
    subtopic: "Plotting Points and Quadrants", estimatedMins: 20,
    status: "not_started", orderIndex: 2, prerequisites: [{ id: "mod_02" }],
  },
  {
    id: "mod_04", topic: "Triangles",
    subtopic: "Congruence Criteria", estimatedMins: 25,
    status: "not_started", orderIndex: 3, prerequisites: [{ id: "mod_03" }],
  },
  {
    id: "mod_05", topic: "Circles",
    subtopic: "Theorems on Angles", estimatedMins: 30,
    status: "not_started", orderIndex: 4,
    prerequisites: [{ id: "mod_03" }, { id: "mod_04" }],
  },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function LearnPage() {
  const router = useRouter();

  // Module state
  const [modules] = useState(DEMO_MODULES);

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

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const sid = sessionStorage.getItem("studentId");
    if (!sid) { router.replace("/"); return; }
    const sub = sessionStorage.getItem("subject") || "maths";
    setStudentId(sid);
    setSubject(sub);
  }, [router]);

  // Auto-start session once IDs are ready
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

  const moduleMap     = new Map(modules.map((m) => [m.id, m]));
  const completedCount = modules.filter((m) => m.status === "completed").length;
  const progressPct   = Math.round((completedCount / modules.length) * 100);

  const visibleMessages = messages.filter((m) => !m.isHidden);
  const lastAssistant   = [...visibleMessages].reverse().find((m) => m.role === "assistant");
  const showConfidence  = lastAssistant && isConfidencePrompt(lastAssistant.content) && !isTyping;

  const srDue = contextData?.srDueCount ?? 0;
  const student = contextData ?? { name: "Student", streakDays: 0, totalXp: 0 };

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
            <p className="text-xs text-stone-400">{completedCount} of {modules.length} modules done</p>
          </div>

          {/* Module cards */}
          <div className="px-3 py-3 space-y-2 flex-1">
            {modules.map((module, idx) => {
              const unlocked = isUnlocked(module, moduleMap);
              const blocking = getBlockingPrereqs(module, moduleMap);
              const displayStatus = !unlocked ? "locked" : module.status;
              const config = STATUS_CONFIG[displayStatus] ?? STATUS_CONFIG.not_started;

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
                  {/* Step circle */}
                  <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                    !unlocked
                      ? "bg-stone-100 border-stone-200 text-stone-400"
                      : "bg-orange-50 border-orange-100 text-orange-500"
                  }`}>
                    {!unlocked ? "🔒" : idx + 1}
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
        </aside>

        {/* ═══════════════════════════════════════════════════════════════════
            RIGHT PANEL — AI Tutor Session
        ═══════════════════════════════════════════════════════════════════════ */}
        <main className="flex-1 flex flex-col overflow-hidden">

          {/* Tab bar (mobile only — shows Plan | Session tabs) */}
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
            <div className="md:hidden flex-1 overflow-y-auto px-4 py-4 space-y-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full" style={{ width: `${progressPct}%` }} />
                </div>
                <span className="text-xs font-bold text-stone-500">{progressPct}%</span>
              </div>
              {modules.map((module, idx) => {
                const unlocked  = isUnlocked(module, moduleMap);
                const blocking  = getBlockingPrereqs(module, moduleMap);
                const displayStatus = !unlocked ? "locked" : module.status;
                const config = STATUS_CONFIG[displayStatus] ?? STATUS_CONFIG.not_started;
                return (
                  <Link
                    key={module.id}
                    href={unlocked ? `/learn/${module.id}` : "#"}
                    aria-disabled={!unlocked}
                    onClick={!unlocked ? (e) => e.preventDefault() : undefined}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                      !unlocked
                        ? "opacity-50 cursor-not-allowed bg-stone-50 border-stone-100"
                        : "bg-white border-stone-100 hover:shadow-sm"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold shrink-0 ${
                      !unlocked ? "bg-stone-100 border-stone-200 text-stone-400" : "bg-orange-50 border-orange-100 text-orange-500"
                    }`}>
                      {!unlocked ? "🔒" : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-stone-900">{module.topic}</p>
                      <p className="text-xs text-stone-500">{module.subtopic}</p>
                      {!unlocked && blocking.length > 0
                        ? <p className="text-xs text-amber-600 mt-0.5">Finish first: {blocking[0]}</p>
                        : <p className="text-xs text-stone-400 mt-0.5">~{module.estimatedMins} min</p>
                      }
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${config.color}`}>
                      {config.icon} {config.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Session panel (always visible on md+; or active tab on mobile) */}
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
