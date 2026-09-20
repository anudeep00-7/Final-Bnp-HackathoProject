import React, { useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Download,
  FileBarChart,
  FileText,
  Filter,
  CheckCircle2,
  Printer,
} from "lucide-react";

import DashboardLayout from "../../components/layout/DashboardLayout";
import { exportToCsv } from "../../utils/exportCsv";
import { api } from "../../api/client";

export default function Reports() {
  const [reportType, setReportType] = useState("Portfolio Impact Report");
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [selectedPortfolio, setSelectedPortfolio] = useState("P001");
  const [portfoliosList, setPortfoliosList] = useState([]);
  const [actionsList, setActionsList] = useState([]);
  const [reconsList, setReconsList] = useState([]);

  React.useEffect(() => {
    async function loadData() {
      try {
        const [portfolios, actions, recons] = await Promise.all([
          api.portfolios.getAll().catch(() => []),
          api.actions.getAll().catch(() => []),
          api.reconciliation.getAll().catch(() => []),
        ]);
        if (Array.isArray(portfolios) && portfolios.length > 0) {
          setPortfoliosList(portfolios);
          if (!portfolios.some((p) => p.portfolio_id === selectedPortfolio)) {
            setSelectedPortfolio(portfolios[0].portfolio_id);
          }
        }
        if (Array.isArray(actions)) setActionsList(actions);
        if (Array.isArray(recons)) setReconsList(recons);
      } catch (err) {
        console.error("Failed to load reports metadata:", err);
      }
    }
    loadData();
  }, []);

  const generatedReports = [
    {
      id: "REP-2026-001",
      title: "Portfolio Valuation & Entitlement Statement",
      type: "Portfolio Impact Report",
      generatedDate: "20 Sep 2026",
      format: "PDF / CSV",
      status: "Ready",
    },
    {
      id: "REP-2026-002",
      title: "Corporate Action Master Schedule",
      type: "Corporate Action Report",
      generatedDate: "20 Sep 2026",
      format: "CSV (250 KB)",
      status: "Ready",
    },
    {
      id: "REP-2026-003",
      title: "Reconciliation & Settlement Audit Trail",
      type: "Reconciliation Report",
      generatedDate: "20 Sep 2026",
      format: "PDF / CSV",
      status: "Ready",
    },
  ];

  const handleGenerate = (typeTitle) => {
    const selected = typeTitle || reportType;
    setReportType(selected);

    let headers = ["Record ID", "Entity / Holding", "Metric", "Amount / Value", "Audit Date"];
    let rows = [];

    if (selected.includes("Impact")) {
      headers = ["Portfolio ID", "Portfolio Name", "Base Currency", "Cash Balance", "Asset Value", "Total Valuation"];
      rows = portfoliosList.map((p) => [
        p.portfolio_id,
        p.portfolio_name,
        p.base_currency || "INR",
        `₹${Number(p.cash_balance || 0).toLocaleString()}`,
        `₹${Number(p.asset_value || 0).toLocaleString()}`,
        `₹${Number(p.total_value || 0).toLocaleString()}`,
      ]);
    } else if (selected.includes("Corporate Action")) {
      headers = ["Action ID", "Security", "Type", "Tier", "Ex-Date", "Record Date", "Cash Rate", "Status"];
      rows = actionsList.map((a) => [
        a.ca_id,
        a.security_name ? `${a.security_name} (${a.security_id})` : a.security_id,
        a.action_type,
        a.tier === 1 ? "Mandatory" : "Voluntary",
        a.ex_date,
        a.record_date || "—",
        a.cash_rate_per_share ? `₹${a.cash_rate_per_share}` : "—",
        a.status,
      ]);
    } else {
      headers = ["Processing ID", "Action ID", "Portfolio ID", "Status", "Observed Diff", "Expected Leakage", "Reconciliation Diff", "Reconciled"];
      rows = reconsList.map((r) => [
        r.processing_id,
        r.ca_id,
        r.portfolio_id,
        r.status,
        r.observed_difference ?? "0.00",
        r.expected_leakage ?? "0.00",
        r.reconciliation_difference ?? "0.00",
        r.reconciled ? "Pass" : "Fail",
      ]);
    }

    const safeFilename = selected.replace(/[^a-zA-Z0-9]/g, "_");
    exportToCsv(`BNP_Paribas_${safeFilename}`, headers, rows);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3500);
  };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      const blob = await api.reports.getPdfBlob(selectedPortfolio);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BNP_Paribas_${selectedPortfolio}_Impact_Report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("Could not download backend PDF report, fallback to live CSV:", err);
      handleGenerate();
    } finally {
      setPdfLoading(false);
    }
  };

  const filtered = generatedReports.filter((r) =>
    r.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
    r.type.toLowerCase().includes(filterQuery.toLowerCase())
  );

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
              Reports & Disclosures
            </h1>
            <p className="mt-1 text-xs text-[#7d9b8b]">
              Generate portfolio position impact and corporate action reconciliation reports.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={selectedPortfolio}
              onChange={(e) => setSelectedPortfolio(e.target.value)}
              className="h-10 rounded-xl border border-[#dceee3] bg-white px-3 text-xs text-[#173b2a] outline-none focus:border-[#126b45]"
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
              type="button"
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#126b45] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0c5636]"
            >
              <Download size={15} className={pdfLoading ? "animate-spin" : ""} />
              <span>{pdfLoading ? "Generating..." : "Download PDF Report"}</span>
            </button>
            <button
              type="button"
              onClick={() => handleGenerate()}
              className="inline-flex items-center gap-2 rounded-xl border border-[#dceee3] bg-white px-3.5 py-2.5 text-xs font-bold text-[#173b2a] shadow-xs hover:bg-[#edf8f1] transition"
            >
              <FileBarChart size={15} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Download Success Banner */}
        {downloadSuccess && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} />
              <span>{reportType} has been successfully generated and compiled for download.</span>
            </div>
            <span className="text-[11px] font-mono">Status: 200 OK</span>
          </div>
        )}

        {/* Report Types Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ReportType
            icon={FileBarChart}
            title="Portfolio Impact Report"
            description="Compare portfolio positions and values before and after corporate actions."
            active={reportType === "Portfolio Impact Report"}
            onClick={() => handleGenerate("Portfolio Impact Report")}
          />

          <ReportType
            icon={CalendarDays}
            title="Corporate Action Report"
            description="Review actions affecting assigned portfolios within a selected period."
            active={reportType === "Corporate Action Report"}
            onClick={() => handleGenerate("Corporate Action Report")}
          />

          <ReportType
            icon={BarChart3}
            title="Reconciliation Report"
            description="Review expected and actual settlement and reconciliation results."
            active={reportType === "Reconciliation Report"}
            onClick={() => handleGenerate("Reconciliation Report")}
          />
        </div>

        {/* Generated Reports Table */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-[#dceee3] bg-white shadow-xs">
          <div className="flex flex-col gap-3 border-b border-[#dceee3] px-6 py-4 sm:flex-row sm:items-center sm:justify-between bg-[#f8fcf9]">
            <div>
              <h2 className="text-sm font-bold text-[#123b28]">
                Generated Reports History
              </h2>
              <p className="mt-0.5 text-xs text-[#7d9b8b]">
                Previously compiled portfolio and corporate action disclosure files.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter reports..."
                className="h-9 rounded-xl border border-[#dceee3] bg-white px-3 text-xs outline-none focus:border-[#126b45]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#edf4ef] text-[10px] font-bold uppercase tracking-wider text-[#7d9b8b]">
                  <th className="px-6 py-3.5">Report ID</th>
                  <th className="px-6 py-3.5">Report Name</th>
                  <th className="px-6 py-3.5">Category</th>
                  <th className="px-6 py-3.5">Date Generated</th>
                  <th className="px-6 py-3.5">File Format</th>
                  <th className="px-6 py-3.5 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf4ef]">
                {filtered.map((item) => (
                  <tr key={item.id} className="transition hover:bg-[#edf8f1]">
                    <td className="px-6 py-3.5 font-mono font-bold text-[#123b28]">
                      {item.id}
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-[#173b2a]">
                      {item.title}
                    </td>
                    <td className="px-6 py-3.5 text-[#5f786b]">
                      {item.type}
                    </td>
                    <td className="px-6 py-3.5 text-[#7d9b8b]">
                      {item.generatedDate}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-[#5f786b]">
                      {item.format}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => handleGenerate(item.title)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#dceee3] bg-white px-3 py-1.5 text-xs font-bold text-[#126b45] transition hover:bg-[#edf8f1]"
                      >
                        <Download size={13} />
                        <span>Export</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function ReportType({ icon: Icon, title, description, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl border p-6 transition shadow-xs ${
        active
          ? "border-[#126b45] bg-[#edf8f1]/50"
          : "border-[#dceee3] bg-white hover:border-[#126b45] hover:shadow-md"
      }`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e4f5e9] text-[#126b45]">
        <Icon size={20} />
      </div>

      <h3 className="mt-4 text-sm font-bold text-[#123b28]">
        {title}
      </h3>

      <p className="mt-1.5 text-xs leading-5 text-[#5f786b]">
        {description}
      </p>

      <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#126b45]">
        <span>Generate now →</span>
      </span>
    </button>
  );
}