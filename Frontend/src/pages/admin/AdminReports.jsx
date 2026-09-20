import React, { useState, useEffect } from "react";
import {
  FileBarChart,
  Calendar,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  Printer,
  FileSpreadsheet,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { exportToCsv } from "../../utils/exportCsv";
import { api } from "../../api/client";

export default function AdminReports() {
  const [actionType, setActionType] = useState("All Actions");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [generated, setGenerated] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [selectedPortfolio, setSelectedPortfolio] = useState("P001");
  const [portfoliosList, setPortfoliosList] = useState([]);
  const [reportsData, setReportsData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [portfolios, recons] = await Promise.all([
          api.portfolios.getAll().catch(() => []),
          api.reconciliation.getAll().catch(() => []),
        ]);

        if (Array.isArray(portfolios) && portfolios.length > 0) {
          setPortfoliosList(portfolios);
          if (!portfolios.some((p) => p.portfolio_id === selectedPortfolio)) {
            setSelectedPortfolio(portfolios[0].portfolio_id);
          }
        }

        if (Array.isArray(recons) && recons.length > 0) {
          const mapped = recons.map((r) => {
            const deltaSec = (r.after_quantity || 0) - (r.before_quantity || 0);
            return {
              portfolio: r.portfolio_id,
              name: r.portfolio_name || `Portfolio ${r.portfolio_id}`,
              status: r.reconciled ? "Settled" : "Exception",
              cash: r.cash_movement ? (r.cash_movement >= 0 ? `+₹${r.cash_movement.toLocaleString()}` : `-₹${Math.abs(r.cash_movement).toLocaleString()}`) : "₹0",
              security: deltaSec !== 0 ? `${deltaSec > 0 ? "+" : ""}${deltaSec.toLocaleString()}` : "—",
              action: r.action_type || "Corporate Action",
              date: r.processed_at ? new Date(r.processed_at).toLocaleDateString() : "Live",
            };
          });
          setReportsData(mapped);
        } else if (Array.isArray(portfolios) && portfolios.length > 0) {
          const fallback = portfolios.map((p) => ({
            portfolio: p.portfolio_id,
            name: p.portfolio_name,
            status: "Settled",
            cash: `₹${Number(p.cash_balance || 0).toLocaleString()}`,
            security: `${p.positions?.length || 0} Assets`,
            action: "Portfolio Valuation",
            date: "Live",
          }));
          setReportsData(fallback);
        }
      } catch (err) {
        console.error("Failed to load reporting data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filtered = reportsData.filter((report) => {
    const actionMatch =
      actionType === "All Actions" || report.action.toLowerCase().includes(actionType.toLowerCase());
    const statusMatch =
      statusFilter === "All Status" || report.status === statusFilter;
    return actionMatch && statusMatch;
  });

  const handleExport = () => {
    const headers = [
      "Portfolio ID",
      "Fund Name",
      "Corporate Action",
      "Net Cash Movement",
      "Security Movement",
      "Settlement Date",
      "Status",
    ];
    const rows = filtered.map((r) => [
      r.portfolio,
      r.name,
      r.action,
      r.cash,
      r.security,
      r.date,
      r.status,
    ]);
    exportToCsv("Admin_Settlement_Performance_Report", headers, rows);
    setGenerated(true);
    setTimeout(() => setGenerated(false), 4000);
  };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      const blob = await api.reports.getPdfBlob(selectedPortfolio);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BNP_Paribas_${selectedPortfolio}_Corporate_Actions_Report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("Could not download backend PDF report, fallback to CSV:", err);
      handleExport();
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1500px] p-5 md:p-7">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-[#126b45] px-2 py-0.5 text-[10px] font-bold text-white">
                REPORTING ENGINE
              </span>
              <span className="text-xs text-[#88a395]">Settlement Ledger</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#123b28] sm:text-3xl">
              Reports & Performance Analytics
            </h1>
            <p className="mt-1 text-xs text-[#7d9b8b] sm:text-sm">
              Generate settlement summaries, reconciliations, and portfolio impact statements.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={selectedPortfolio}
              onChange={(e) => setSelectedPortfolio(e.target.value)}
              className="h-9 rounded-lg border border-[#dceee3] bg-white px-2.5 text-xs text-[#173b2a] outline-none focus:border-[#126b45]"
            >
              {portfoliosList.length > 0 ? (
                portfoliosList.map((p) => (
                  <option key={p.portfolio_id} value={p.portfolio_id}>
                    {p.portfolio_id} - {p.portfolio_name}
                  </option>
                ))
              ) : (
                <option value="P001">P001 - Institutional Growth Fund</option>
              )}
            </select>
            <button
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#126b45] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#0c5636]"
            >
              <Download size={14} className={pdfLoading ? "animate-spin" : ""} />
              <span>{pdfLoading ? "Generating..." : "Download PDF"}</span>
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-xl border border-[#dceee3] bg-white px-3.5 py-2 text-xs font-bold text-[#173b2a] shadow-xs hover:bg-[#edf8f1] transition"
            >
              <FileSpreadsheet size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Success toast */}
        {generated && (
          <div className="mt-6 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>Report successfully generated and downloaded for current filter scope.</span>
            </div>
            <button onClick={() => setGenerated(false)} className="text-xs">✕</button>
          </div>
        )}

        {/* Filters */}
        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-[#dceee3] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-[#88a395]">
              <Filter size={14} />
              <span>Filter Report:</span>
            </div>

            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="h-9 rounded-lg border border-[#dceee3] bg-white px-3 text-xs text-[#173b2a] outline-none focus:border-[#126b45]"
            >
              <option>All Actions</option>
              <option>Cash Dividend</option>
              <option>Bonus Issue</option>
              <option>Rights Issue</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-lg border border-[#dceee3] bg-white px-3 text-xs text-[#173b2a] outline-none focus:border-[#126b45]"
            >
              <option>All Status</option>
              <option>Settled</option>
              <option>Pending</option>
              <option>Exception</option>
            </select>
          </div>

          <div className="text-xs text-[#7d9b8b]">
            Showing <strong>{filtered.length}</strong> matching entries
          </div>
        </div>

        {/* Report Table */}
        <div className="mt-6 overflow-hidden rounded-xl border border-[#dceee3] bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#edf4ef] bg-[#f8fcf9]/70 text-[10px] font-bold uppercase tracking-wider text-[#7d9b8b]">
                  <th className="px-4 py-3">Portfolio Code</th>
                  <th className="px-4 py-3">Portfolio Name</th>
                  <th className="px-4 py-3">Corporate Action</th>
                  <th className="px-4 py-3">Cash Movement</th>
                  <th className="px-4 py-3">Security Movement</th>
                  <th className="px-4 py-3">Settlement Date</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-[#7d9b8b]">
                      Loading real portfolio and settlement performance data...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-[#7d9b8b]">
                      <p className="font-semibold text-[#173b2a]">No settlement entries found matching filter.</p>
                      <p className="text-[11px] mt-1">Processed corporate actions generate settlement performance records.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((item, idx) => (
                    <tr key={`${item.portfolio}-${idx}`} className="transition hover:bg-[#edf8f1]/80">
                      <td className="px-4 py-3 font-mono font-bold text-[#123b28]">
                        {item.portfolio}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#173b2a]">
                        {item.name}
                      </td>
                      <td className="px-4 py-3">
                        {item.action}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-[#126b45]">
                        {item.cash}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {item.security}
                      </td>
                      <td className="px-4 py-3 text-[#7d9b8b]">
                        {item.date}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            item.status === "Settled"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.status === "Pending"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {item.status}
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
