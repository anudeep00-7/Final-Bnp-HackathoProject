import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  MessageSquareText,
  Sparkles,
  Send,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";

import { exportToCsv } from "../../utils/exportCsv";
import { api } from "../../api/client";
import { processCorporateActionsQuery } from "../../services/corporateActionsEngine";

const suggestedQueries = [
  "What corporate actions affect my portfolios?",
  "Show actions for portfolio P001",
  "How many portfolios were impacted by the stock split?",
  "Which actions were rejected or pending?",
  "Total cash paid for CA001",
];

export default function AIAssistantPage() {
  const location = useLocation();
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "Hello! I'm your BNP Paribas Corporate Actions AI Assistant. Connected directly to the live PostgreSQL audit ledger and event terms database. How can I help you analyze your portfolio holdings, audit records, or corporate events today?",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location.state && location.state.initialQuery) {
      handleSend(location.state.initialQuery);
    }
  }, [location.state]);

  const handleSend = async (queryToSend) => {
    const text = queryToSend || inputValue;
    if (!text.trim() || loading) return;

    const userMsg = { sender: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setLoading(true);

    let reply = "";

    try {
      const response = await api.audit.ask(text);
      if (response && response.answer) {
        reply = response.answer;
      }
    } catch (err) {
      console.warn("Falling back to local AI assistant:", err);
    }

    if (!reply) {
      const res = processCorporateActionsQuery(text);
      reply = `${res.summary}\n\n${(res.details || []).join("\n")}`;
    }

    setMessages((prev) => [...prev, { sender: "bot", text: reply }]);
    setLoading(false);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1200px]">
        {/* Header */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#126b45]">
            Analyst Workspace
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#123b28]">
            AI Portfolio Assistant
          </h1>
          <p className="mt-1 text-xs text-[#7d9b8b]">
            Ask questions about corporate actions, portfolio impact, and election deadlines.
          </p>
        </div>

        {/* Chat Container */}
        <div className="flex h-[600px] flex-col overflow-hidden rounded-2xl border border-[#dceee3] bg-white shadow-xs">
          {/* Top Assistant Header */}
          <div className="flex items-center gap-3 border-b border-[#dceee3] px-6 py-4 bg-[#f8fcf9]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e4f5e9] text-[#126b45]">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#123b28]">
                BNP Paribas Portfolio Assistant
              </h2>
              <p className="text-[11px] text-[#7d9b8b]">
                Real-time natural language query interface
              </p>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${
                  m.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {m.sender === "bot" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#e4f5e9] text-[#126b45]">
                    <Bot size={16} />
                  </div>
                )}
                <div
                  className={`max-w-xl rounded-2xl p-4 text-xs leading-relaxed ${
                    m.sender === "user"
                      ? "bg-[#126b45] text-white font-medium"
                      : "border border-[#dceee3] bg-[#f8fcf9] text-[#173b2a]"
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
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#e4f5e9] text-[#126b45]">
                  <Bot size={16} />
                </div>
                <div className="rounded-2xl border border-[#dceee3] bg-[#f8fcf9] p-4 text-xs text-[#7d9b8b] flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#126b45] animate-pulse" />
                  <span>Querying corporate actions database...</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Query Shortcuts */}
          <div className="border-t border-[#edf4ef] bg-[#f8fcf9] p-3.5">
            <div className="flex flex-wrap gap-2">
              {suggestedQueries.map((query) => (
                <button
                  key={query}
                  type="button"
                  onClick={() => handleSend(query)}
                  className="rounded-xl border border-[#dceee3] bg-white px-3 py-1.5 text-left text-xs font-semibold text-[#5f786b] transition hover:border-[#126b45] hover:bg-[#edf8f1] hover:text-[#126b45]"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>

          {/* Input Box */}
          <div className="border-t border-[#dceee3] bg-white p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about portfolios, actions, elections, or settlements..."
                className="h-11 min-w-0 flex-1 rounded-xl border border-[#dceee3] bg-[#f8fcf9] px-4 text-xs outline-none focus:border-[#126b45] focus:bg-white"
              />

              <button
                type="submit"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#126b45] text-white transition hover:bg-[#0c5636]"
                title="Send query"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}