import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { Bot, X } from "lucide-react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import CorporateActionsChatWidget from "../ai/CorporateActionsChatWidget";

export default function DashboardLayout({ children }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const location = useLocation();

  const isAIChatPage = location.pathname === "/analyst/ai" || location.pathname === "/admin/ai-assistant";

  const toggleChat = () => {
    setIsChatOpen((prev) => !prev);
  };

  return (
    <div className="flex min-h-screen bg-[#f4faf6] text-[#123b28] relative">
      {/* Dynamic Unified Sidebar */}
      <Sidebar
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileSidebarOpen(true)} />

        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#f4faf6]">
          {children}
        </main>
      </div>

      {/* Floating Corporate Actions AI Copilot Modal (Opens in bottom right rectangle box) */}
      {!isAIChatPage && (
        <>
          <CorporateActionsChatWidget
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
          />

          <button
            type="button"
            onClick={toggleChat}
            title={isChatOpen ? "Close AI Copilot" : "Corporate Actions AI Copilot"}
            aria-label={isChatOpen ? "Close AI Copilot" : "Open Corporate Actions AI Copilot"}
            className={`fixed bottom-7 right-7 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition-all duration-200 hover:-translate-y-1 hover:scale-105 active:translate-y-0 ${
              isChatOpen
                ? "bg-[#0c5636] ring-4 ring-[#55c98a]/40 shadow-2xl shadow-[#0c5636]/50"
                : "bg-[#126b45] shadow-[#126b45]/30 hover:bg-[#0c5636] hover:shadow-2xl hover:shadow-[#126b45]/40"
            }`}
          >
            {isChatOpen ? <X size={24} /> : <Bot size={26} />}

            {/* Animated green pulse badge when closed */}
            {!isChatOpen && (
              <span className="absolute top-1 right-1 flex h-3.5 w-3.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#55c98a] opacity-75"></span>
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-[#55c98a]"></span>
              </span>
            )}
          </button>
        </>
      )}
    </div>
  );
}
