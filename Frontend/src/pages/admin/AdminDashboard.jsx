import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BriefcaseBusiness,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  Bot,
  ArrowRight,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { api } from "../../api/client";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    portfolios: 0,
    pending: 0,
    processed: 0,
    exceptions: 0,
    newAnnouncements: 0,
    recentActions: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [portfolios, actions, recons] = await Promise.all([
          api.portfolios.getAll().catch(() => []),
          api.actions.getAll().catch(() => []),
          api.reconciliation.getAll().catch(() => []),
        ]);
        const portList = Array.isArray(portfolios) ? portfolios : [];
        const actionList = Array.isArray(actions) ? actions : [];
        const reconList = Array.isArray(recons) ? recons : [];

        const pending = actionList.filter((a) => a.status === "ACTIVE").length;
        const processed = actionList.filter((a) => a.status === "PROCESSED").length;
        const exceptions = reconList.filter((r) => r.reconciled === false).length;

        setStats({
          portfolios: portList.length,
          pending,
          processed,
          exceptions,
          newAnnouncements: pending,
          recentActions: actionList.slice(0, 5),
        });
      } catch (err) {
        console.error("Failed to load admin dashboard stats:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1500px]">
        {/* Page Title & Subtitle */}
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#123b28]">
              Dashboard
            </h2>
            <p className="mt-1 text-xs text-[#7d9b8b]">
              Overview of your corporate action operations across all {stats.portfolios} active portfolios.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/admin/corporate-actions"
              className="inline-flex items-center gap-2 rounded-xl bg-[#126b45] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#0c5636]"
            >
              <span>Manage Actions</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Total Portfolios */}
          <Link
            to="/admin/portfolios"
            className="flex items-center gap-4 rounded-2xl border border-[#dceee3] bg-white p-5 shadow-xs transition hover:border-[#126b45] hover:shadow-md cursor-pointer"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e4f5e9] text-[#126b45]">
              <BriefcaseBusiness size={22} />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#82a090]">
                Total Portfolios
              </span>
              <h3 className="text-2xl font-bold text-[#123b28]">
                {loading ? "..." : stats.portfolios}
              </h3>
            </div>
          </Link>

          {/* Card 2: Pending Actions */}
          <Link
            to="/admin/corporate-actions"
            className="flex items-center gap-4 rounded-2xl border border-[#dceee3] bg-white p-5 shadow-xs transition hover:border-[#126b45] hover:shadow-md cursor-pointer"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e4f5e9] text-[#126b45]">
              <Clock3 size={22} />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#82a090]">
                Pending Actions
              </span>
              <h3 className="text-2xl font-bold text-[#123b28]">
                {loading ? "..." : stats.pending}
              </h3>
            </div>
          </Link>

          {/* Card 3: Processed */}
          <Link
            to="/admin/corporate-actions"
            className="flex items-center gap-4 rounded-2xl border border-[#dceee3] bg-white p-5 shadow-xs transition hover:border-[#126b45] hover:shadow-md cursor-pointer"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e4f5e9] text-[#126b45]">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#82a090]">
                Processed
              </span>
              <h3 className="text-2xl font-bold text-[#123b28]">
                {loading ? "..." : stats.processed}
              </h3>
            </div>
          </Link>

          {/* Card 4: Exceptions */}
          <Link
            to="/admin/reconciliation"
            className="flex items-center gap-4 rounded-2xl border border-[#dceee3] bg-white p-5 shadow-xs transition hover:border-[#126b45] hover:shadow-md cursor-pointer"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e4f5e9] text-[#126b45]">
              <AlertTriangle size={22} />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#82a090]">
                Exceptions
              </span>
              <h3 className="text-2xl font-bold text-[#123b28]">
                {loading ? "..." : stats.exceptions}
              </h3>
            </div>
          </Link>
        </div>

        {/* Dashboard Grid Panels */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Left Panel: New Corporate Actions */}
          <div className="rounded-2xl border border-[#dceee3] bg-white p-6 shadow-xs lg:col-span-2">
            <div className="flex items-center justify-between border-b border-[#edf4ef] pb-4">
              <div>
                <h3 className="text-base font-bold text-[#173b2a]">
                  Live Corporate Actions
                </h3>
                <p className="mt-0.5 text-xs text-[#88a395]">
                  Real announcements from PostgreSQL ledger
                </p>
              </div>

              <Link
                to="/admin/corporate-actions"
                className="text-xs font-bold text-[#126b45] hover:underline"
              >
                View All →
              </Link>
            </div>

            <div className="divide-y divide-[#edf4ef]">
              {loading ? (
                <div className="py-6 text-center text-xs text-[#7d9b8b]">Loading live actions...</div>
              ) : stats.recentActions.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#7d9b8b]">No corporate actions available.</div>
              ) : (
                stats.recentActions.map((action) => (
                  <Link
                    to="/admin/corporate-actions"
                    key={action.ca_id}
                    className="flex items-center justify-between py-4 transition hover:bg-[#f8fcf9] rounded-xl px-2"
                  >
                    <div>
                      <strong className="block text-sm font-bold text-[#173b2a]">
                        {action.security_name || action.security_id}
                      </strong>
                      <span className="text-xs font-semibold text-[#88a395]">
                        {action.action_type} · Ex-Date: {action.ex_date}
                      </span>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-extrabold tracking-wider ${
                        action.status === "PROCESSED"
                          ? "bg-[#e5f7eb] text-[#087443]"
                          : action.status === "REVERSED"
                          ? "bg-slate-100 text-slate-700"
                          : action.status === "REJECTED"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-[#fff7e6] text-[#b7791f]"
                      }`}
                    >
                      {action.status}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Right Panel: Processing Summary */}
          <div className="rounded-2xl border border-[#dceee3] bg-white p-6 shadow-xs">
            <div className="border-b border-[#edf4ef] pb-4">
              <h3 className="text-base font-bold text-[#173b2a]">
                Processing Summary
              </h3>
              <p className="mt-0.5 text-xs text-[#88a395]">
                Current action status
              </p>
            </div>

            <div className="mt-2 divide-y divide-[#edf4ef]">
              <Link
                to="/admin/corporate-actions"
                className="flex items-center justify-between py-3.5 text-xs hover:bg-[#f8fcf9] px-2 rounded-lg transition"
              >
                <span className="text-[#668274] font-medium">Pending Processing</span>
                <strong className="text-sm font-bold text-[#126b45]">{loading ? "..." : stats.pending}</strong>
              </Link>

              <Link
                to="/admin/corporate-actions"
                className="flex items-center justify-between py-3.5 text-xs hover:bg-[#f8fcf9] px-2 rounded-lg transition"
              >
                <span className="text-[#668274] font-medium">Successfully Processed</span>
                <strong className="text-sm font-bold text-[#126b45]">{loading ? "..." : stats.processed}</strong>
              </Link>

              <Link
                to="/admin/reconciliation"
                className="flex items-center justify-between py-3.5 text-xs hover:bg-[#f8fcf9] px-2 rounded-lg transition"
              >
                <span className="text-[#668274] font-medium">Reconciliation Exceptions</span>
                <strong className="text-sm font-bold text-[#126b45]">{loading ? "..." : stats.exceptions}</strong>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
