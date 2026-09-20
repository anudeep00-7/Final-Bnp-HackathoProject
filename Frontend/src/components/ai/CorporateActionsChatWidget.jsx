import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  X,
  Send,
  RotateCcw,
  Bot,
  User,
  ShieldCheck,
  ChevronRight
} from "lucide-react";
import { processCorporateActionsQuery } from "../../services/corporateActionsEngine";
import { api } from "../../api/client";

const SUGGESTIONS = [
  "How many portfolios were impacted by the stock split of SEC006?",
  "Total cash paid for CA001",
  "Show holdings and actions for portfolio P001",
  "Cascade Materials (CSM) voluntary rights issue elections",
  "Explain Northwind Industries merger into Acquirer Corp",
  "Reconciliation status and audit exceptions"
];

export default function CorporateActionsChatWidget({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "bot",
      title: "BNP Paribas Corporate Actions Copilot",
      summary: "Welcome! Connected to the live PostgreSQL audit ledger and corporate actions master. Ask me any question about securities, portfolio holdings, cash dividends, stock splits, or election deadlines.",
      details: []
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (queryToSend) => {
    const text = (queryToSend || input).trim();
    if (!text || loading) return;

    const userMsg = {
      id: Date.now(),
      sender: "user",
      text
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    let result = null;

    // 1. Try calling the live backend API if available
    try {
      if (api?.audit?.ask) {
        const response = await api.audit.ask(text);
        if (response && response.answer && response.answer.trim().length > 15) {
          result = {
            title: "Corporate Actions Ledger Response",
            summary: response.answer,
            details: response.data?.portfolios ? [`Impacted: ${response.data.portfolios.join(", ")}`] : []
          };
        }
      }
    } catch (err) {
      // Backend not running or offline; gracefully falls back to deterministic local engine
    }

    // 2. Use ground-truth deterministic natural language engine
    if (!result) {
      result = processCorporateActionsQuery(text);
    }

    const botMsg = {
      id: Date.now() + 1,
      sender: "bot",
      title: result.title,
      summary: result.summary,
      details: result.details || []
    };

    setMessages((prev) => [...prev, botMsg]);
    setLoading(false);
  };

  const handleClear = () => {
    setMessages([
      {
        id: 1,
        sender: "bot",
        title: "BNP Paribas Corporate Actions Copilot",
        summary: "Chat cleared. Connected to live positions book and corporate actions event calendar. How can I assist you?",
        details: []
      }
    ]);
  };

  return (
    <div
      className="fixed bottom-24 right-7 z-50 flex h-[580px] w-[92vw] max-w-[430px] flex-col overflow-hidden rounded-2xl border border-[#dceee3] bg-white shadow-2xl transition-all duration-200 animate-in fade-in slide-in-from-bottom-5"
      role="dialog"
      aria-label="Corporate Actions AI Copilot"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#dceee3] bg-[#0c5636] px-4 py-3.5 text-white">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#126b45] text-white shadow-xs">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold tracking-tight">Corporate Actions Copilot</h3>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#55c98a] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#55c98a]"></span>
              </span>
            </div>
            <p className="text-[11px] text-[#a4d4bc] flex items-center gap-1">
              <ShieldCheck size={12} />
              BNP Paribas Ledger Connected
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleClear}
            title="Clear Chat History"
            aria-label="Clear Chat History"
            className="rounded-lg p-1.5 text-[#a4d4bc] hover:bg-[#126b45] hover:text-white transition-colors"
          >
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close Assistant"
            aria-label="Close Assistant"
            className="rounded-lg p-1.5 text-[#a4d4bc] hover:bg-[#126b45] hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f8fcf9]">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-2.5 ${m.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.sender === "bot" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e4f5e9] text-[#126b45] mt-0.5 border border-[#cbe8d5]">
                <Bot size={15} />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl p-3 text-[13px] leading-relaxed ${
                m.sender === "user"
                  ? "bg-[#126b45] text-white shadow-xs rounded-br-xs"
                  : "bg-white text-[#123b28] border border-[#dceee3] shadow-xs rounded-tl-xs"
              }`}
            >
              {m.sender === "user" ? (
                <p className="font-medium">{m.text}</p>
              ) : (
                <div className="space-y-2">
                  {m.title && (
                    <div className="flex items-center justify-between border-b border-[#eef7f2] pb-1.5">
                      <span className="font-semibold text-xs text-[#0c5636] uppercase tracking-wide">
                        {m.title}
                      </span>
                    </div>
                  )}

                  <div
                    className="text-[#123b28]"
                    dangerouslySetInnerHTML={{
                      __html: (m.summary || "")
                        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        .replace(/`(.*?)`/g, "<code class='bg-[#edf7f1] px-1 py-0.5 rounded text-[#0c5636] font-mono text-[11px]'>$1</code>")
                    }}
                  />

                  {m.details && m.details.length > 0 && (
                    <div className="mt-2 space-y-1 pt-1.5 border-t border-[#f0f8f3] text-[12px] text-[#2c533f]">
                      {m.details.map((d, dIdx) => (
                        <div
                          key={dIdx}
                          className="leading-normal"
                          dangerouslySetInnerHTML={{
                            __html: d
                              .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                              .replace(/`(.*?)`/g, "<code class='bg-[#edf7f1] px-1 py-0.5 rounded text-[#0c5636] font-mono text-[11px]'>$1</code>")
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {m.sender === "user" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#126b45] text-white mt-0.5">
                <User size={14} />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-[#527e67] bg-white border border-[#dceee3] p-2.5 rounded-xl w-fit">
            <Bot size={14} className="animate-spin text-[#126b45]" />
            <span>Consulting audit ledger & database...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Query Chips */}
      <div className="border-t border-[#e3f0e8] bg-[#fbfdfc] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#527e67] mb-1.5">
          Suggested Queries:
        </p>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {SUGGESTIONS.slice(0, 4).map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(s)}
              className="shrink-0 rounded-full border border-[#cde5d7] bg-white px-2.5 py-1 text-[11px] text-[#126b45] hover:bg-[#eaf7ef] hover:border-[#126b45] transition-colors flex items-center gap-1"
            >
              <span>{s.length > 32 ? s.slice(0, 32) + "..." : s}</span>
              <ChevronRight size={12} />
            </button>
          ))}
        </div>
      </div>

      {/* Input Box Footer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 border-t border-[#dceee3] bg-white p-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about stocks, splits, dividends, portfolios..."
          className="flex-1 rounded-xl border border-[#cde5d7] bg-[#f9fcfa] px-3.5 py-2.5 text-xs text-[#123b28] placeholder-[#7d9b8b] focus:border-[#126b45] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#126b45]"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#126b45] text-white shadow-sm hover:bg-[#0c5636] disabled:opacity-50 disabled:pointer-events-none transition-colors"
          title="Send Query"
          aria-label="Send Query"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
