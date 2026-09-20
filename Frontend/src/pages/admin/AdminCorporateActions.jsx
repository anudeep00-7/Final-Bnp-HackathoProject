import React, { useState } from "react";
import {
  Search,
  Filter,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  Eye,
  ChevronRight,
  Shield,
  Layers,
  Download,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { exportToCsv } from "../../utils/exportCsv";
import { api } from "../../api/client";

export default function AdminCorporateActions() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [selectedAction, setSelectedAction] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionsList, setActionsList] = useState([]);

  const loadLiveActions = async () => {
    setLoading(true);
    try {
      const liveData = await api.actions.getAll();
      if (Array.isArray(liveData)) {
        const mapped = liveData.map((a) => {
          const rawType = a.action_type || "CASH_DIVIDEND";
          const cleanType = rawType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          const ratio = a.ratio_numerator
            ? `${a.ratio_numerator}:${a.ratio_denominator}`
            : a.cash_rate_per_share
            ? `₹${a.cash_rate_per_share} / share`
            : "1:1";
          
          let displayStatus = "Pending";
          if (a.status === "PROCESSED") displayStatus = "Processed";
          else if (a.status === "REVERSED") displayStatus = "Reversed";
          else if (a.status === "REJECTED") displayStatus = "Rejected";
          else if (rawType === "RIGHTS_ISSUE" || rawType === "TENDER_OFFER") displayStatus = "Election Due";

          return {
            id: a.ca_id || a.action_id,
            level: a.tier === 1 ? "BASIC" : a.tier === 2 ? "INTERMEDIATE" : "ADVANCED",
            type: cleanType,
            rawType: rawType,
            security: `${a.security_id} - ${a.security_name || a.symbol || "Security"}`,
            symbol: a.symbol || a.security_id,
            isin: a.isin || `INE${a.security_id}01`,
            date: a.ex_date || a.record_date || a.pay_date || "2026-04-15",
            impact: a.cash_rate_per_share ? `+₹${(a.cash_rate_per_share * 1000).toLocaleString()}` : "+1,000 units",
            status: displayStatus,
            entitlementRatio: ratio,
            eligiblePortfolios: rawType === "RIGHTS_ISSUE" ? 2 : 4,
            totalUnits: 2000,
            notes: a.notes,
          };
        });
        setActionsList(mapped);
        if (selectedAction) {
          const updatedSelected = mapped.find((m) => m.id === selectedAction.id);
          if (updatedSelected) setSelectedAction(updatedSelected);
        }
      }
    } catch (err) {
      console.warn("Error loading live corporate actions:", err.message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadLiveActions();
  }, []);

  const handleActionClick = async (action, e) => {
    if (e) e.stopPropagation();
    try {
      if (action.status === "Pending" || action.status === "Election Due" || action.status === "Reversed") {
        const res = await api.actions.process(action.id);
        setToastMessage(`✓ Action ${action.id} processed to PostgreSQL! ${res?.processed_records || 1} portfolio holdings updated.`);
      } else if (action.status === "Processed") {
        const res = await api.actions.reverse(action.id, "Reversal requested by operations admin");
        setToastMessage(`✓ Action ${action.id} reversed in PostgreSQL! ${res?.reversed_records || 1} holdings restored.`);
      }
      await loadLiveActions();
    } catch (err) {
      setToastMessage(`Error: ${err.message}`);
    }
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  };

  const handleRejectClick = async (actionId, e) => {
    if (e) e.stopPropagation();
    try {
      await api.actions.reject(actionId);
      setToastMessage(`Action ${actionId} rejected and quarantined in database.`);
      await loadLiveActions();
      setSelectedAction(null);
    } catch (err) {
      setToastMessage(`Reject failed: ${err.message}`);
    }
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  };

  const filteredActions = actionsList.filter((action) => {
    const matchesSearch =
      action.id.toLowerCase().includes(search.toLowerCase()) ||
      action.security.toLowerCase().includes(search.toLowerCase()) ||
      action.type.toLowerCase().includes(search.toLowerCase());

    const matchesType =
      typeFilter === "All Types" || action.type === typeFilter;

    const matchesStatus =
      statusFilter === "All Status" || action.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const handleExportCsv = () => {
    const headers = [
      "Action ID",
      "Complexity",
      "Type",
      "Security",
      "ISIN",
      "Effective Date",
      "Ratio / Terms",
      "Affected Portfolios",
      "Status",
    ];
    const rows = filteredActions.map((a) => [
      a.id,
      a.level,
      a.type,
      a.security,
      a.isin,
      a.date,
      a.entitlementRatio,
      a.eligiblePortfolios,
      a.status,
    ]);
    exportToCsv("Master_Corporate_Actions_Registry", headers, rows);
    setToastMessage("Corporate actions master registry exported successfully to CSV.");
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1500px] p-5 md:p-7">
        {/* Toast Alert */}
        {showToast && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 shadow-sm animate-fadeIn">
            <CheckCircle2 size={16} className="text-[#126b45]" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-[#126b45] px-2 py-0.5 text-[10px] font-bold text-white">
                ADMIN CONTROL
              </span>
              <span className="text-xs text-[#88a395]">Action Master</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#123b28] sm:text-3xl">
              Corporate Action Management
            </h1>
            <p className="mt-1 text-xs text-[#7d9b8b] sm:text-sm">
              Review, validate, simulate impact, execute deterministic adjustments, or trigger controlled reversals.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadLiveActions}
              className="inline-flex items-center gap-2 rounded-xl border border-[#dceee3] bg-white px-3.5 py-2 text-xs font-bold text-[#173b2a] shadow-xs hover:bg-[#edf8f1]"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>Sync with Database</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-xl bg-[#126b45] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#0c5636]"
            >
              <Download size={14} />
              <span>Export Master</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-[#dceee3] bg-white p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-[#88a395]"
            />
            <input
              type="text"
              placeholder="Search by Action ID, Security, or Type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-[#dceee3] bg-[#f8fcf9] pl-9 pr-3 text-xs outline-none focus:border-[#126b45]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs text-[#88a395]">
              <Filter size={14} />
              <span>Filters:</span>
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 rounded-lg border border-[#dceee3] bg-white px-3 text-xs text-[#173b2a] outline-none focus:border-[#126b45]"
            >
              <option>All Types</option>
              <option>Cash Dividend</option>
              <option>Bonus Issue</option>
              <option>Stock Split</option>
              <option>Rights Issue</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-lg border border-[#dceee3] bg-white px-3 text-xs text-[#173b2a] outline-none focus:border-[#126b45]"
            >
              <option>All Status</option>
              <option>Pending</option>
              <option>Election Due</option>
              <option>Processed</option>
              <option>Duplicate</option>
            </select>
          </div>
        </div>

        {/* Table & Inspector Layout */}
        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <div className={`${selectedAction ? "lg:col-span-8" : "lg:col-span-12"} overflow-hidden rounded-xl border border-[#dceee3] bg-white shadow-xs`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#edf4ef] bg-[#f8fcf9]/70 text-[10px] font-bold uppercase tracking-wider text-[#7d9b8b]">
                    <th className="px-4 py-3">Complexity</th>
                    <th className="px-4 py-3">Action ID</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Security</th>
                    <th className="px-4 py-3">Ex / Pay Date</th>
                    <th className="px-4 py-3">Expected Impact</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredActions.map((action) => (
                    <tr
                      key={action.id}
                      onClick={() => setSelectedAction(action)}
                      className={`cursor-pointer transition hover:bg-[#edf8f1]/80 ${
                        selectedAction?.id === action.id ? "bg-[#126b45]/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            action.level === "BASIC"
                              ? "bg-emerald-100 text-emerald-800"
                              : action.level === "INTERMEDIATE"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-purple-100 text-purple-800"
                          }`}
                        >
                          {action.level}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-mono text-xs font-bold text-[#123b28]">
                        {action.id}
                      </td>

                      <td className="px-4 py-3 text-xs font-medium text-[#173b2a]">
                        {action.type}
                      </td>

                      <td className="px-4 py-3">
                        <span className="block text-xs font-bold text-[#123b28]">
                          {action.security}
                        </span>
                        <span className="font-mono text-[10px] text-[#88a395]">
                          {action.isin}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-xs text-[#5f786b]">
                        {action.date}
                      </td>

                      <td className="px-4 py-3 text-xs font-semibold text-[#126b45]">
                        {action.impact}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            action.status === "Processed"
                              ? "bg-emerald-100 text-emerald-800"
                              : action.status === "Pending"
                              ? "bg-amber-100 text-amber-800"
                              : action.status === "Election Due"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {action.status}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => handleActionClick(action, e)}
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                            action.status === "Processed"
                              ? "border border-[#dceee3] bg-white text-[#173b2a] hover:bg-[#e7f6ec]"
                              : "bg-[#126b45] text-white hover:bg-[#0c5636]"
                          }`}
                        >
                          {action.status === "Processed" ? (
                            <>
                              <RotateCcw size={12} />
                              <span>Reverse</span>
                            </>
                          ) : action.status === "Election Due" ? (
                            <>
                              <CheckCircle2 size={12} />
                              <span>Elect</span>
                            </>
                          ) : action.status === "Duplicate" ? (
                            <>
                              <Shield size={12} />
                              <span>Inspect</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={12} />
                              <span>Process</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Detail Drawer */}
          {selectedAction && (
            <div className="rounded-xl border border-[#dceee3] bg-white p-5 shadow-xs lg:col-span-4">
              <div className="flex items-center justify-between border-b border-[#edf4ef] pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-[#123b28]">
                    {selectedAction.id}
                  </span>
                  <span className="rounded bg-[#f0f7f3] px-2 py-0.5 text-[10px] font-semibold text-[#173b2a]">
                    {selectedAction.level}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedAction(null)}
                  className="text-xs text-[#88a395] hover:text-[#173b2a]"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#88a395]">
                    Security & ISIN
                  </label>
                  <p className="mt-1 text-sm font-bold text-[#123b28]">
                    {selectedAction.security}
                  </p>
                  <p className="font-mono text-xs text-[#7d9b8b]">
                    {selectedAction.isin}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-[#f8fcf9] p-2.5">
                    <span className="text-[10px] text-[#88a395]">Entitlement</span>
                    <p className="mt-0.5 text-xs font-bold text-[#173b2a]">
                      {selectedAction.entitlementRatio}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#f8fcf9] p-2.5">
                    <span className="text-[10px] text-[#88a395]">Portfolios</span>
                    <p className="mt-0.5 text-xs font-bold text-[#173b2a]">
                      {selectedAction.eligiblePortfolios} Eligible
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#88a395]">
                    Deterministic Simulation
                  </label>
                  <div className="mt-1.5 space-y-1.5 rounded-lg border border-[#dceee3] p-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#7d9b8b]">Units affected:</span>
                      <strong className="font-mono">{selectedAction.totalUnits.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#7d9b8b]">Settlement window:</span>
                      <span>{selectedAction.date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#7d9b8b]">Calculated Net:</span>
                      <strong className="text-[#126b45]">
                        {selectedAction.impact}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={(e) => handleActionClick(selectedAction, e)}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#126b45] text-xs font-bold text-white transition hover:bg-[#0c5636]"
                  >
                    {selectedAction.status === "Processed" ? "Reverse Action in DB" : "Process Action in DB"}
                  </button>
                  {selectedAction.status !== "Rejected" && selectedAction.status !== "Processed" && (
                    <button
                      onClick={(e) => handleRejectClick(selectedAction.id, e)}
                      className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-rose-300 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                    >
                      Reject / Cancel Action
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
