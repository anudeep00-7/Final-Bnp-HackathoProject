import React, { useState } from "react";
import {
  Bell,
  Check,
  ChevronRight,
  LockKeyhole,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  User,
  CheckCircle2,
  Save,
  KeyRound,
  ShieldAlert,
  Smartphone,
  X,
} from "lucide-react";

import DashboardLayout from "../../components/layout/DashboardLayout";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("Profile");
  const [savedNotice, setSavedNotice] = useState(null);
  const [showModal, setShowModal] = useState(null);

  const [profile, setProfile] = useState({
    name: "Corporate Analyst",
    role: "Portfolio Analyst",
    access: "Assigned Portfolios (P001, P002, P003)",
    status: "Active",
    email: "analyst@bnpparibas.internal",
    phone: "+91 98200 12345",
  });

  const [notifs, setNotifs] = useState({
    caAlerts: true,
    electionDeadlines: true,
    settlementDiscrepancies: true,
    dailyDigest: false,
  });

  const handleSaveProfile = (e) => {
    e.preventDefault();
    setSavedNotice("Profile changes saved successfully.");
    setTimeout(() => setSavedNotice(null), 3500);
  };

  const handleSecurityAction = (actionTitle) => {
    setShowModal(actionTitle);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1200px] p-5 md:p-7">
        {/* Header */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#126b45]">
            Analyst Workspace
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#123b28] sm:text-3xl">
            Settings & Preferences
          </h1>

          <p className="mt-1 text-xs text-[#7d9b8b] sm:text-sm">
            Manage your account credentials, notifications, and institutional security controls.
          </p>
        </div>

        {savedNotice && (
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 animate-fadeIn">
            <CheckCircle2 size={16} />
            <span>{savedNotice}</span>
          </div>
        )}

        {/* Layout */}
        <div className="mt-7 grid gap-6 lg:grid-cols-[240px_1fr]">
          {/* Settings navigation */}
          <aside className="h-fit rounded-2xl border border-[#dceee3] bg-white p-2.5 shadow-xs">
            {[
              { id: "Profile", label: "Profile Details", icon: User },
              { id: "Appearance", label: "Appearance & Theme", icon: Palette },
              { id: "Notifications", label: "Alerts & Notifications", icon: Bell },
              { id: "Security", label: "Security & 2FA", icon: ShieldCheck },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-xs font-bold transition ${
                    active
                      ? "bg-[#126b45] text-white shadow-xs"
                      : "text-[#5f786b] hover:bg-[#edf8f1] hover:text-[#126b45]"
                  }`}
                >
                  <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
                  <span>{tab.label}</span>
                  {active && <ChevronRight size={14} className="ml-auto" />}
                </button>
              );
            })}
          </aside>

          {/* Settings content */}
          <div className="space-y-6">
            {/* PROFILE TAB */}
            {activeTab === "Profile" && (
              <section className="overflow-hidden rounded-2xl border border-[#dceee3] bg-white shadow-xs">
                <SectionHeader
                  icon={User}
                  title="Analyst Profile"
                  description="Your institutional account information and assigned scope."
                />

                <form onSubmit={handleSaveProfile} className="p-6">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center border-b border-[#edf4ef] pb-6">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#126b45] text-lg font-bold text-white shadow-xs">
                      PA
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-[#123b28]">
                        {profile.name}
                      </h3>
                      <p className="text-xs text-[#7d9b8b]">
                        {profile.role} · Corporate Actions Desk
                      </p>
                      <span className="mt-1.5 inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                        {profile.status}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wide text-[#88a395]">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={profile.name}
                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                        className="mt-1.5 h-10 w-full rounded-xl border border-[#dceee3] bg-[#f8fcf9] px-3 text-xs font-semibold text-[#123b28] outline-none focus:border-[#126b45] focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wide text-[#88a395]">
                        Corporate Email
                      </label>
                      <input
                        type="email"
                        value={profile.email}
                        onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                        className="mt-1.5 h-10 w-full rounded-xl border border-[#dceee3] bg-[#f8fcf9] px-3 text-xs font-semibold text-[#123b28] outline-none focus:border-[#126b45] focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wide text-[#88a395]">
                        Role Clearance
                      </label>
                      <input
                        type="text"
                        disabled
                        value={profile.role}
                        className="mt-1.5 h-10 w-full rounded-xl border border-[#dceee3] bg-[#f0f7f3] px-3 text-xs font-semibold text-[#5f786b] outline-none cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wide text-[#88a395]">
                        Assigned Portfolios Scope
                      </label>
                      <input
                        type="text"
                        disabled
                        value={profile.access}
                        className="mt-1.5 h-10 w-full rounded-xl border border-[#dceee3] bg-[#f0f7f3] px-3 text-xs font-semibold text-[#5f786b] outline-none cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-xl bg-[#126b45] px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0c5636]"
                    >
                      <Save size={14} />
                      <span>Save Changes</span>
                    </button>
                  </div>
                </form>
              </section>
            )}

            {/* APPEARANCE TAB */}
            {activeTab === "Appearance" && (
              <section className="overflow-hidden rounded-2xl border border-[#dceee3] bg-white shadow-xs">
                <SectionHeader
                  icon={Palette}
                  title="Appearance & Theme"
                  description="Institutional visual configuration for BNP Paribas Hackathon standard."
                />

                <div className="p-6 space-y-4">
                  <div className="rounded-2xl border-2 border-[#126b45] bg-[#edf8f1] p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#126b45] text-white">
                          <Sun size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#123b28]">
                            BNP Paribas Corporate Green & White (Active)
                          </p>
                          <p className="text-xs text-[#5f786b]">
                            Clean, high-contrast light mode with #126b45 primary brand styling.
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-[#126b45] px-3 py-1 text-xs font-bold text-white">
                        ✓ Enforced
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#dceee3] bg-[#f8fcf9] p-4 text-xs text-[#5f786b]">
                    <p className="font-bold text-[#123b28]">Permanent Light Theme Policy</p>
                    <p className="mt-1">
                      Per institutional banking specifications, dark mode has been disabled across all analyst and admin portals for uniform compliance presentation.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* NOTIFICATIONS TAB */}
            {activeTab === "Notifications" && (
              <section className="overflow-hidden rounded-2xl border border-[#dceee3] bg-white shadow-xs">
                <SectionHeader
                  icon={Bell}
                  title="Alerts & Notification Preferences"
                  description="Configure real-time threshold notifications for voluntary actions and settlements."
                />

                <div className="p-6 space-y-4 text-xs divide-y divide-[#edf4ef]">
                  {[
                    { key: "caAlerts", title: "Corporate Action Announcements", desc: "Get real-time alerts when new events are published for your assigned portfolios." },
                    { key: "electionDeadlines", title: "Voluntary Election Deadlines", desc: "Urgent reminders 48h and 24h prior to rights issue and tender offer cutoffs." },
                    { key: "settlementDiscrepancies", title: "Settlement & Variance Flags", desc: "Instant notice if actual custodian credit differs from expected calculation." },
                    { key: "dailyDigest", title: "Morning Operations Digest", desc: "Automated 08:30 IST summary email of daily entitlements and settlements." },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between pt-4 first:pt-0">
                      <div>
                        <p className="font-bold text-[#123b28] text-sm">{item.title}</p>
                        <p className="text-xs text-[#7d9b8b] mt-0.5">{item.desc}</p>
                      </div>
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          checked={notifs[item.key]}
                          onChange={(e) => {
                            setNotifs({ ...notifs, [item.key]: e.target.checked });
                            setSavedNotice("Notification preference updated.");
                            setTimeout(() => setSavedNotice(null), 2500);
                          }}
                          className="peer sr-only"
                        />
                        <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#126b45] peer-checked:after:translate-x-full" />
                      </label>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* SECURITY TAB */}
            {activeTab === "Security" && (
              <section className="overflow-hidden rounded-2xl border border-[#dceee3] bg-white shadow-xs">
                <SectionHeader
                  icon={ShieldCheck}
                  title="Security & Access Controls"
                  description="Manage password credentials, two-factor authentication, and active sessions."
                />

                <div className="divide-y divide-[#edf4ef]">
                  <ActionRow
                    title="Change Analyst Password"
                    description="Last changed 34 days ago. Enforces 12-character alphanumeric complexity."
                    action="Update Password"
                    onClick={() => handleSecurityAction("Change Password")}
                  />

                  <ActionRow
                    title="Two-Factor Authentication (2FA)"
                    description="Hardware token or TOTP authenticator app verification on login."
                    action="Manage 2FA"
                    onClick={() => handleSecurityAction("Manage 2FA")}
                  />

                  <ActionRow
                    title="Active Workspace Sessions"
                    description="Logged in on current browser (macOS · Chrome / Safari). 1 active device."
                    action="Revoke Sessions"
                    onClick={() => handleSecurityAction("Revoke Sessions")}
                  />
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Security Action Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#123b28]/40 p-4 backdrop-blur-2xs">
            <div className="w-full max-w-md rounded-2xl border border-[#dceee3] bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#edf4ef] pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e4f5e9] text-[#126b45]">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#123b28]">{showModal}</h3>
                    <p className="text-xs text-[#7d9b8b]">Institutional Security Policy</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowModal(null)}
                  className="rounded-lg p-1 text-[#88a395] hover:bg-[#f0f7f3] hover:text-[#173b2a]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 space-y-4 text-xs">
                {showModal === "Change Password" ? (
                  <>
                    <div>
                      <label className="font-bold text-[#123b28]">Current Password</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        className="mt-1 h-9 w-full rounded-xl border border-[#dceee3] bg-[#f8fcf9] px-3 outline-none focus:border-[#126b45]"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-[#123b28]">New Secure Password</label>
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        className="mt-1 h-9 w-full rounded-xl border border-[#dceee3] bg-[#f8fcf9] px-3 outline-none focus:border-[#126b45]"
                      />
                    </div>
                  </>
                ) : showModal === "Manage 2FA" ? (
                  <div className="rounded-xl bg-[#f8fcf9] p-4 border border-[#dceee3]">
                    <div className="flex items-center gap-3">
                      <Smartphone size={24} className="text-[#126b45]" />
                      <div>
                        <p className="font-bold text-[#123b28]">TOTP Authenticator Active</p>
                        <p className="text-[11px] text-[#7d9b8b]">Google / Microsoft Authenticator linked.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-amber-50 p-4 text-amber-800">
                    <p className="font-bold">Revoke other active sessions?</p>
                    <p className="mt-1 text-[11px]">This will sign out all other devices and keep only this session active.</p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  onClick={() => setShowModal(null)}
                  className="rounded-xl border border-[#dceee3] px-4 py-2 text-xs font-bold text-[#5f786b] hover:bg-[#edf8f1]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowModal(null);
                    setSavedNotice(`${showModal} operation completed successfully.`);
                    setTimeout(() => setSavedNotice(null), 3000);
                  }}
                  className="rounded-xl bg-[#126b45] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#0c5636]"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3.5 border-b border-[#dceee3] bg-[#f8fcf9] px-6 py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f5ef] text-[#126b45]">
        <Icon size={19} />
      </div>

      <div>
        <h2 className="text-sm font-bold text-[#123b28]">
          {title}
        </h2>

        <p className="mt-0.5 text-xs text-[#7d9b8b]">
          {description}
        </p>
      </div>
    </div>
  );
}

function ActionRow({ title, description, action, onClick }) {
  return (
    <div className="flex items-center justify-between gap-5 px-6 py-4">
      <div>
        <p className="text-xs font-bold text-[#123b28]">
          {title}
        </p>

        <p className="mt-0.5 text-[11px] text-[#7d9b8b]">
          {description}
        </p>
      </div>

      <button
        type="button"
        onClick={onClick}
        className="shrink-0 rounded-xl border border-[#dceee3] bg-white px-3.5 py-2 text-xs font-bold text-[#126b45] transition hover:bg-[#edf8f1]"
      >
        {action}
      </button>
    </div>
  );
}
