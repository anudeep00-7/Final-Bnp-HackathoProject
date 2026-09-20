import React, { useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Download,
  Filter,
  RefreshCw,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { exportToCsv } from "../../utils/exportCsv";

import { api } from "../../api/client";

export default function ImpactAnalysis() {
  const [selectedPortfolio, setSelectedPortfolio] = useState("All");
  const [selectedActionType, setSelectedActionType] = useState("All");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [exported, setExported] = useState(false);
  const [impacts, setImpacts] = useState([]);
  const [portfoliosList, setPortfoliosList] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recons, ports] = await Promise.all([
        api.reconciliation.getAll().catch(() => []),
        api.portfolios.getAll().catch(() => []),
      ]);

      if (Array.isArray(ports)) {
        setPortfoliosList(ports);
      }

      if (Array.isArray(recons)) {
        const mapped = recons.map((r, idx) => {
          const deltaSec = (r.after_quantity || 0) - (r.before_quantity || 0);
          return {
            id: `IMP-${String(r.processing_id || idx + 1).padStart(2, "0")}`,
            action: `${r.action_type || "Corporate Action"} (${r.security_name || r.symbol || r.ca_id || "Asset"})`,
            type: r.action_type ? r.action_type.substring(0, 3).toUpperCase() : "ACT",
            rawActionType: r.action_type || "",
            portfolioId: r.portfolio_id,
            portfolio: r.portfolio_name ? `${r.portfolio_id} - ${r.portfolio_name}` : (r.portfolio_id || "P001"),
            holding: `${r.security_name || r.symbol || "Security"} (${Number(r.before_quantity || 0).toLocaleString()} units)`,
            beforeCash: `₹${Number(r.before_cash || 0).toLocaleString()}`,
            afterCash: `₹${Number(r.after_cash || 0).toLocaleString()}`,
            cashDelta: r.cash_movement
              ? (r.cash_movement >= 0 ? `+₹${r.cash_movement.toLocaleString()}` : `-₹${Math.abs(r.cash_movement).toLocaleString()}`)
              : "₹0",
            rawCashDelta: Number(r.cash_movement || 0),
            unitsDelta: deltaSec !== 0 ? `${deltaSec > 0 ? "+" : ""}${deltaSec.toLocaleString()} units` : "0 units",
            rawUnitsDelta: deltaSec,
            status: r.reconciled ? "Settled" : "Exception",
          };
        });
        setImpacts(mapped);
      }
    } catch (err) {
      console.error("Failed to load impact analysis data:", err);
      setImpacts([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleExport = () => {
    const headers = [
      "Event",
      "Type",
      "Portfolio",
      "Holding",
      "Before Cash",
      "After Cash",
      "Net Cash Delta",
      "Share Impact",
      "Status",
    ];
    const rows = filtered.map((r) => [
      r.action,
      r.type,
      r.portfolio,
      r.holding,
      r.beforeCash,
      r.afterCash,
      r.cashDelta,
      r.unitsDelta,
      r.status,
    ]);
    exportToCsv("Portfolio_Impact_Analysis", headers, rows);
    setExported(true);
    setTimeout(() => setExported(false), 3500);
  };

  const filtered = impacts.filter((item) => {
    const portMatch =
      selectedPortfolio === "All" || item.portfolioId === selectedPortfolio || item.portfolio.includes(selectedPortfolio);
    const actionMatch =
      selectedActionType === "All" || item.type === selectedActionType || item.rawActionType.toLowerCase().includes(selectedActionType.toLowerCase());
    return portMatch && actionMatch;
  });

  const uniquePortfolios = new Set(filtered.map((i) => i.portfolioId)).size;
  const netCashMovement = filtered.reduce((sum, i) => sum + i.rawCashDelta, 0);
  const unitsDistributed = filtered.reduce((sum, i) => sum + (i.rawUnitsDelta > 0 ? i.rawUnitsDelta : 0), 0);
  const reconciledCount = filtered.filter((i) => i.status === "Settled").length;
  const matchRate = filtered.length > 0 ? Math.round((reconciledCount / filtered.length) * 100) : 100;

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1500px]">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#126b45]">
              Analyst Workspace
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#123b28]">
              Portfolio Impact Simulation
            </h1>
            <p className="mt-1 text-xs text-[#7d9b8b]">
              Before and after positions, cash flow adjustments, and cost-basis realignment.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 rounded-xl border border-[#dceee3] bg-white px-3.5 py-2 text-xs font-bold text-[#5f786b] shadow-2xs transition hover:bg-[#edf8f1] hover:text-[#126b45]"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin text-[#126b45]" : ""} />
              <span>Refresh Calculation</span>
            </button>

            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-xl bg-[#126b45] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#0c5636]"
            >
              <Download size={14} />
              <span>Export Analysis</span>
            </button>
          </div>
        </div>

        {exported && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
            <CheckCircle2 size={16} />
            <span>Portfolio impact analysis CSV compiled and dispatched.</span>
          </div>
        )}

        {/* Filter Bar */}
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#dceee3] bg-white p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#7d9b8b]">
              <Filter size={14} />
              <span>Filter Scope:</span>
            </div>

            <select
              value={selectedPortfolio}
              onChange={(e) => setSelectedPortfolio(e.target.value)}
              className="h-9 rounded-xl border border-[#dceee3] bg-[#f8fcf9] px-3 text-xs font-semibold text-[#123b28] outline-none focus:border-[#126b45]"
            >
              <option value="All">All Portfolios</option>
              {portfoliosList.map((p) => (
                <option key={p.portfolio_id} value={p.portfolio_id}>
                  {p.portfolio_id} - {p.portfolio_name}
                </option>
              ))}
            </select>

            <select
              value={selectedActionType}
              onChange={(e) => setSelectedActionType(e.target.value)}
              className="h-9 rounded-xl border border-[#dceee3] bg-[#f8fcf9] px-3 text-xs font-semibold text-[#123b28] outline-none focus:border-[#126b45]"
            >
              <option value="All">All Action Types</option>
              <option value="DIV">Cash Dividend</option>
              <option value="SPL">Stock Split</option>
              <option value="BON">Bonus Issue</option>
              <option value="RIG">Rights Issue</option>
              <option value="MER">Merger</option>
            </select>
          </div>

          <span className="text-xs text-[#7d9b8b]">
            Showing <strong>{filtered.length}</strong> calculated impact events
          </span>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-[#dceee3] bg-white p-5 shadow-xs">
            <span className="text-[11px] font-semibold text-[#7d9b8b]">Affected Portfolios</span>
            <div className="mt-2 text-2xl font-bold text-[#123b28]">{uniquePortfolios}</div>
            <p className="mt-1 text-[11px] font-medium text-[#126b45]">Assigned to analyst</p>
          </div>

          <div className="rounded-2xl border border-[#dceee3] bg-white p-5 shadow-xs">
            <span className="text-[11px] font-semibold text-[#7d9b8b]">Net Cash Movement</span>
            <div className="mt-2 text-2xl font-bold text-[#126b45]">
              {netCashMovement >= 0 ? `+₹${netCashMovement.toLocaleString()}` : `-₹${Math.abs(netCashMovement).toLocaleString()}`}
            </div>
            <p className="mt-1 text-[11px] text-[#7d9b8b]">Net across portfolios</p>
          </div>

          <div className="rounded-2xl border border-[#dceee3] bg-white p-5 shadow-xs">
            <span className="text-[11px] font-semibold text-[#7d9b8b]">Units Distributed</span>
            <div className="mt-2 text-2xl font-bold text-[#123b28]">+{unitsDistributed.toLocaleString()}</div>
            <p className="mt-1 text-[11px] text-[#7d9b8b]">Corporate action allocations</p>
          </div>

          <div className="rounded-2xl border border-[#dceee3] bg-white p-5 shadow-xs">
            <span className="text-[11px] font-semibold text-[#7d9b8b]">Reconciliation Match</span>
            <div className="mt-2 text-2xl font-bold text-[#126b45]">{matchRate}%</div>
            <p className="mt-1 text-[11px] text-[#7d9b8b]">Zero fraction leakage</p>
          </div>
        </div>

        {/* Table */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-[#dceee3] bg-white shadow-xs">
          <div className="border-b border-[#dceee3] bg-[#f8fcf9] px-6 py-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#123b28]">
              Before & After Position Impact Breakdown
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#edf4ef] text-[10px] font-bold uppercase tracking-wider text-[#7d9b8b]">
                  <th className="px-6 py-3.5">Event</th>
                  <th className="px-6 py-3.5">Portfolio & Holding</th>
                  <th className="px-6 py-3.5">Cash (Before → After)</th>
                  <th className="px-6 py-3.5">Net Cash Impact</th>
                  <th className="px-6 py-3.5">Unit / Share Impact</th>
                  <th className="px-6 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf4ef]">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-[#7d9b8b]">
                      Loading calculated position impact from corporate actions ledger...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-[#7d9b8b]">
                      <p className="font-semibold text-[#173b2a]">No impact calculations found.</p>
                      <p className="text-[11px] mt-1">Processing corporate actions against portfolios generates position and balance adjustments.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.id} className="transition hover:bg-[#edf8f1]">
                      <td className="px-6 py-3.5 font-bold text-[#123b28]">
                        {row.action}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="block font-bold text-[#173b2a]">
                          {row.portfolio}
                        </span>
                        <span className="text-[11px] text-[#7d9b8b]">
                          {row.holding}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-[#5f786b]">
                        {row.beforeCash} → {row.afterCash}
                      </td>
                      <td className="px-6 py-3.5 font-mono font-bold text-[#126b45]">
                        {row.cashDelta}
                      </td>
                      <td className="px-6 py-3.5 font-medium text-[#173b2a]">
                        {row.unitsDelta}
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            row.status === "Settled"
                              ? "bg-[#e5f7eb] text-[#087443]"
                              : row.status === "Scheduled"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-[#fff7e6] text-[#b7791f]"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}