"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

export default function ModuleLearnPage() {
  const router = useRouter();
  const params = useParams();
  const moduleId = params.moduleId;

  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("explain");

  useEffect(() => {
    const studentId = sessionStorage.getItem("studentId");
    if (!studentId || !moduleId) { router.replace("/learn"); return; }

    fetch("/api/modules/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleId, studentId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.content) setContent(data.content);
        else setError("Could not load content.");
        setLoading(false);
      })
      .catch(() => { setError("Network error."); setLoading(false); });
  }, [moduleId, router]);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-stone-50">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-stone-500">Generating explanation...</p>
        </div>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-5">
        <div className="text-center space-y-3">
          <p className="text-red-500">{error || "Content unavailable"}</p>
          <button onClick={() => router.back()} className="btn-secondary">← Go Back</button>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: "explain", label: "📖 Explain" },
    { id: "example", label: "🔢 Example" },
    { id: "terms", label: "📌 Key Terms" },
  ];

  return (
    <main className="min-h-dvh bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-100 px-5 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-stone-500 hover:text-stone-800 transition-colors">
          ← Back
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-stone-900 text-sm truncate">{content.title}</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5 py-5 space-y-5">
        {/* Hook */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-5 text-white">
          <p className="font-display font-semibold text-lg leading-snug">{content.hook}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-stone-100 p-1 rounded-xl">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                activeTab === t.id
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="animate-in">
          {activeTab === "explain" && (
            <div className="card p-5 space-y-4">
              <p className="text-stone-700 text-sm leading-relaxed">{content.explanation}</p>
              {content.analogy && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-amber-700 mb-1">💡 Think of it like this</p>
                  <p className="text-sm text-amber-800">{content.analogy}</p>
                </div>
              )}
              {content.formula && (
                <div className="bg-stone-900 rounded-xl p-4 font-mono text-orange-400 text-sm overflow-x-auto">
                  {content.formula}
                </div>
              )}
              {content.summary && (
                <div className="border-t border-stone-100 pt-4">
                  <p className="text-xs font-semibold text-stone-500 uppercase mb-1">Summary</p>
                  <p className="text-sm text-stone-700">{content.summary}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "example" && content.workedExample && (
            <div className="card p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-stone-500 uppercase mb-2">Problem</p>
                <p className="font-semibold text-stone-900">{content.workedExample.problem}</p>
              </div>
              {content.workedExample.steps?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase mb-2">Step-by-Step</p>
                  <ol className="space-y-2">
                    {content.workedExample.steps.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 font-bold text-xs
                                        flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                        <span className="text-stone-700">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-emerald-700 mb-0.5">✅ Answer</p>
                <p className="text-sm font-semibold text-emerald-800">{content.workedExample.answer}</p>
              </div>
            </div>
          )}

          {activeTab === "terms" && (
            <div className="card divide-y divide-stone-100">
              {(content.keyTerms ?? []).map((kt, i) => (
                <div key={i} className="p-4">
                  <p className="font-semibold text-stone-900 text-sm">{kt.term}</p>
                  <p className="text-xs text-stone-500 mt-0.5">{kt.definition}</p>
                </div>
              ))}
              {(!content.keyTerms || content.keyTerms.length === 0) && (
                <p className="p-4 text-sm text-stone-500">No key terms available.</p>
              )}
            </div>
          )}
        </div>

        {/* Take Quiz CTA */}
        <Link
          href={`/learn/${moduleId}/quiz`}
          className="btn-primary w-full text-center block"
        >
          Take Quiz →
        </Link>
      </div>
    </main>
  );
}
