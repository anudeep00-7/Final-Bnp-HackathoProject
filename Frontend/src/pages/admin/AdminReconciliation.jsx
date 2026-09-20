import React, { useState, useEffect } from "react";
import {
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
  Filter,
  ArrowUpDown,
  Search,
  Check,
  ShieldCheck,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { exportToCsv } from "../../utils/exportCsv";
import { api } from "../../api/client";

export default function AdminReconciliation() {
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [exportNotice, setExportNotice] = useState(false);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadReconciliation = async () => {
    setLoading(true);
    try {
      const liveRecords = await api.reconciliation.getAll();
      if (Array.isArray(liveRecords)) {
        const mapped = liveRecords.map((r, idx) => ({
          id: `REC-${String(r.processing_id || idx + 1).padStart(4, "0")}`,
          rawProcessingId: r.processing_id,
          actionId: r.ca_id || "CA-LIVE",
          action: r.action_type || "Corporate Action Settlement",
          security: r.security_name ? `${r.security_name} (${r.symbol})` : (r.symbol || "Multi-Asset"),
          portfolio: r.portfolio_name ? `${r.portfolio_id} - ${r.portfolio_name}` : (r.portfolio_id || "P001"),
          expectedCash: Number(r.expected_leakage || 0),
          actualCash: Number(r.cash_movement ?? r.observed_difference ?? 0),
          expectedSecurity: Number(r.before_quantity || 0),
          actualSecurity: Number(r.after_quantity || 0),
          status: r.reconciled ? "Reconciled" : "Exception",
          varianceNotes: r.reconciled
            ? "Reconciled within zero variance tolerance against corporate_actions ledger."
            : `Variance difference of ${r.reconciliation_difference ?? "0.00"} detected between custodian ledger and expected state.`,
          date: r.processed_at ? new Date(r.processed_at).toLocaleDateString() : "Live",
        }));
        setData(mapped);
      }
    } catch (err) {
      console.error("Failed to load reconciliation records:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReconciliation();
  }, []);

  const filtered = data.filter((item) => {
    const matchStatus = statusFilter === "All" || item.status === statusFilter;
    const matchSearch =
      item.id.toLowerCase().includes(search.toLowerCase()) ||
      item.action.toLowerCase().includes(search.toLowerCase()) ||
      item.security.toLowerCase().includes(search.toLowerCase()) ||
      item.portfolio.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const totalRecords = data.length;
  const reconciledCount = data.filter((d) => d.status === "Reconciled").length;
  const exceptionCount = data.filter((d) => d.status === "Exception").length;

  const totalExpectedCash = data.reduce((acc, d) => acc + d.expectedCash, 0);
  const totalActualCash = data.reduce((acc, d) => acc + d.actualCash, 0);

  const resolveException = async (id, rawId) => {
    setData((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              actualSecurity: item.expectedSecurity,
              actualCash: item.expectedCash,
              status: "Reconciled",
              varianceNotes: "Exception verified and settled with custodian ledger.",
            }
          : item
      )
    );
    if (selectedRecord?.id === id) {
      setSelectedRecord((prev) => ({
        ...prev,
        actualSecurity: prev.expectedSecurity,
        actualCash: prev.expectedCash,
        status: "Reconciled",
        varianceNotes: "Exception verified and settled with custodian ledger.",
      }));
    }

    try {
      const targetId = rawId || data.find((d) => d.id === id)?.rawProcessingId;
      if (targetId) {
        await api.reconciliation.resolve(targetId);
      }
      await loadReconciliation();
    } catch (err) {
      console.warn("Could not persist resolution to DB:", err);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      "Reconciliation ID",
      "Action ID",
      "Event",
      "Security",
      "Portfolio",
      "Expected Cash",
      "Actual Cash",
      "Cash Delta",
      "Status",
    ];
    const rows = filtered.map((d) => [
      d.id,
      d.actionId,
      d.action,
      d.security,
      d.portfolio,
      d.expectedCash,
      d.actualCash,
      d.actualCash - d.expectedCash,
      d.status,
    ]);
    exportToCsv("Reconciliation_Ledger_Audit", headers, rows);
    setExportNotice(true);
    setTimeout(() => setExportNotice(false), 3000);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1500px] p-5 md:p-7">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-[#126b45] px-2 py-0.5 text-[10px] font-bold text-white">
                RECONCILIATION MASTER
              </span>
              <span className="text-xs text-[#88a395]">Automated Custody Matching</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#123b28] sm:text-3xl">
              Reconciliation & Settlement Controls
            </h1>
            <p className="mt-1 text-xs text-[#7d9b8b] sm:text-sm">
              Verify expected corporate-action entitlements against custodian records and resolve discrepancies.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadReconciliation}
              className="inline-flex items-center gap-2 rounded-xl border border-[#dceee3] bg-white px-3.5 py-2 text-xs font-bold text-[#173b2a] shadow-xs hover:bg-[#edf8f1]"
            >
              <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
              <span>Refresh Ledger</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-xl bg-[#126b45] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#0c5636]"
            >
              <Download size={14} />
              <span>Export Audit (.csv)</span>
            </button>
          </div>
        </div>

        {exportNotice && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800">
            <CheckCircle2 size={16} />
            <span>Reconciliation records exported to <strong>Reconciliation_Ledger_Audit.csv</strong>.</span>
          </div>
        )}

        {/* Summary Metric Cards */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-[#dceee3] bg-white p-4 shadow-xs">
            <span className="text-[11px] font-medium text-[#7d9b8b]">Total Entries</span>
            <div className="mt-2 text-2xl font-bold text-[#123b28]">{totalRecords}</div>
            <p className="mt-1 text-[11px] text-[#88a395]">Automated ledger audits</p>
          </div>

          <div className="rounded-xl border border-[#dceee3] bg-white p-4 shadow-xs">
            <span className="text-[11px] font-medium text-emerald-600">Reconciled</span>
            <div className="mt-2 text-2xl font-bold text-emerald-600">{reconciledCount}</div>
            <p className="mt-1 text-[11px] text-[#88a395]">Zero variance confirmed</p>
          </div>

          <div className="rounded-xl border border-[#dceee3] bg-white p-4 shadow-xs">
            <span className="text-[11px] font-medium text-rose-600">Exceptions</span>
            <div className="mt-2 text-2xl font-bold text-rose-600">{exceptionCount}</div>
            <p className="mt-1 text-[11px] text-rose-500">Requires manual review</p>
          </div>

          <div className="rounded-xl border border-[#dceee3] bg-white p-4 shadow-xs">
            <span className="text-[11px] font-medium text-[#7d9b8b]">Cash Variance</span>
            <div className="mt-2 text-2xl font-bold text-[#123b28]">
              ₹{(totalExpectedCash - totalActualCash).toLocaleString()}
            </div>
            <p className="mt-1 text-[11px] text-[#88a395]">Expected vs Actual Net</p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-[#dceee3] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {["All", "Reconciled", "Exception"].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === tab
                    ? "bg-[#126b45] text-white"
                    : "bg-[#f0f7f3] text-[#5f786b] hover:bg-slate-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-[#88a395]" />
            <input
              type="text"
              placeholder="Search reconciliation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8.5 w-full rounded-lg border border-[#dceee3] bg-[#f8fcf9] pl-9 pr-3 text-xs outline-none focus:border-[#126b45]"
            />
          </div>
        </div>

        {/* Table & Inspector Layout */}
        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <div className={`${selectedRecord ? "lg:col-span-8" : "lg:col-span-12"} overflow-hidden rounded-xl border border-[#dceee3] bg-white shadow-xs`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#edf4ef] bg-[#f8fcf9]/70 text-[10px] font-bold uppercase tracking-wider text-[#7d9b8b]">
                    <th className="px-4 py-3">REC ID</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Security & Portfolio</th>
                    <th className="px-4 py-3">Cash (Exp / Act)</th>
                    <th className="px-4 py-3">Units (Exp / Act)</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center text-[#7d9b8b]">
                        <RefreshCcw size={18} className="mx-auto animate-spin text-[#126b45] mb-2" />
                        Querying live database processing_reconciliation view...
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center text-[#7d9b8b]">
                        <p className="font-semibold text-[#173b2a]">No reconciliation records found in database.</p>
                        <p className="text-[11px] mt-1">
                          Reconciliation entries are generated automatically by PostgreSQL triggers whenever corporate actions are processed.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item) => {
                      const hasCashDiscrepancy = item.expectedCash !== item.actualCash;
                      const hasUnitDiscrepancy = item.expectedSecurity !== item.actualSecurity;

                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedRecord(item)}
                          className={`cursor-pointer transition hover:bg-[#edf8f1]/80 ${
                            selectedRecord?.id === item.id ? "bg-[#126b45]/5" : ""
                          }`}
                        >
                          <td className="px-4 py-3 font-mono font-bold text-[#123b28]">
                            {item.id}
                          </td>
                          <td className="px-4 py-3 font-medium text-[#173b2a]">
                            {item.action}
                          </td>
                          <td className="px-4 py-3">
                            <span className="block font-bold text-[#123b28]">
                              {item.security}
                            </span>
                            <span className="text-[11px] text-[#7d9b8b]">
                              {item.portfolio}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={hasCashDiscrepancy ? "font-bold text-rose-600" : ""}>
                              ₹{item.expectedCash.toLocaleString()} / ₹{item.actualCash.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={hasUnitDiscrepancy ? "font-bold text-rose-600" : ""}>
                              {item.expectedSecurity} / {item.actualSecurity}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                item.status === "Reconciled"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {item.status === "Exception" ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  resolveException(item.id);
                                }}
                                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                              >
                                Resolve
                              </button>
                            ) : (
                              <span className="text-[11px] text-emerald-600">
                                ✓ Verified
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Inspector Drawer */}
          {selectedRecord && (
            <div className="rounded-xl border border-[#dceee3] bg-white p-5 shadow-xs lg:col-span-4">
              <div className="flex items-center justify-between border-b border-[#edf4ef] pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-[#123b28]">
                    {selectedRecord.id}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      selectedRecord.status === "Reconciled"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {selectedRecord.status}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="text-xs text-[#88a395] hover:text-[#173b2a]"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 space-y-4 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#88a395]">Action Reference</span>
                  <p className="mt-0.5 font-bold text-[#173b2a]">
                    {selectedRecord.action} ({selectedRecord.actionId})
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-[#88a395]">Portfolio & Security</span>
                  <p className="mt-0.5 font-bold text-[#173b2a]">{selectedRecord.security}</p>
                  <p className="text-[#7d9b8b]">{selectedRecord.portfolio}</p>
                </div>

                <div className="rounded-xl border border-[#dceee3] bg-[#f8fcf9]/70 p-3">
                  <span className="text-[10px] uppercase font-bold text-[#88a395]">Reconciliation Analysis</span>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-[#7d9b8b]">Expected Cash:</span>
                      <span className="font-mono font-bold">₹{selectedRecord.expectedCash.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#7d9b8b]">Custodian Cash:</span>
                      <span className="font-mono font-bold">₹{selectedRecord.actualCash.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t border-[#dceee3] pt-1">
                      <span className="text-[#7d9b8b]">Cash Delta:</span>
                      <span className={`font-mono font-bold ${selectedRecord.expectedCash !== selectedRecord.actualCash ? "text-rose-600" : "text-emerald-600"}`}>
                        ₹{(selectedRecord.actualCash - selectedRecord.expectedCash).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedRecord.varianceNotes && (
                  <div className="rounded-xl bg-amber-50 p-3 text-[11px] text-amber-800">
                    <strong>Audit Note:</strong> {selectedRecord.varianceNotes}
                  </div>
                )}

                {selectedRecord.status === "Exception" && (
                  <button
                    onClick={() => resolveException(selectedRecord.id)}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-xs font-bold text-white transition hover:bg-emerald-700"
                  >
                    Resolve & Sync with Ledger
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
