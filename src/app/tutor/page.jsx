"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return initials from a name string */
function getInitials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

/** Return ability label + colour based on % */
function getAbilityMeta(pct) {
  if (pct >= 75) return { label: "Advanced",      bg: "bg-emerald-100", text: "text-emerald-700", ring: "ring-emerald-400" };
  if (pct >= 50) return { label: "Intermediate",  bg: "bg-blue-100",    text: "text-blue-700",    ring: "ring-blue-400" };
  return            { label: "Beginner",         bg: "bg-amber-100",   text: "text-amber-700",   ring: "ring-amber-400" };
}

/** Detect whether the last assistant message is asking for a 1–3 confidence rating */
function isConfidencePrompt(content = "") {
  return /scale of 1.{0,8}3|1 = not sure|how sure are you/i.test(content);
}

// ── Subject display names ─────────────────────────────────────────────────────
const SUBJECT_LABELS = {
  maths:          "Mathematics",
  science:        "Science",
  english:        "English",
  social_science: "Social Science",
  hindi:          "Hindi",
};

// ── Gap map tag styles ────────────────────────────────────────────────────────
const GAP_STYLES = {
  mastered: { dot: "bg-emerald-500", text: "text-emerald-700", label: "Mastered" },
  partial:  { dot: "bg-amber-400",   text: "text-amber-700",   label: "Needs Practice" },
  gaps:     { dot: "bg-red-400",     text: "text-red-700",     label: "To Learn" },
};

