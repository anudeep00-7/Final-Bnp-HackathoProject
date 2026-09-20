import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BriefcaseBusiness,
  Search,
  Filter,
  ArrowUpRight,
  TrendingUp,
  Wallet,
  ShieldCheck,
  Download,
  Eye,
  CheckCircle2,
  X,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { exportToCsv } from "../../utils/exportCsv";
import { api } from "../../api/client";

export default function AdminPortfolios() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedPortfolio, setSelectedPortfolio] = useState(null);
  const [exportNotice, setExportNotice] = useState(false);

  const [portfoliosList, setPortfoliosList] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadLivePortfolios = async () => {
    setLoading(true);
    try {
      const liveData = await api.portfolios.getAll();
      if (Array.isArray(liveData)) {
        const mapped = liveData.map((p) => {
          const cashVal = p.total_cash != null ? p.total_cash : (p.cash_balances && p.cash_balances.USD) || 15000;
          const secVal = p.total_market_value != null ? p.total_market_value : cashVal * 3.5;
          const totalVal = cashVal + secVal;
          return {
            id: p.portfolio_id,
            name: p.portfolio_name || `Portfolio ${p.portfolio_id}`,
            manager: p.client_type === "INDIVIDUAL" ? "P. Anand (Analyst)" : "Institutional Ops",
            cash: `$${Number(cashVal).toLocaleString()}`,
            securities: `$${Number(secVal).toLocaleString()}`,
            value: `$${Number(totalVal).toLocaleString()}`,
            actionsCount: 2,
            status: "Active",
            custodian: "BNP Paribas Custody Paris",
            topHoldings: [],
            currency: p.currency || "USD",
            clientType: p.client_type || "INSTITUTIONAL",
          };
        });
        setPortfoliosList(mapped);
      }
    } catch (err) {
      console.warn("Error loading live portfolios:", err.message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadLivePortfolios();
  }, []);

  const handleSelectPortfolio = async (item) => {
    setSelectedPortfolio(item);
    try {
      const holdings = await api.portfolios.getHoldings(item.id);
      if (Array.isArray(holdings) && holdings.length > 0) {
        const top = holdings.map(
          (h) => `${h.name || h.security_id} (${h.qty} units @ $${h.latest_price || h.avg_cost})`
        );
        setSelectedPortfolio((prev) => ({
          ...prev,
          topHoldings: top,
        }));
      }
    } catch (err) {
      console.warn("Holdings fetch fallback:", err.message);
    }
  };

  const filtered = portfoliosList.filter(
    (p) =>
      p.id.toLowerCase().includes(search.toLowerCase()) ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.manager.toLowerCase().includes(search.toLowerCase())
  );

  const handleExportCsv = () => {
    const headers = [
      "Portfolio ID",
      "Fund Name",
      "Assigned Lead",
      "Cash Balance",
      "Security Holdings",
      "Total Asset Value",
      "Pending Actions",
      "Status",
      "Custodian Depository",
    ];
    const rows = filtered.map((p) => [
      p.id,
      p.name,
      p.manager,
      p.cash,
      p.securities,
      p.value,
      p.actionsCount,
      p.status,
      p.custodian,
    ]);
    exportToCsv("Master_Client_Portfolios", headers, rows);
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
                ALL PORTFOLIOS
              </span>
              <span className="text-xs text-[#88a395]">Enterprise Registry</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#123b28] sm:text-3xl">
              Client Portfolio Master
            </h1>
            <p className="mt-1 text-xs text-[#7d9b8b] sm:text-sm">
              Overview of all 24 institutionally managed portfolios, cash balances, and eligible securities.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-xl bg-[#126b45] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0c5636]"
            >
              <Download size={14} />
              <span>Export Portfolios Master</span>
            </button>
          </div>
        </div>

        {exportNotice && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800">
            <CheckCircle2 size={16} />
            <span>Master portfolio records exported to <strong>Master_Client_Portfolios.csv</strong>.</span>
          </div>
        )}

        {/* Search Toolbar */}
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-[#dceee3] bg-white p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-[#88a395]" />
            <input
              type="text"
              placeholder="Search portfolio by ID, name, or manager..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-xl border border-[#dceee3] bg-[#f8fcf9] pl-9 pr-3 text-xs outline-none focus:border-[#126b45]"
            />
          </div>

          <div className="text-xs text-[#7d9b8b]">
            Showing <strong>{filtered.length}</strong> active institutional portfolios
          </div>
        </div>

        {/* Table */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-[#dceee3] bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#edf4ef] bg-[#f8fcf9] text-[10px] font-bold uppercase tracking-wider text-[#7d9b8b]">
                  <th className="px-5 py-3.5">Portfolio ID</th>
                  <th className="px-5 py-3.5">Fund Name</th>
                  <th className="px-5 py-3.5">Assigned Lead</th>
                  <th className="px-5 py-3.5">Cash Balance</th>
                  <th className="px-5 py-3.5">Security Holdings</th>
                  <th className="px-5 py-3.5">Total Asset Value</th>
                  <th className="px-5 py-3.5">Upcoming Actions</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf4ef]">
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => handleSelectPortfolio(item)}
                    className="cursor-pointer transition hover:bg-[#edf8f1]"
                  >
                    <td className="px-5 py-3.5 font-mono font-bold text-[#123b28]">
                      {item.id}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-[#123b28]">
                      {item.name}
                    </td>
                    <td className="px-5 py-3.5 text-[#5f786b]">
                      {item.manager}
                    </td>
                    <td className="px-5 py-3.5 font-mono">
                      {item.cash}
                    </td>
                    <td className="px-5 py-3.5 font-mono">
                      {item.securities}
                    </td>
                    <td className="px-5 py-3.5 font-mono font-bold text-[#126b45]">
                      {item.value}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        {item.actionsCount} Actions
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectPortfolio(item);
                        }}
                        className="rounded-lg border border-[#dceee3] bg-white px-2.5 py-1 text-xs font-bold text-[#126b45] hover:bg-[#edf8f1]"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Portfolio Detail Modal */}
        {selectedPortfolio && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#123b28]/40 p-4 backdrop-blur-2xs">
            <div className="w-full max-w-lg rounded-2xl border border-[#dceee3] bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#edf4ef] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#126b45]">
                      {selectedPortfolio.id}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      {selectedPortfolio.status}
                    </span>
                  </div>
                  <h3 className="mt-1 text-base font-bold text-[#123b28]">
                    {selectedPortfolio.name}
                  </h3>
                </div>

                <button
                  onClick={() => setSelectedPortfolio(null)}
                  className="rounded-lg p-1 text-[#88a395] hover:bg-[#f0f7f3] hover:text-[#173b2a]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#f8fcf9] p-3.5">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#88a395]">Fund Manager</span>
                    <p className="mt-0.5 font-bold text-[#173b2a]">{selectedPortfolio.manager}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#88a395]">Depository Custodian</span>
                    <p className="mt-0.5 font-medium text-[#173b2a]">{selectedPortfolio.custodian}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#88a395]">Liquid Cash</span>
                    <p className="mt-0.5 font-mono font-bold text-[#173b2a]">{selectedPortfolio.cash}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#88a395]">Securities Value</span>
                    <p className="mt-0.5 font-mono font-bold text-[#173b2a]">{selectedPortfolio.securities}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-[#dceee3] p-3.5">
                  <span className="text-[10px] uppercase font-bold text-[#88a395]">Total Asset Under Management (AUM)</span>
                  <p className="mt-1 font-mono text-2xl font-bold text-[#126b45]">
                    {selectedPortfolio.value}
                  </p>
                </div>

                <div className="rounded-xl bg-[#f8fcf9] p-3.5 border border-[#edf4ef]">
                  <span className="text-[10px] uppercase font-bold text-[#88a395]">Core Portfolio Holdings</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(selectedPortfolio.topHoldings || []).length > 0 ? (
                      selectedPortfolio.topHoldings.map((h, i) => (
                        <span key={i} className="rounded-lg bg-white border border-[#dceee3] px-2.5 py-1 font-semibold text-[#173b2a]">
                          {h}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[#7d9b8b]">No active holdings recorded for this portfolio.</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  onClick={() => setSelectedPortfolio(null)}
                  className="rounded-xl border border-[#dceee3] px-4 py-2 text-xs font-bold text-[#5f786b] hover:bg-[#edf8f1]"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setSelectedPortfolio(null);
                    navigate("/admin/corporate-actions");
                  }}
                  className="rounded-xl bg-[#126b45] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#0c5636]"
                >
                  Inspect Actions
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
