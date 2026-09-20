import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  CalendarDays,
  FileText,
  WalletCards,
  BriefcaseBusiness,
  CheckCircle2,
  Download,
} from "lucide-react";

import DashboardLayout from "../../components/layout/DashboardLayout";
import StatCard from "../../components/dashboard/StatCard";
import PortfolioValueChart from "../../components/dashboard/PortfolioValueChart";
import UpcomingActions from "../../components/dashboard/UpcomingActions";
import RecentImpacts from "../../components/dashboard/RecentImpacts";
import AIAssistantCard from "../../components/dashboard/AIAssistantCard";
import { api } from "../../api/client";
import { exportToCsv } from "../../utils/exportCsv";

export default function AnalystDashboard() {
  const navigate = useNavigate();
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [stats, setStats] = useState({
    portfolioValue: "₹0",
    portfolioChange: "+2.4%",
    cashBalance: "₹0",
    cashChange: "Active",
    upcomingActions: 0,
    pendingElections: 0,
    portfoliosList: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [portfolios, actions, elections] = await Promise.all([
          api.portfolios.getAll().catch(() => []),
          api.actions.getAll().catch(() => []),
          api.elections.getAll().catch(() => []),
        ]);

        const portList = Array.isArray(portfolios) ? portfolios : [];
        const actionList = Array.isArray(actions) ? actions : [];
        const electionList = Array.isArray(elections) ? elections : [];

        const totalVal = portList.reduce((sum, p) => sum + Number(p.total_value || p.asset_value || 0), 0);
        const totalCash = portList.reduce((sum, p) => sum + Number(p.cash_balance || 0), 0);
        const activeCount = actionList.filter((a) => a.status === "ACTIVE").length;
        const voluntaryCount = actionList.filter((a) => a.tier === 2).length;

        const formatCr = (num) => {
          if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)} Cr`;
          if (num >= 100000) return `₹${(num / 100000).toFixed(1)} L`;
          return `₹${num.toLocaleString()}`;
        };

        setStats({
          portfolioValue: formatCr(totalVal),
          portfolioChange: `+2.4% (${portList.length} Funds)`,
          cashBalance: formatCr(totalCash),
          cashChange: "Available",
          upcomingActions: activeCount,
          pendingElections: voluntaryCount > 0 ? voluntaryCount : electionList.length,
          portfoliosList: portList,
        });
      } catch (err) {
        console.error("Failed to load analyst dashboard stats:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const handleGenerateReport = () => {
    const headers = ["Metric", "Value", "Period / Change", "Status"];
    const rows = [
      ["Assigned Portfolio Value", stats.portfolioValue, stats.portfolioChange, "Active"],
      ["Liquid Cash Balance", stats.cashBalance, stats.cashChange, "Settled"],
      ["Upcoming Corporate Actions", stats.upcomingActions, `${stats.upcomingActions} Pending Review`, "Active"],
      ["Pending Client Elections", stats.pendingElections, "Action Required", "Active"],
      ["Active Portfolios Monitored", `${stats.portfoliosList.length} Portfolios`, "Full Coverage", "Compliant"],
    ];
    exportToCsv("BNP_Paribas_Analyst_Portfolio_Summary", headers, rows);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3500);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1500px]">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#123b28]">
              Good morning, <span className="text-[#126b45]">Analyst</span>
            </h2>
            <p className="mt-1 text-xs text-[#7d9b8b]">
              Here's the corporate actions status across your assigned portfolios.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateReport}
              className="inline-flex items-center gap-2 self-start rounded-xl bg-[#126b45] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0c5636]"
            >
              <Download size={15} />
              <span>Generate Portfolio Report</span>
            </button>
          </div>
        </div>

        {/* Download Success Banner */}
        {downloadSuccess && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-[#126b45]" />
              <span>
                Portfolio statement generated and exported to <strong>BNP_Paribas_Analyst_Portfolio_Summary.csv</strong>.
              </span>
            </div>
            <button
              onClick={() => navigate("/analyst/reports")}
              className="font-bold underline hover:text-[#126b45]"
            >
              View Reports Archive →
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link to="/analyst/portfolios" className="block transition hover:scale-[1.01]">
            <StatCard
              title="Assigned Portfolio Value"
              value={loading ? "..." : stats.portfolioValue}
              change={stats.portfolioChange}
              subtitle="aggregate asset valuation"
              icon={BriefcaseBusiness}
              accent="green"
            />
          </Link>

          <Link to="/analyst/settlements" className="block transition hover:scale-[1.01]">
            <StatCard
              title="Liquid Cash Balance"
              value={loading ? "..." : stats.cashBalance}
              change={stats.cashChange}
              subtitle="depository cash pool"
              icon={WalletCards}
              accent="green"
            />
          </Link>

          <Link to="/analyst/actions" className="block transition hover:scale-[1.01]">
            <StatCard
              title="Upcoming Corporate Actions"
              value={loading ? "..." : stats.upcomingActions}
              change={`${stats.upcomingActions} active`}
              subtitle="requiring review"
              icon={CalendarDays}
              accent="green"
            />
          </Link>

          <Link to="/analyst/elections" className="block transition hover:scale-[1.01]">
            <StatCard
              title="Pending Client Elections"
              value={loading ? "..." : stats.pendingElections}
              change="Action Required"
              subtitle="voluntary event instructions"
              icon={FileText}
              accent="green"
            />
          </Link>
        </div>

        {/* Charts & Actions Grid */}
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Main Chart */}
          <div className="xl:col-span-8">
            <PortfolioValueChart />
          </div>

          {/* Upcoming Actions */}
          <div className="xl:col-span-4">
            <UpcomingActions />
          </div>

          {/* Recent Impact Table */}
          <div className="xl:col-span-8">
            <RecentImpacts />
          </div>

          {/* AI Copilot */}
          <div className="xl:col-span-4">
            <AIAssistantCard />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