// ── Confidence chip colours ───────────────────────────────────────────────────
const CONF_CONFIG = [
  { value: "1", label: "Not sure", emoji: "😬", className: "border-red-300 bg-red-50 text-red-700 hover:bg-red-100" },
  { value: "2", label: "Somewhat sure", emoji: "🤔", className: "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100" },
  { value: "3", label: "Very sure", emoji: "😎", className: "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function TutorChatPage() {
  const router = useRouter();

  // Session identifiers
  const [studentId, setStudentId] = useState(null);
  const [subject, setSubject] = useState(null);
  const [loadingContext, setLoadingContext] = useState(true);

  // Chat state
  const [messages, setMessages] = useState([]);   // { role, content, isHidden? }
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // Student context (populated on first reply)
  const [contextData, setContextData] = useState(null);

  // UI toggles
  const [showContextPanel, setShowContextPanel] = useState(false);

  const endOfMessagesRef = useRef(null);
  const textareaRef = useRef(null);

  // ── 1. Init Session ──────────────────────────────────────────────────────────
  useEffect(() => {
    const sid = sessionStorage.getItem("studentId");
    const currentStudentId = sid || "student_priya_01"; // fallback to seed data
    const currentSubject = sessionStorage.getItem("subject") || "maths";

    setStudentId(currentStudentId);
    setSubject(currentSubject);
    setLoadingContext(false);
  }, [router]);

  // Auto-start session with a hidden trigger message once IDs are ready
  useEffect(() => {
    if (messages.length === 0 && studentId && subject) {
      handleSend("Hello! I am ready to start my session today.", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, subject]);

  // ── 2. Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // ── 3. Send Message ──────────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (textOverride, hidden = false) => {
      const text = textOverride ?? inputValue;
      if (!text.trim() || !studentId || !subject) return;

      if (!textOverride) setInputValue("");

      // Add user message (hidden ones won't render)
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text, isHidden: hidden },
      ]);
      setIsTyping(true);

      try {
        const res = await fetch("/api/tutor/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, subject, message: text }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to get response");

        if (data.studentContext) setContextData(data.studentContext);

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
      } catch (err) {
        console.error(err);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Sorry, I'm having trouble connecting right now. Let's try again in a moment.",
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [inputValue, studentId, subject]
  );

  // ── 4. Reset Chat ───────────────────────────────────────────────────────────
  async function handleReset() {
    if (!confirm("Are you sure you want to clear this conversation?")) return;
    try {
      await fetch(`/api/tutor/chat?studentId=${studentId}&subject=${subject}`, {
        method: "DELETE",
      });
      setMessages([]);
      handleSend("Hello! I am ready to start fresh.", true);
    } catch (err) {
      console.error(err);
    }
  }

  // ── 5. Confidence quick-tap ──────────────────────────────────────────────────
  function handleConfidenceTap(value) {
    handleSend(`My confidence level is ${value} — ${CONF_CONFIG.find(c => c.value === value)?.label}.`);
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const abilityPct = contextData?.abilityPct ?? null;
  const abilityMeta = abilityPct !== null ? getAbilityMeta(abilityPct) : null;
  const studentInitials = getInitials(contextData?.name ?? "");

  // Check if the last visible assistant message is a confidence prompt
  const visibleMessages = messages.filter((m) => !m.isHidden);
  const lastAssistantMsg = [...visibleMessages].reverse().find((m) => m.role === "assistant");
  const showConfidenceWidget =
    lastAssistantMsg && isConfidencePrompt(lastAssistantMsg.content) && !isTyping;

  // Gap map summary counts
  const gapMap = contextData?.gapMap;
  const gapSummary = gapMap
    ? {
        mastered: (gapMap.mastered ?? []).length,
        partial:  (gapMap.partial ?? []).length,
        gaps:     (gapMap.gaps ?? []).length,
      }
    : null;

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loadingContext) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-dvh flex flex-col bg-stone-50">

      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back */}
          <Link
            href="/learn"
            className="text-stone-400 hover:text-stone-600 transition-colors shrink-0"
            aria-label="Back to curriculum"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </Link>

          {/* Avatar */}
          <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full
                          flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
            🤖
          </div>

          {/* Name + context */}
          <div className="min-w-0">
            <h1 className="font-display font-bold text-stone-900 text-sm leading-tight truncate">
              AI Tutor
            </h1>
            {contextData ? (
              <p className="text-[11px] text-stone-500 font-medium flex items-center gap-1.5 flex-wrap">
                <span className="text-orange-500 font-semibold">{contextData.name}</span>
                <span className="text-stone-300">·</span>
                <span>Class {contextData.classGrade}</span>
                <span className="text-stone-300">·</span>
                <span>{SUBJECT_LABELS[contextData.subject] ?? contextData.subject}</span>
                {abilityMeta && (
                  <>
                    <span className="text-stone-300">·</span>
                    <span className={`font-semibold ${abilityMeta.text}`}>
                      {abilityPct}% · {abilityMeta.label}
                    </span>
                  </>
                )}
              </p>
            ) : (
              <p className="text-[11px] text-stone-400">Starting session…</p>
            )}
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Context panel toggle */}
          {contextData && (
            <button
              onClick={() => setShowContextPanel((v) => !v)}
              className={`p-1.5 rounded-lg text-stone-500 transition-colors ${
                showContextPanel ? "bg-orange-50 text-orange-500" : "hover:bg-stone-100"
              }`}
              aria-label="Toggle student context panel"
              title="View your progress snapshot"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </button>
          )}

          {/* SR badge */}
          {contextData?.srDueCount > 0 && (
            <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
              {contextData.srDueCount} review{contextData.srDueCount !== 1 ? "s" : ""} due
            </span>
          )}

          {/* Reset */}
          <button
            onClick={handleReset}
            className="text-xs text-stone-500 hover:text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-md transition-colors"
          >
            Reset
          </button>
        </div>
      </header>

      {/* ── Context Panel (collapsible) ─────────────────────────────────────── */}
      {showContextPanel && contextData && (
        <div className="bg-white border-b border-stone-200 px-5 py-4 shrink-0 animate-in">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">
              Your Progress Snapshot
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

              {/* Ability ring */}
              <div className={`rounded-xl p-3 text-center ${abilityMeta?.bg}`}>
                <p className="text-2xl font-display font-bold text-stone-800">{abilityPct}%</p>
                <p className={`text-xs font-semibold mt-0.5 ${abilityMeta?.text}`}>{abilityMeta?.label}</p>
                <p className="text-[10px] text-stone-500 mt-0.5">ability level</p>
              </div>

              {/* Mastered */}
              {gapSummary && (
                <div className="rounded-xl bg-emerald-50 p-3 text-center">
                  <p className="text-2xl font-display font-bold text-emerald-700">{gapSummary.mastered}</p>
                  <p className="text-xs font-semibold text-emerald-600 mt-0.5">✅ Mastered</p>
                  <p className="text-[10px] text-stone-500 mt-0.5">topics</p>
                </div>
              )}

              {/* Needs practice */}
              {gapSummary && (
                <div className="rounded-xl bg-amber-50 p-3 text-center">
                  <p className="text-2xl font-display font-bold text-amber-700">{gapSummary.partial}</p>
                  <p className="text-xs font-semibold text-amber-600 mt-0.5">🔄 Needs Practice</p>
                  <p className="text-[10px] text-stone-500 mt-0.5">topics</p>
                </div>
              )}

              {/* Gaps */}
              {gapSummary && (
                <div className="rounded-xl bg-red-50 p-3 text-center">
                  <p className="text-2xl font-display font-bold text-red-600">{gapSummary.gaps}</p>
                  <p className="text-xs font-semibold text-red-500 mt-0.5">📚 To Learn</p>
                  <p className="text-[10px] text-stone-500 mt-0.5">topics</p>
                </div>
              )}
            </div>

            {/* Topic chips */}
            {gapMap && (
              <div className="mt-3 space-y-2">
                {(["mastered", "partial", "gaps"]).map((key) => {
                  const items = gapMap[key] ?? [];
                  if (!items.length) return null;
                  const style = GAP_STYLES[key];
                  return (
                    <div key={key} className="flex flex-wrap gap-1.5 items-center">
                      <span className={`text-[10px] font-bold uppercase tracking-wide ${style.text} w-20 shrink-0`}>
                        {style.label}
                      </span>
                      {items.map((t) => (
                        <span key={t}
                          className={`text-[11px] px-2 py-0.5 rounded-full border font-medium
                            ${key === "mastered" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : key === "partial"  ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-red-50 text-red-700 border-red-200"}`}>
                          {t}
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Chat Area ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="max-w-3xl mx-auto space-y-5">

          {visibleMessages.map((msg, i) => {
            const isUser = msg.role === "user";

            return (
              <div
                key={i}
                className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0
                    text-xs font-bold shadow-sm
                    ${isUser
                      ? "bg-gradient-to-br from-stone-600 to-stone-800 text-white"
                      : "bg-gradient-to-br from-orange-400 to-orange-600 text-white"
                    }`}
                >
                  {isUser ? (studentInitials || "U") : "🤖"}
                </div>

                {/* Bubble */}
                <div
                  className={`rounded-2xl px-5 py-3.5 max-w-[85%] text-sm leading-relaxed
                    prose prose-sm max-w-none
                    prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5
                    prose-li:my-0.5 prose-headings:my-2 prose-code:text-xs
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
            <div className="flex gap-3 flex-row">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full
                              flex items-center justify-center shrink-0 text-white text-sm shadow-sm">
                🤖
              </div>
              <div className="bg-white border border-stone-200 shadow-sm rounded-2xl rounded-tl-sm
                              px-5 py-4 flex items-center gap-1.5 w-fit">
                <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" />
              </div>
            </div>
          )}

          {/* Empty state (while first message is loading) */}
          {visibleMessages.length === 0 && !isTyping && (
            <div className="text-center py-16 space-y-3">
              <div className="text-5xl">🤖</div>
              <p className="text-stone-500 text-sm">Starting your session…</p>
            </div>
          )}

          <div ref={endOfMessagesRef} className="h-2" />
        </div>
      </div>

      {/* ── Input Area ───────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-stone-200 p-3 sm:p-4 shrink-0">
        <div className="max-w-3xl mx-auto space-y-3">

          {/* Confidence quick-tap widget */}
          {showConfidenceWidget && (
            <div className="flex items-center gap-2 animate-in">
              <span className="text-xs font-medium text-stone-500 shrink-0">
                Confidence:
              </span>
              {CONF_CONFIG.map((c) => (
                <button
                  key={c.value}
                  onClick={() => handleConfidenceTap(c.value)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold
                    border-2 transition-all active:scale-95 ${c.className}`}
                >
                  <span>{c.emoji}</span>
                  <span className="hidden sm:inline">{c.label}</span>
                  <span className="sm:hidden">{c.value}</span>
                </button>
              ))}
            </div>
          )}

          {/* Text input row */}
          <div className="flex items-end gap-3">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask your tutor anything… (Enter to send, Shift+Enter for new line)"
              className="flex-1 max-h-36 min-h-[52px] resize-none px-4 py-3.5 bg-stone-50
                         border border-stone-200 rounded-xl text-sm focus:outline-none
                         focus:ring-2 focus:ring-orange-400 focus:border-transparent
                         transition-all placeholder:text-stone-400"
              rows={1}
            />
            <button
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isTyping}
              className="w-[52px] h-[52px] shrink-0 bg-stone-900 text-white rounded-xl
                         flex items-center justify-center hover:bg-stone-700
                         disabled:opacity-40 disabled:cursor-not-allowed transition-all
                         active:scale-95"
              aria-label="Send message"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12 7-7 7 7"/>
                <path d="M12 19V5"/>
              </svg>
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}
