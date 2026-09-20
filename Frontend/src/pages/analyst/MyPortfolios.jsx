import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BriefcaseBusiness,
  Search,
  ArrowUpRight,
  TrendingUp,
  PieChart,
  Wallet,
  Download,
  Eye,
  CheckCircle2,
  X,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { exportToCsv } from "../../utils/exportCsv";
import { api } from "../../api/client";

export default function MyPortfolios() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedPortfolio, setSelectedPortfolio] = useState(null);
  const [exportNotice, setExportNotice] = useState(false);

  const [portfoliosList, setPortfoliosList] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadLivePortfolios = async () => {
    setLoading(true);
    try {
      const liveData = await api.portfolios.getAll();
      if (Array.isArray(liveData)) {
        const mapped = liveData.map((p, idx) => {
          const cash = p.total_cash != null ? p.total_cash : (p.cash_balances && p.cash_balances.USD) || 15000;
          const secVal = p.total_market_value != null ? p.total_market_value : cash * 3.5;
          const totalVal = cash + secVal;
          const cat = idx % 3 === 0 ? "Growth" : idx % 3 === 1 ? "Income" : "Balanced";
          return {
            id: p.portfolio_id,
            name: p.portfolio_name || `Portfolio ${p.portfolio_id}`,
            category: cat,
            holdingsCount: 3,
            cash: `$${Number(cash).toLocaleString()}`,
            invested: `$${Number(secVal).toLocaleString()}`,
            currentValue: `$${Number(totalVal).toLocaleString()}`,
            pnl: "+4.8%",
            upcomingAction: "Active Corporate Action",
            holdings: [],
            currency: p.currency || "USD",
          };
        });
        setPortfoliosList(mapped);
      }
    } catch (err) {
      console.warn("Error loading analyst portfolios:", err.message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadLivePortfolios();
  }, []);

  const handleInspectPortfolio = async (p) => {
    setSelectedPortfolio(p);
    try {
      const holdings = await api.portfolios.getHoldings(p.id);
      if (Array.isArray(holdings) && holdings.length > 0) {
        const mappedHoldings = holdings.map((h) => ({
          security: h.name || h.symbol || h.security_id,
          isin: h.security_id || "SEC",
          units: h.qty || 0,
          value: `$${(h.market_value || h.cost_basis || (h.qty * h.avg_cost)).toLocaleString()}`,
          caPending: h.unrealised_pnl > 0 ? "Reconciled" : "Review Due",
        }));
        setSelectedPortfolio((prev) => ({
          ...prev,
          holdings: mappedHoldings,
          holdingsCount: mappedHoldings.length,
        }));
      }
    } catch (err) {
      console.warn("Holdings fetch fallback:", err.message);
    }
  };

  const filtered = portfoliosList.filter((p) => {
    const matchSearch =
      p.id.toLowerCase().includes(search.toLowerCase()) ||
      p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat =
      selectedCategory === "All" || p.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const handleExportCsv = () => {
    const headers = [
      "Portfolio ID",
      "Fund Name",
      "Category",
      "Positions Count",
      "Liquid Cash",
      "Total Portfolio Value",
      "P&L",
      "Upcoming Action",
    ];
    const rows = filtered.map((p) => [
      p.id,
      p.name,
      p.category,
      p.holdingsCount,
      p.cash,
      p.currentValue,
      p.pnl,
      p.upcomingAction,
    ]);
    exportToCsv("Assigned_Portfolios_Summary", headers, rows);
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
              Assigned Accounts
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#123b28] sm:text-3xl">
              My Assigned Portfolios
            </h1>
            <p className="mt-1 text-xs text-[#7d9b8b] sm:text-sm">
              Manage allocations, monitor security performance, and anticipate corporate-action adjustments.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-xl bg-[#126b45] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0c5636]"
            >
              <Download size={14} />
              <span>Export Portfolios (.csv)</span>
            </button>
          </div>
        </div>

        {exportNotice && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800">
            <CheckCircle2 size={16} />
            <span>Portfolios summary exported successfully to <strong>Assigned_Portfolios_Summary.csv</strong>.</span>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-[#dceee3] bg-white p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-[#88a395]" />
            <input
              type="text"
              placeholder="Search assigned portfolios..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-xl border border-[#dceee3] bg-[#f8fcf9] pl-9 pr-3 text-xs outline-none focus:border-[#126b45]"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {["All", "Growth", "Income", "Balanced"].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  selectedCategory === cat
                    ? "bg-[#126b45] text-white shadow-xs"
                    : "bg-[#f0f7f3] text-[#5f786b] hover:bg-[#dceee3]"
                }`}
              >
                {cat === "All" ? "All Strategies" : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Portfolios Cards Grid */}
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="flex flex-col justify-between rounded-2xl border border-[#dceee3] bg-white p-6 shadow-xs transition hover:border-[#126b45] hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#126b45]">
                    {p.id}
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                    {p.pnl}
                  </span>
                </div>

                <h3 className="mt-3 text-lg font-bold text-[#123b28]">
                  {p.name}
                </h3>
                <p className="text-xs text-[#7d9b8b]">
                  {p.holdingsCount} active security positions
                </p>

                <div className="mt-5 space-y-2.5 border-t border-[#edf4ef] pt-4 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#7d9b8b]">Cash Available:</span>
                    <span className="font-mono font-semibold text-[#173b2a]">{p.cash}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7d9b8b]">Total Portfolio Value:</span>
                    <strong className="font-mono font-bold text-[#126b45]">
                      {p.currentValue}
                    </strong>
                  </div>
                  <div className="rounded-xl bg-[#f8fcf9] p-3 text-[11px] text-[#5f786b] border border-[#edf4ef]">
                    <strong className="text-[#123b28]">Upcoming Event:</strong> {p.upcomingAction}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 flex items-center gap-2 border-t border-[#edf4ef] pt-4">
                <button
                  onClick={() => setSelectedPortfolio(p)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#dceee3] bg-white py-2 text-xs font-bold text-[#123b28] transition hover:bg-[#edf8f1]"
                >
                  <Eye size={13} className="text-[#126b45]" />
                  <span>Inspect</span>
                </button>

                <button
                  onClick={() => navigate("/analyst/impact")}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#126b45] py-2 text-xs font-bold text-white transition hover:bg-[#0c5636]"
                >
                  <TrendingUp size={13} />
                  <span>Impact</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Portfolio Holdings Inspection Modal */}
        {selectedPortfolio && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#123b28]/40 p-4 backdrop-blur-2xs">
            <div className="w-full max-w-2xl rounded-2xl border border-[#dceee3] bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#edf4ef] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#126b45]">
                      {selectedPortfolio.id}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      {selectedPortfolio.pnl}
                    </span>
                  </div>
                  <h3 className="mt-1 text-lg font-bold text-[#123b28]">
                    {selectedPortfolio.name} · Holdings Breakdown
                  </h3>
                </div>

                <button
                  onClick={() => setSelectedPortfolio(null)}
                  className="rounded-lg p-1 text-[#88a395] hover:bg-[#f0f7f3] hover:text-[#173b2a]"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Holdings Table */}
              <div className="mt-4 overflow-hidden rounded-xl border border-[#dceee3]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f8fcf9] text-[10px] font-bold uppercase tracking-wider text-[#7d9b8b] border-b border-[#dceee3]">
                    <tr>
                      <th className="px-4 py-2.5">Security & ISIN</th>
                      <th className="px-4 py-2.5">Position</th>
                      <th className="px-4 py-2.5">Market Value</th>
                      <th className="px-4 py-2.5">Corporate Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf4ef]">
                    {selectedPortfolio.holdings.map((h) => (
                      <tr key={h.isin} className="hover:bg-[#edf8f1]">
                        <td className="px-4 py-3">
                          <p className="font-bold text-[#123b28]">{h.security}</p>
                          <p className="font-mono text-[10px] text-[#7d9b8b]">{h.isin}</p>
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-[#173b2a]">
                          {h.units.toLocaleString()} units
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-[#126b45]">
                          {h.value}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              h.caPending !== "None"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-[#f0f7f3] text-[#7d9b8b]"
                            }`}
                          >
                            {h.caPending}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-[#edf4ef] pt-4 text-xs">
                <div className="text-[#5f786b]">
                  Available Cash: <strong className="font-mono text-[#123b28]">{selectedPortfolio.cash}</strong> · Total: <strong className="font-mono text-[#126b45]">{selectedPortfolio.currentValue}</strong>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedPortfolio(null)}
                    className="rounded-xl border border-[#dceee3] px-4 py-2 text-xs font-bold text-[#5f786b] hover:bg-[#edf8f1]"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setSelectedPortfolio(null);
                      navigate("/analyst/impact");
                    }}
                    className="rounded-xl bg-[#126b45] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#0c5636]"
                  >
                    Simulate CA Impact
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
