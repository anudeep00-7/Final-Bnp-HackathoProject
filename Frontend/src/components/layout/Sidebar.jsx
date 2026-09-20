import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  BarChart3,
  Scale,
  WalletCards,
  FileBarChart,
  FileClock,
  ShieldCheck,
  RefreshCcw,
  Upload,
  Settings,
  LogOut,
  ArrowLeftRight,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, switchRole, logout } = useAuth();

  const isAdmin = location.pathname.startsWith("/admin");

  const adminNav = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
    { label: "Portfolio", icon: BriefcaseBusiness, path: "/admin/portfolio" },
    { label: "Corporate Actions", icon: FileText, path: "/admin/corporate-actions" },
    { label: "Elections", icon: Scale, path: "/admin/elections" },
    { label: "Reports", icon: FileBarChart, path: "/admin/reports" },
    { label: "Audits & Controls", icon: ShieldCheck, path: "/admin/audits-controls" },
    { label: "Reconciliation", icon: RefreshCcw, path: "/admin/reconciliation" },
    { label: "Import Dataset", icon: Upload, path: "/admin/import-dataset" },
  ];

  const analystNav = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/analyst" },
    { label: "My Portfolios", icon: BriefcaseBusiness, path: "/analyst/portfolios" },
    { label: "Corporate Actions", icon: CalendarDays, path: "/analyst/actions" },
    { label: "Impact Analysis", icon: BarChart3, path: "/analyst/impact" },
    { label: "Elections", icon: Scale, path: "/analyst/elections" },
    { label: "Settlements", icon: WalletCards, path: "/analyst/settlements" },
    { label: "Reports", icon: FileBarChart, path: "/analyst/reports" },
    { label: "Audit History", icon: FileClock, path: "/analyst/audit" },
  ];

  const activeNav = isAdmin ? adminNav : analystNav;

  const handleRoleToggle = () => {
    if (isAdmin) {
      switchRole("analyst");
      navigate("/analyst");
    } else {
      switchRole("admin");
      navigate("/admin/dashboard");
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-[#123b28]/40 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[#dceee3] bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-[76px] items-center border-b border-[#dceee3] px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#126b45] text-white shadow-md shadow-[#126b45]/20">
              <span className="text-base font-bold">CA</span>
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-[#123b28]">
                Corporate
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#79a68f]">
                {isAdmin ? "Admin Console" : "Analyst Portal"}
              </div>
            </div>
          </Link>
        </div>

        {/* User Info Badge */}
        <div className="mx-4 mt-4 rounded-xl border border-[#dceee3] bg-[#f8fcf9] p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e4f5e9] text-xs font-bold text-[#126b45]">
              {isAdmin ? "AU" : "AN"}
            </div>
            <div>
              <p className="text-xs font-bold text-[#123b28]">
                {isAdmin ? "Administrator" : "Corporate Analyst"}
              </p>
              <p className="text-[10px] text-[#79a68f]">
                {isAdmin ? "All 24 Portfolios" : "Assigned Funds"}
              </p>
            </div>
          </div>
          <button
            onClick={handleRoleToggle}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#dceee3] bg-white py-1.5 text-[11px] font-bold text-[#126b45] transition hover:bg-[#edf8f1]"
          >
            <ArrowLeftRight size={12} />
            <span>Switch to {isAdmin ? "Analyst" : "Admin"}</span>
          </button>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-1">
            {activeNav.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path;

              return (
                <Link
                  key={item.label}
                  to={item.path}
                  onClick={onClose}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                    active
                      ? "bg-[#126b45] text-white shadow-md shadow-[#126b45]/15"
                      : "text-[#5f786b] hover:bg-[#edf8f1] hover:text-[#126b45]"
                  }`}
                >
                  <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Bottom Section */}
        <div className="border-t border-[#dceee3] p-4">
          <Link
            to={isAdmin ? "/admin/profile" : "/analyst/settings"}
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-[#5f786b] hover:bg-[#edf8f1] hover:text-[#126b45]"
          >
            <Settings size={16} />
            <span>Settings & Profile</span>
          </Link>

          <button
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-[#7d9b8b] hover:bg-rose-50 hover:text-rose-600"
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}