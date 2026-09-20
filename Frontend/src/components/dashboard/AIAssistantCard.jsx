import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

const prompts = [
  "What corporate actions affect my portfolios this quarter?",
  "How has P001 changed since January 1?",
  "Show me my upcoming elections",
];

export default function AIAssistantCard() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate("/analyst/ai", { state: { initialQuery: query } });
    } else {
      navigate("/analyst/ai");
    }
  };

  const handlePromptClick = (p) => {
    navigate("/analyst/ai", { state: { initialQuery: p } });
  };

  return (
    <section className="rounded-2xl border border-[#dceee3] bg-white p-6 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e4f5e9] text-[#126b45]">
          <Sparkles size={20} />
        </div>

        <div>
          <h2 className="text-sm font-bold text-[#123b28]">
            AI Portfolio Assistant
          </h2>
          <p className="text-[11px] text-[#7d9b8b]">
            Ask questions about your portfolios
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => handlePromptClick(prompt)}
            className="flex w-full items-center gap-2 rounded-xl border border-[#dceee3] bg-[#f8fcf9] px-3.5 py-2.5 text-left text-xs text-[#5f786b] transition hover:border-[#126b45] hover:bg-white hover:text-[#126b45]"
          >
            <ArrowRight size={13} className="shrink-0 text-[#126b45]" />
            <span className="truncate">{prompt}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything about your portfolios..."
          className="min-w-0 flex-1 rounded-xl border border-[#dceee3] bg-[#f8fcf9] px-3.5 text-xs outline-none focus:border-[#126b45] focus:bg-white"
        />

        <button
          type="submit"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#126b45] text-white shadow-sm hover:bg-[#0c5636]"
          title="Send query"
        >
          <ArrowRight size={16} />
        </button>
      </form>
    </section>
  );
}