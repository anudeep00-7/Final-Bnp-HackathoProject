import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BriefcaseBusiness,
  Shield,
  Layers,
  ArrowRight,
  CheckCircle2,
  Lock,
  Sparkles,
  TrendingUp,
  BarChart3,
  Scale,
  RefreshCw,
  FileText,
  Check,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function LandingPage() {
  const navigate = useNavigate();
  const { login, switchRole } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    const res = login(username, password);
    if (res.success) {
      setModalOpen(false);
      if (res.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/analyst");
      }
    } else {
      setError(res.error);
    }
  };

  const directDemoLogin = (role) => {
    switchRole(role);
    if (role === "admin") {
      navigate("/admin/dashboard");
    } else {
      navigate("/analyst");
    }
  };

  return (
    <div className="min-h-screen bg-[#f4faf6] text-[#123b28]">
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 border-b border-[#dceee3] bg-white shadow-2xs">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#126b45] text-white shadow-md shadow-[#126b45]/20">
              <span className="text-base font-extrabold tracking-wider">BNP</span>
            </div>
            <div>
              <span className="block text-base font-bold tracking-tight text-[#123b28]">
                Corporate Actions Hub
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#79a68f]">
                BNP Paribas Operations Platform
              </span>
            </div>
          </div>

          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-xs font-bold text-[#5f786b] hover:text-[#126b45]">
              Capabilities
            </a>
            <a href="#workflow" className="text-xs font-bold text-[#5f786b] hover:text-[#126b45]">
              7-Step Workflow
            </a>
            <a href="#actions" className="text-xs font-bold text-[#5f786b] hover:text-[#126b45]">
              Actions Supported
            </a>
            <a href="#roles" className="text-xs font-bold text-[#5f786b] hover:text-[#126b45]">
              Admin vs Analyst
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#126b45] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0c5636]"
            >
              <Lock size={14} />
              <span>Workspace Sign In</span>
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-18 lg:pb-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#dceee3] bg-[#eaf6ef] px-3.5 py-1 text-xs font-bold text-[#126b45]">
                <span className="h-2 w-2 rounded-full bg-[#126b45]" />
                Institutional Corporate Actions Processing & Reconciliation
              </div>

              <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-[#123b28] sm:text-5xl lg:text-6xl">
                Deterministic Processing.{" "}
                <span className="text-[#126b45]">
                  Zero Discrepancy.
                </span>
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#5f786b] sm:text-lg">
                Consolidates <strong>Admin Operations</strong> (entitlement execution, custodian ledger reconciliation, WORM audit trails) and <strong>Portfolio Analyst Insights</strong> (impact simulation, voluntary elections, settlements) into one unified BNP Paribas green & white platform.
              </p>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => directDemoLogin("admin")}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#126b45] px-6 py-3.5 text-xs font-bold text-white shadow-md shadow-[#126b45]/20 transition hover:bg-[#0c5636]"
                >
                  <Shield size={16} />
                  <span>Launch Admin Workspace</span>
                </button>

                <button
                  onClick={() => directDemoLogin("analyst")}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#dceee3] bg-white px-6 py-3.5 text-xs font-bold text-[#123b28] shadow-xs transition hover:border-[#126b45] hover:bg-[#f4faf6]"
                >
                  <BarChart3 size={16} className="text-[#126b45]" />
                  <span>Launch Analyst Workspace</span>
                </button>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-6 border-t border-[#dceee3] pt-6 text-xs font-medium text-[#7d9b8b]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#126b45]" />
                  <span>Automated custodian reconciliation</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#126b45]" />
                  <span>Immutable audit compliance trail</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#126b45]" />
                  <span>Voluntary action liquidity checks</span>
                </div>
              </div>
            </div>

            {/* LIVE DASHBOARD CARD PREVIEW */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-[#dceee3] bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-[#edf4ef] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#126b45]" />
                    <span className="text-xs font-bold text-[#123b28]">
                      Global Operations Monitor
                    </span>
                  </div>
                  <span className="rounded-md bg-[#e4f5e9] px-2 py-0.5 text-[10px] font-bold text-[#126b45]">
                    LIVE LEDGER
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-[#dceee3] bg-[#f8fcf9] p-3.5">
                      <span className="text-[11px] font-semibold text-[#82a090]">
                        Total Portfolios
                      </span>
                      <p className="mt-1 text-2xl font-bold text-[#123b28]">24</p>
                    </div>
                    <div className="rounded-xl border border-[#dceee3] bg-[#f8fcf9] p-3.5">
                      <span className="text-[11px] font-semibold text-[#82a090]">
                        Pending Actions
                      </span>
                      <p className="mt-1 text-2xl font-bold text-[#126b45]">8</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#dceee3] bg-[#f8fcf9] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <strong className="block text-xs font-bold text-[#173b2a]">
                          GlobalBank Corp
                        </strong>
                        <span className="text-[11px] text-[#88a395]">
                          CASH DIVIDEND · Ex-date: 15 May 2026
                        </span>
                      </div>
                      <span className="rounded-full bg-[#e5f7eb] px-2.5 py-0.5 text-[10px] font-extrabold text-[#087443]">
                        PROCESSED
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#dceee3] bg-[#f8fcf9] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <strong className="block text-xs font-bold text-[#173b2a]">
                          Vertex Technologies
                        </strong>
                        <span className="text-[11px] text-[#88a395]">
                          STOCK SPLIT (2:1) · Ex-date: 20 May 2026
                        </span>
                      </div>
                      <span className="rounded-full bg-[#fff7e6] px-2.5 py-0.5 text-[10px] font-extrabold text-[#b7791f]">
                        ACTIVE
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7-STEP WORKFLOW */}
      <section id="workflow" className="border-t border-[#dceee3] bg-white py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-[#126b45]">
              Deterministic Processing Pipeline
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#123b28]">
              End-to-End Corporate Action Lifecycle
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-xs text-[#7d9b8b]">
              Every event undergoes strict dual-control verification from dataset import through to ledger settlement.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
            {[
              { num: "01", name: "Import Data", desc: "Securities & positions CSV" },
              { num: "02", name: "Review Events", desc: "Corporate action ingest" },
              { num: "03", name: "Eligibility", desc: "Record date snapshot" },
              { num: "04", name: "Preview Impact", desc: "Balance simulation" },
              { num: "05", name: "Process", desc: "Deterministic execution" },
              { num: "06", name: "Reconcile", desc: "Expected vs actual delta" },
              { num: "07", name: "Audit Trail", desc: "Immutable compliance log" },
            ].map((s) => (
              <div
                key={s.num}
                className="rounded-2xl border border-[#dceee3] bg-[#f8fcf9] p-4 text-center transition hover:border-[#126b45] hover:bg-white hover:shadow-sm"
              >
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#e4f5e9] font-mono text-xs font-bold text-[#126b45]">
                  {s.num}
                </div>
                <h4 className="mt-3 text-xs font-bold text-[#123b28]">{s.name}</h4>
                <p className="mt-1 text-[11px] text-[#7d9b8b]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CORE CAPABILITIES */}
      <section id="features" className="border-t border-[#dceee3] py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-[#126b45]">
              Platform Architecture
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#123b28]">
              Built for High-Frequency Institutional Operations
            </h2>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Layers,
                title: "Dataset Ingestion & Validation",
                desc: "Ingest CSV/JSON files containing portfolios, positions, prices, cash balances, and notices with schema checking.",
              },
              {
                icon: BarChart3,
                title: "Portfolio Holdings Matrix",
                desc: "Live positions tracking across all funds with real-time mark-to-market calculations and custodian sync.",
              },
              {
                icon: TrendingUp,
                title: "Impact Previews",
                desc: "Simulate holding count changes, cash adjustments, cost basis recalculations, and ratio shifts before executing.",
              },
              {
                icon: Scale,
                title: "Voluntary Elections Engine",
                desc: "Interactive Rights Issue calculator supporting Full, Partial, and Decline options with automated cash checks.",
              },
              {
                icon: RefreshCw,
                title: "Reconciliation & Discrepancies",
                desc: "Continuous expected vs. actual balance checks. Automatic identification and 1-click resolution for exceptions.",
              },
              {
                icon: Shield,
                title: "Action Reversal & Audit",
                desc: "Reverse processed corporate actions with full state restoration and complete compliance logging.",
              },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="rounded-2xl border border-[#dceee3] bg-white p-6 shadow-xs transition hover:border-[#126b45] hover:shadow-md"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e4f5e9] text-[#126b45]">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-[#123b28]">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#5f786b]">
                    {f.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ACTIONS SUPPORTED SECTION */}
      <section id="actions" className="border-t border-[#dceee3] bg-white py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-[#126b45]">
              Full Asset Coverage
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#123b28]">
              All Mandatory & Voluntary Corporate Actions
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-xs text-[#7d9b8b]">
              Deterministic algorithmic calculation models handling fractional rounding, ledger synchronization, and tax withholding.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { code: "DIV", title: "Cash Dividend", desc: "Per-share cash payout calculated across record-date eligible holding units with zero rounding leakage." },
              { code: "SPL", title: "Stock Split", desc: "Sub-division of share capital with automatic unit scaling and proportionate cost-basis adjustments." },
              { code: "BON", title: "Bonus Issue", desc: "Capitalization of reserves via free share issuance proportional to existing shareholder positions." },
              { code: "RIG", title: "Rights Issue", desc: "Voluntary subscription entitlement with real-time cash balance verification and custodian dispatch." },
              { code: "NAM", title: "Name & Ticker", desc: "Corporate entity re-branding and ISIN / exchange symbol synchronization across portfolio registries." },
            ].map((action) => (
              <div key={action.code} className="rounded-2xl border border-[#dceee3] bg-[#f8fcf9] p-5 transition hover:border-[#126b45] hover:bg-white shadow-xs">
                <span className="rounded-lg bg-[#126b45] px-2.5 py-1 text-xs font-bold text-white">
                  {action.code}
                </span>
                <h3 className="mt-3 text-sm font-bold text-[#123b28]">{action.title}</h3>
                <p className="mt-1.5 text-xs text-[#5f786b] leading-relaxed">{action.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ADMIN VS ANALYST SECTION */}
      <section id="roles" className="border-t border-[#dceee3] py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-[#126b45]">
              Dual Persona Architecture
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#123b28]">
              Purpose-Built for Admin Operations & Portfolio Analysts
            </h2>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {/* Admin Workspace */}
            <div className="rounded-2xl border-2 border-[#126b45] bg-white p-7 shadow-md">
              <div className="flex items-center justify-between border-b border-[#edf4ef] pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#126b45] text-white">
                    <Shield size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#123b28]">Admin Operations Workspace</h3>
                    <p className="text-xs text-[#7d9b8b]">Central Custody & Processing Desk</p>
                  </div>
                </div>
                <span className="rounded-full bg-[#e4f5e9] px-3 py-1 text-xs font-bold text-[#126b45]">
                  Full Access
                </span>
              </div>

              <ul className="mt-5 space-y-3 text-xs text-[#5f786b]">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-[#126b45] shrink-0" />
                  <span>Batch dataset ingestion, CSV schema validation & duplicate notice quarantine</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-[#126b45] shrink-0" />
                  <span>Deterministic execution & 1-click stateful action reversals across all 24 portfolios</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-[#126b45] shrink-0" />
                  <span>Custodian reconciliation with zero-variance validation & 1-click exception syncing</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-[#126b45] shrink-0" />
                  <span>Immutable WORM-compliant compliance trail with cryptographic SHA checksums</span>
                </li>
              </ul>

              <div className="mt-6 pt-4 border-t border-[#edf4ef]">
                <button
                  onClick={() => directDemoLogin("admin")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#126b45] py-3 text-xs font-bold text-white shadow-xs transition hover:bg-[#0c5636]"
                >
                  <Shield size={15} />
                  <span>Launch Admin Workspace (admin/admin)</span>
                </button>
              </div>
            </div>

            {/* Analyst Workspace */}
            <div className="rounded-2xl border border-[#dceee3] bg-white p-7 shadow-md">
              <div className="flex items-center justify-between border-b border-[#edf4ef] pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e4f5e9] text-[#126b45]">
                    <BarChart3 size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#123b28]">Portfolio Analyst Workspace</h3>
                    <p className="text-xs text-[#7d9b8b]">Assigned Portfolio Management</p>
                  </div>
                </div>
                <span className="rounded-full bg-[#f0f7f3] px-3 py-1 text-xs font-bold text-[#5f786b]">
                  Portfolio Scope
                </span>
              </div>

              <ul className="mt-5 space-y-3 text-xs text-[#5f786b]">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-[#126b45] shrink-0" />
                  <span>Filtered view restricted strictly to assigned funds (P001, P002, P003)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-[#126b45] shrink-0" />
                  <span>Before-and-after position impact simulation with cash & share rebalancing</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-[#126b45] shrink-0" />
                  <span>Rights issue voluntary election dispatch with liquidity checks</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-[#126b45] shrink-0" />
                  <span>Settlement timeline tracking, scheduled cash credit notices & compliance reporting</span>
                </li>
              </ul>

              <div className="mt-6 pt-4 border-t border-[#edf4ef]">
                <button
                  onClick={() => directDemoLogin("analyst")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#dceee3] bg-white py-3 text-xs font-bold text-[#123b28] shadow-xs transition hover:border-[#126b45] hover:bg-[#edf8f1]"
                >
                  <BarChart3 size={15} className="text-[#126b45]" />
                  <span>Launch Analyst Workspace (analyst/analyst)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#dceee3] bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row lg:px-8">
          <p className="text-xs font-semibold text-[#7d9b8b]">
            © 2026 Corporate Actions Hub · BNP Paribas Operations Platform
          </p>
          <div className="flex items-center gap-4 text-xs font-bold text-[#126b45]">
            <button onClick={() => directDemoLogin("admin")} className="hover:underline">
              Admin Workspace
            </button>
            <span>·</span>
            <button onClick={() => directDemoLogin("analyst")} className="hover:underline">
              Analyst Workspace
            </button>
            <span>·</span>
            <button onClick={() => setModalOpen(true)} className="hover:underline">
              Sign In
            </button>
          </div>
        </div>
      </footer>

      {/* SIGN IN MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#123b28]/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#dceee3] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#edf4ef] pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#126b45] text-white">
                  <Lock size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#123b28]">
                    Workspace Sign In
                  </h3>
                  <p className="text-[11px] text-[#7d9b8b]">
                    BNP Paribas Corporate Actions Hub
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-xs font-bold text-[#88a395] hover:text-[#173b2a]"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-600">
                {error}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="mt-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#123b28]">Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin or analyst"
                  className="mt-1.5 h-10 w-full rounded-xl border border-[#dceee3] bg-[#f8fcf9] px-3 outline-none focus:border-[#126b45] focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-[#123b28]">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1.5 h-10 w-full rounded-xl border border-[#dceee3] bg-[#f8fcf9] px-3 outline-none focus:border-[#126b45] focus:bg-white"
                />
              </div>

              <button
                type="submit"
                className="flex h-11 w-full items-center justify-center rounded-xl bg-[#126b45] text-xs font-bold text-white shadow-md shadow-[#126b45]/20 transition hover:bg-[#0c5636]"
              >
                Sign In to Platform
              </button>
            </form>

            <div className="mt-5 rounded-xl border border-[#dceee3] bg-[#f8fcf9] p-3.5 text-center text-xs">
              <span className="font-bold text-[#123b28]">1-Click Demo Evaluation:</span>
              <div className="mt-2.5 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => directDemoLogin("admin")}
                  className="rounded-lg bg-[#126b45] px-3.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#0c5636]"
                >
                  Admin (admin/admin)
                </button>
                <button
                  type="button"
                  onClick={() => directDemoLogin("analyst")}
                  className="rounded-lg border border-[#dceee3] bg-white px-3.5 py-1.5 text-[11px] font-bold text-[#123b28] transition hover:border-[#126b45]"
                >
                  Analyst (analyst/analyst)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
