import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Search,
  Shield,
  BarChart3,
  User,
  LogOut,
  ChevronDown,
  Menu,
  ExternalLink,
  Bot,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function Topbar({ onMenuClick }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, switchRole, logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const isAdminView = location.pathname.startsWith("/admin");
  const currentRole = user?.role || (isAdminView ? "admin" : "analyst");

  const handleRoleToggle = () => {
    if (isAdminView) {
      switchRole("analyst");
      navigate("/analyst");
    } else {
      switchRole("admin");
      navigate("/admin/dashboard");
    }
  };

  const handleSignOut = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-30 flex h-[76px] shrink-0 items-center justify-between border-b border-[#dceee3] bg-white px-5 sm:px-8 shadow-2xs">
      {/* Left side: Hamburger menu button + Greeting Header identical to the screenshot */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#dceee3] bg-[#f8fcf9] text-[#126b45] transition hover:bg-[#e7f6ec]"
          aria-label="Toggle Navigation"
        >
          <Menu size={22} />
        </button>

        <div>
          <h1 className="text-base font-bold text-[#123b28] sm:text-lg">
            Hello! Welcome Back, {isAdminView ? "Admin" : "Analyst"}
          </h1>
          <p className="text-xs text-[#7d9b8b]">
            {isAdminView
              ? "Manage corporate actions and portfolio operations."
              : "Monitor assigned holdings and portfolio impact."}
          </p>
        </div>
      </div>

      {/* Right side: Role Switcher + AI Shortcut + Notifications + Profile Badge */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Instant Role Switcher Toggle */}
        <div className="flex items-center rounded-xl border border-[#dceee3] bg-[#f4faf6] p-1">
          <button
            onClick={() => {
              if (!isAdminView) {
                switchRole("admin");
                navigate("/admin/dashboard");
              }
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              isAdminView
                ? "bg-[#126b45] text-white shadow-xs"
                : "text-[#5f7e70] hover:text-[#126b45]"
            }`}
          >
            <Shield size={13} />
            <span>Admin</span>
          </button>

          <button
            onClick={() => {
              if (isAdminView) {
                switchRole("analyst");
                navigate("/analyst");
              }
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              !isAdminView
                ? "bg-[#126b45] text-white shadow-xs"
                : "text-[#5f7e70] hover:text-[#126b45]"
            }`}
          >
            <BarChart3 size={13} />
            <span>Analyst</span>
          </button>
        </div>

        {/* Landing Page Link */}
        <Link
          to="/"
          title="View Landing Page"
          className="hidden items-center gap-1 rounded-xl border border-[#dceee3] bg-white px-3 py-2 text-xs font-semibold text-[#126b45] transition hover:bg-[#edf8f1] sm:flex"
        >
          <span>Landing</span>
          <ExternalLink size={12} />
        </Link>

        {/* Notifications Icon Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#dceee3] bg-[#f8fcf9] text-[#126b45] transition hover:bg-[#e7f6ec]"
            aria-label="Notifications"
          >
            <Bell size={19} />
            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-[#dceee3] bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#edf4ef] pb-2.5">
                <span className="text-xs font-bold text-[#123b28]">Operational Alerts</span>
                <span className="rounded-full bg-[#e4f5e9] px-2 py-0.5 text-[10px] font-bold text-[#126b45]">
                  2 Active
                </span>
              </div>
              <div className="mt-3 space-y-2.5 text-xs">
                <div className="rounded-xl border border-[#dceee3] bg-[#f8fcf9] p-3">
                  <p className="font-bold text-[#123b28]">Rights Issue Election Active</p>
                  <p className="mt-0.5 text-[11px] text-[#5f7e70]">
                    Cascade Materials (CA008) election open for portfolio P001.
                  </p>
                </div>
                <div className="rounded-xl border border-[#dceee3] bg-[#f8fcf9] p-3">
                  <p className="font-bold text-[#123b28]">Reconciliation Verified</p>
                  <p className="mt-0.5 text-[11px] text-[#5f7e70]">
                    GlobalBank Corp (CA001) ledger movements reconciled.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 rounded-xl border border-[#dceee3] bg-[#f8fcf9] px-3 py-2 text-xs font-bold text-[#123b28] transition hover:bg-[#e7f6ec]"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#126b45] text-[11px] font-bold text-white">
              {isAdminView ? "A" : "A"}
            </div>
            <span className="hidden sm:inline">{isAdminView ? "Admin" : "Analyst"}</span>
            <ChevronDown size={14} className="text-[#7d9b8b]" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-[#dceee3] bg-white py-2 shadow-xl">
              <div className="border-b border-[#edf4ef] px-4 py-2">
                <p className="text-xs font-bold text-[#123b28]">
                  {isAdminView ? "System Admin" : "Corporate Analyst"}
                </p>
                <p className="text-[10px] text-[#7d9b8b]">BNP Corporate Actions</p>
              </div>

              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  navigate(isAdminView ? "/admin/profile" : "/analyst/settings");
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-xs font-medium text-[#123b28] hover:bg-[#edf8f1]"
              >
                <User size={14} className="text-[#126b45]" />
                <span>Profile & Settings</span>
              </button>

              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  handleRoleToggle();
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-xs font-medium text-[#123b28] hover:bg-[#edf8f1]"
              >
                <Shield size={14} className="text-[#126b45]" />
                <span>Switch to {isAdminView ? "Analyst" : "Admin"}</span>
              </button>

              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  handleSignOut();
                }}
                className="flex w-full items-center gap-2 border-t border-[#edf4ef] px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}