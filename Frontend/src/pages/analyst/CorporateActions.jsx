import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Download,
  Eye,
  Send,
  X,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { exportToCsv } from "../../utils/exportCsv";
import { api } from "../../api/client";

export default function AnalystCorporateActions() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [exportNotice, setExportNotice] = useState(false);

  const [actionsList, setActionsList] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadActions = async () => {
    setLoading(true);
    try {
      const liveData = await api.actions.getAll();
      if (Array.isArray(liveData)) {
        const mapped = liveData.map((a) => {
          const rawType = a.action_type || "CASH_DIVIDEND";
          const cleanType = rawType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          let shortType = "DIV";
          if (rawType.includes("SPLIT")) shortType = "SPL";
          else if (rawType.includes("BONUS")) shortType = "BON";
          else if (rawType.includes("RIGHTS")) shortType = "RIG";
          else if (rawType.includes("MERGER")) shortType = "MRG";

          const entitlement = a.ratio_numerator
            ? `${a.ratio_numerator}:${a.ratio_denominator} ratio`
            : a.cash_rate_per_share
            ? `₹${a.cash_rate_per_share} per share`
            : "Standard Terms";

          let displayStatus = "Upcoming";
          if (a.status === "PROCESSED") displayStatus = "Processed";
          else if (a.status === "REVERSED") displayStatus = "Reversed";
          else if (a.status === "REJECTED") displayStatus = "Rejected";
          else if (shortType === "RIG") displayStatus = "Action Needed";

          return {
            id: a.ca_id || a.action_id,
            name: `${a.symbol || a.security_id} ${cleanType}`,
            type: shortType,
            rawType: rawType,
            security: `${a.security_id} - ${a.security_name || a.symbol || "Security"}`,
            portfolio: a.portfolio_id ? `${a.portfolio_id} Fund` : "Assigned Portfolios",
            exDate: a.ex_date || "2026-04-15",
            recordDate: a.record_date || a.ex_date || "2026-04-16",
            status: displayStatus,
            entitlement: entitlement,
            estimatedCash: a.cash_rate_per_share ? `+₹${(a.cash_rate_per_share * 1000).toLocaleString()}` : null,
            estimatedUnits: a.ratio_numerator ? `+${a.ratio_numerator * 500} units` : null,
            description: a.notes || `Official ${cleanType} declared for ${a.security_name || a.security_id}.`,
          };
        });
        setActionsList(mapped);
      }
    } catch (err) {
      console.warn("Error loading analyst corporate actions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActions();
  }, []);

  const filtered = actionsList.filter((a) => {
    const matchType = filterType === "All" || a.type === filterType;
    const matchSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.security.toLowerCase().includes(search.toLowerCase()) ||
      a.portfolio.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const handleExportCsv = () => {
    const headers = ["ID", "Corporate Action", "Type", "Security", "Portfolio", "Ex-Date", "Record Date", "Entitlement", "Status"];
    const rows = filtered.map((item) => [
      item.id,
      item.name,
      item.type,
      item.security,
      item.portfolio,
      item.exDate,
      item.recordDate,
      item.entitlement,
      item.status,
    ]);
    exportToCsv("Corporate_Actions_Feed", headers, rows);
    setExportNotice(true);
    setTimeout(() => setExportNotice(false), 3000);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1500px] p-5 md:p-7">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#126b45]">
              Assigned Portfolio Events
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#123b28] sm:text-3xl">
              Corporate Action Feed
            </h1>
            <p className="mt-1 text-xs text-[#7d9b8b] sm:text-sm">
              Upcoming and scheduled events directly impacting your assigned holdings.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-xl bg-[#126b45] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0c5636]"
            >
              <Download size={14} />
              <span>Export Action Feed</span>
            </button>
          </div>
        </div>

        {exportNotice && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800">
            <CheckCircle2 size={16} />
            <span>Corporate action feed exported successfully to <strong>Corporate_Actions_Feed.csv</strong>.</span>
          </div>
        )}

        {/* Toolbar */}
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-[#dceee3] bg-white p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-[#88a395]" />
            <input
              type="text"
              placeholder="Search actions or securities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-xl border border-[#dceee3] bg-[#f8fcf9] pl-9 pr-3 text-xs outline-none focus:border-[#126b45]"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {["All", "DIV", "SPL", "BON", "RIG"].map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  filterType === t
                    ? "bg-[#126b45] text-white shadow-xs"
                    : "bg-[#f0f7f3] text-[#5f786b] hover:bg-[#dceee3]"
                }`}
              >
                {t === "All" ? "All Types" : t}
              </button>
            ))}
          </div>
        </div>

        {/* Feed Cards */}
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-2xl border border-[#dceee3] bg-white p-5 shadow-xs transition hover:border-[#126b45] hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-[#126b45] px-2.5 py-0.5 text-[10px] font-bold text-white">
                    {item.type}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      item.urgent
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <h3 className="mt-3 text-base font-bold text-[#123b28]">
                  {item.name}
                </h3>
                <p className="mt-0.5 text-xs text-[#7d9b8b]">
                  {item.security}
                </p>

                <div className="mt-4 space-y-2 rounded-xl bg-[#f8fcf9] p-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#7d9b8b]">Portfolio:</span>
                    <span className="font-semibold text-[#173b2a]">{item.portfolio}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7d9b8b]">Ex-Date:</span>
                    <span className="font-medium text-[#173b2a]">{item.exDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7d9b8b]">Entitlement:</span>
                    <span className="font-bold text-[#126b45]">
                      {item.entitlement}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 flex items-center gap-2 border-t border-[#edf4ef] pt-4">
                <button
                  onClick={() => setSelectedEvent(item)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#dceee3] bg-white py-2 text-xs font-bold text-[#123b28] transition hover:bg-[#edf8f1]"
                >
                  <Eye size={13} className="text-[#126b45]" />
                  <span>Inspect</span>
                </button>

                {item.type === "RIG" ? (
                  <button
                    onClick={() => navigate("/analyst/elections")}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#126b45] py-2 text-xs font-bold text-white transition hover:bg-[#0c5636]"
                  >
                    <Send size={13} />
                    <span>Elect</span>
                  </button>
                ) : (
                  <button
                    onClick={() => navigate("/analyst/impact")}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#e4f5e9] py-2 text-xs font-bold text-[#126b45] transition hover:bg-[#126b45] hover:text-white"
                  >
                    <TrendingUp size={13} />
                    <span>Impact</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Event Detail Modal */}
        {selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#123b28]/40 p-4 backdrop-blur-2xs">
            <div className="w-full max-w-lg rounded-2xl border border-[#dceee3] bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#edf4ef] pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="rounded-lg bg-[#126b45] px-2.5 py-1 text-xs font-bold text-white">
                    {selectedEvent.type}
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-[#123b28]">
                      {selectedEvent.name}
                    </h3>
                    <p className="font-mono text-xs text-[#7d9b8b]">{selectedEvent.id}</p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedEvent(null)}
                  className="rounded-lg p-1 text-[#88a395] hover:bg-[#f0f7f3] hover:text-[#173b2a]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 space-y-3.5 text-xs">
                <p className="text-[#5f786b]">{selectedEvent.description}</p>

                <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#f8fcf9] p-3.5">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#88a395]">Security Reference</span>
                    <p className="mt-0.5 font-bold text-[#173b2a]">{selectedEvent.security}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#88a395]">Target Portfolio</span>
                    <p className="mt-0.5 font-bold text-[#173b2a]">{selectedEvent.portfolio}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#88a395]">Ex-Distribution Date</span>
                    <p className="mt-0.5 font-bold text-[#173b2a]">{selectedEvent.exDate}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#88a395]">Record Date</span>
                    <p className="mt-0.5 font-bold text-[#173b2a]">{selectedEvent.recordDate}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-[#dceee3] p-3.5">
                  <span className="text-[10px] uppercase font-bold text-[#88a395]">Calculated Entitlement</span>
                  <p className="mt-1 font-mono text-base font-bold text-[#126b45]">
                    {selectedEvent.entitlement}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="rounded-xl border border-[#dceee3] px-4 py-2 text-xs font-bold text-[#5f786b] hover:bg-[#edf8f1]"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const isRig = selectedEvent.type === "RIG";
                    setSelectedEvent(null);
                    navigate(isRig ? "/analyst/elections" : "/analyst/impact");
                  }}
                  className="rounded-xl bg-[#126b45] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#0c5636]"
                >
                  {selectedEvent.type === "RIG" ? "Go to Elections" : "Simulate Impact"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
