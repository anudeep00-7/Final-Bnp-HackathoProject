import React, { useState } from "react";
import {
  Bot,
  Send,
  Sparkles,
  ArrowRight,
  Shield,
  HelpCircle,
  FileQuestion,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { api } from "../../api/client";
import { processCorporateActionsQuery } from "../../services/corporateActionsEngine";

export default function AdminAIChat() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "Hello Administrator! I am your Corporate Actions Operations Intelligence Assistant. Connected directly to the live PostgreSQL audit ledger and event terms database. You can ask me about discrepancies, upcoming ex-dates, reconciliation variances, or voluntary action status across all portfolios.",
    },
  ]);

  const promptSuggestions = [
    "Identify all exceptions in the latest reconciliation ledger.",
    "Which actions were rejected or pending?",
    "How many portfolios were impacted by the stock split of SEC006",
    "Total cash paid for CA001",
    "Show actions for portfolio P001",
  ];

  const handleSend = async (textToSend) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg = { sender: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    let botReply = "";

    try {
      const response = await api.audit.ask(text);
      if (response && response.answer) {
        botReply = response.answer;
      }
    } catch (err) {
      console.warn("Falling back to local AI assistant:", err);
    }

    if (!botReply) {
      const res = processCorporateActionsQuery(text);
      botReply = `${res.summary}\n\n${(res.details || []).join("\n")}`;
    }

    setMessages((prev) => [...prev, { sender: "bot", text: botReply }]);
    setLoading(false);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1100px] p-5 md:p-7">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-[#126b45] px-2 py-0.5 text-[10px] font-bold text-white">
                NLP COPILOT
              </span>
              <span className="text-xs text-[#88a395]">Enterprise AI</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#123b28] sm:text-3xl">
              Operations AI Assistant
            </h1>
            <p className="mt-1 text-xs text-[#7d9b8b] sm:text-sm">
              Query corporate actions, holdings, settlement anomalies, and compliance audit records using natural language.
            </p>
          </div>
        </div>

        {/* Chat Area */}
        <div className="mt-6 flex h-[580px] flex-col overflow-hidden rounded-2xl border border-[#dceee3] bg-white shadow-xs">
          {/* Messages Scroll Area */}
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${
                  m.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {m.sender === "bot" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#126b45]/10 text-[#126b45]">
                    <Sparkles size={16} />
                  </div>
                )}
                <div
                  className={`max-w-xl rounded-2xl p-4 text-xs leading-relaxed ${
                    m.sender === "user"
                      ? "bg-[#126b45] text-white"
                      : "border border-[#dceee3] bg-[#f8fcf9]/80 text-[#173b2a]"
                  }`}
                >
                  {m.sender === "user" ? m.text : (
                    <div
                      className="space-y-1 [&_strong]:font-bold [&_code]:bg-[#edf7f1] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[#0c5636] [&_code]:font-mono [&_code]:text-[11px]"
                      dangerouslySetInnerHTML={{
                        __html: (m.text || "")
                          .replace(/\n/g, "<br/>")
                          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                          .replace(/`(.*?)`/g, "<code>$1</code>")
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#126b45]/10 text-[#126b45]">
                  <Sparkles size={16} />
                </div>
                <div className="rounded-2xl border border-[#dceee3] bg-[#f8fcf9]/80 p-4 text-xs text-[#7d9b8b] flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#126b45] animate-pulse" />
                  <span>Querying corporate actions database...</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Prompts */}
          <div className="border-t border-[#edf4ef] bg-[#f8fcf9]/50 p-3">
            <div className="flex flex-wrap gap-2">
              {promptSuggestions.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(p)}
                  className="rounded-lg border border-[#dceee3] bg-white px-2.5 py-1 text-[11px] text-[#5f786b] transition hover:border-[#126b45] hover:text-[#126b45]"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Input Box */}
          <div className="border-t border-[#dceee3] bg-white p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="Ask about corporate actions, reconciliation exceptions, or portfolios..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="h-10 flex-1 rounded-xl border border-[#dceee3] bg-[#f8fcf9] px-4 text-xs outline-none focus:border-[#126b45]"
              />
              <button
                type="submit"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#126b45] text-white transition hover:bg-[#0c5636]"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
