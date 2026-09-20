import React, { useState } from "react";
import {
  User,
  Mail,
  Phone,
  Shield,
  Save,
  CheckCircle2,
  Key,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";

export default function AdminProfile() {
  const [profile, setProfile] = useState({
    name: "System Administrator",
    email: "admin@corporateactions.internal",
    phone: "+91 98765 43210",
    role: "Administrator",
    department: "Corporate Actions Operations",
  });

  const [saved, setSaved] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1000px] p-5 md:p-7">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-[#126b45] px-2 py-0.5 text-[10px] font-bold text-white">
                ACCOUNT SETTINGS
              </span>
              <span className="text-xs text-[#88a395]">Security & Credentials</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#123b28] sm:text-3xl">
              Administrator Profile
            </h1>
            <p className="mt-1 text-xs text-[#7d9b8b] sm:text-sm">
              Manage operational profile details, security clearance, and contact configuration.
            </p>
          </div>
        </div>

        {saved && (
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800">
            <CheckCircle2 size={16} />
            <span>Administrator profile updated successfully.</span>
          </div>
        )}

        {/* Profile Card */}
        <div className="mt-6 rounded-2xl border border-[#dceee3] bg-white p-6 shadow-xs">
          <div className="flex items-center gap-4 border-b border-[#edf4ef] pb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#126b45] text-xl font-bold text-white">
              AU
            </div>
            <div>
              <h2 className="text-base font-bold text-[#123b28]">
                {profile.name}
              </h2>
              <p className="text-xs text-[#7d9b8b]">
                {profile.role} · {profile.department}
              </p>
              <span className="mt-1.5 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                Full Authorization Clearance
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-[#173b2a]">
                  Full Name
                </label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="mt-1.5 h-10 w-full rounded-lg border border-[#dceee3] bg-white px-3 text-xs outline-none focus:border-[#126b45]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#173b2a]">
                  Email Address
                </label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="mt-1.5 h-10 w-full rounded-lg border border-[#dceee3] bg-white px-3 text-xs outline-none focus:border-[#126b45]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#173b2a]">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="mt-1.5 h-10 w-full rounded-lg border border-[#dceee3] bg-white px-3 text-xs outline-none focus:border-[#126b45]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#173b2a]">
                  Department
                </label>
                <input
                  type="text"
                  value={profile.department}
                  onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                  className="mt-1.5 h-10 w-full rounded-lg border border-[#dceee3] bg-white px-3 text-xs outline-none focus:border-[#126b45]"
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-[#126b45] px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0c5636]"
              >
                <Save size={15} />
                <span>Save Profile Changes</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
