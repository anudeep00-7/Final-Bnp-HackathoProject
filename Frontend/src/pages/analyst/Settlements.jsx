import React, { useState } from "react";
import {
  WalletCards,
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Eye,
  X,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { exportToCsv } from "../../utils/exportCsv";
import { api } from "../../api/client";

export default function AnalystSettlements() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [exportNotice, setExportNotice] = useState(false);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSettlements = async () => {
    setLoading(true);
    try {
      const data = await api.settlements.getAll();
      if (Array.isArray(data)) {
        const mapped = data.map((s) => ({
          id: `SET-${String(s.settlement_id).padStart(4, "0")}`,
          action: `${s.action_type || "Corporate Action"} (${s.security_name || s.symbol || s.security_id || "Asset"})`,
          portfolio: s.portfolio_name ? `${s.portfolio_id} - ${s.portfolio_name}` : s.portfolio_id,
          settlementDate: s.settlement_date ? new Date(s.settlement_date).toLocaleDateString() : (s.recognition_date || "Live"),
          type: s.settlement_type || (s.cash_movement !== 0 ? "Cash Settlement" : "Security Movement"),
          amount: s.cash_movement !== 0
            ? (s.cash_movement > 0 ? `+₹${s.cash_movement.toLocaleString()}` : `-₹${Math.abs(s.cash_movement).toLocaleString()}`)
            : `${s.quantity_movement > 0 ? "+" : ""}${s.quantity_movement.toLocaleString()} units`,
          status: s.status === "SETTLED" || s.status === "PROCESSED" ? "Settled" : s.status === "PENDING" ? "Scheduled" : s.status,
          clearingRef: `CLR-2026-${String(s.settlement_id + 90000)}`,
          custodian: "BNP Paribas Custody Mumbai",
          notes: `Leg: ${s.leg_code || "MAIN"}, Currency: ${s.currency || "INR"}. Processed under rule version 2.0.`,
        }));
        setSettlements(mapped);
      }
    } catch (err) {
      console.error("Failed to load settlements from database:", err);
      setSettlements([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadSettlements();
  }, []);

  const filtered = settlements.filter((item) => {
    const matchSearch =
      item.id.toLowerCase().includes(search.toLowerCase()) ||
      item.action.toLowerCase().includes(search.toLowerCase()) ||
      item.portfolio.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === "All" || item.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleExportCsv = () => {
    const headers = [
      "Settlement ID",
      "Corporate Action",
      "Portfolio",
      "Settlement Type",
      "Amount / Units",
      "Effective Date",
      "Clearing Ref",
      "Status",
    ];
    const rows = filtered.map((s) => [
      s.id,
      s.action,
      s.portfolio,
      s.type,
      s.amount,
      s.settlementDate,
      s.clearingRef,
      s.status,
    ]);
    exportToCsv("Settlements_And_Deliveries_Schedule", headers, rows);
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
              Cash & Securities
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#123b28] sm:text-3xl">
              Settlements & Deliveries
            </h1>
            <p className="mt-1 text-xs text-[#7d9b8b] sm:text-sm">
              Expected cash distributions and share deliveries arising from corporate actions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-xl bg-[#126b45] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0c5636]"
            >
              <Download size={14} />
              <span>Export Settlement Schedule</span>
            </button>
          </div>
        </div>

        {exportNotice && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800">
            <CheckCircle2 size={16} />
            <span>Settlement schedule exported to <strong>Settlements_And_Deliveries_Schedule.csv</strong>.</span>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-[#dceee3] bg-white p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-[#88a395]" />
            <input
              type="text"
              placeholder="Search settlements..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-xl border border-[#dceee3] bg-[#f8fcf9] pl-9 pr-3 text-xs outline-none focus:border-[#126b45]"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {["All", "Settled", "Scheduled", "Pending Election"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  statusFilter === st
                    ? "bg-[#126b45] text-white shadow-xs"
                    : "bg-[#f0f7f3] text-[#5f786b] hover:bg-[#dceee3]"
                }`}
              >
                {st === "All" ? "All Settlements" : st}
              </button>
            ))}
          </div>
        </div>

        {/* Settlements Table */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-[#dceee3] bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#edf4ef] bg-[#f8fcf9] text-[10px] font-bold uppercase tracking-wider text-[#7d9b8b]">
                  <th className="px-5 py-3.5">Settlement ID</th>
                  <th className="px-5 py-3.5">Corporate Action</th>
                  <th className="px-5 py-3.5">Portfolio</th>
                  <th className="px-5 py-3.5">Settlement Type</th>
                  <th className="px-5 py-3.5">Amount / Units</th>
                  <th className="px-5 py-3.5">Effective Date</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf4ef]">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-5 py-8 text-center text-[#7d9b8b]">
                      Loading real settlements from database corporate_actions.settlements...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-5 py-8 text-center text-[#7d9b8b]">
                      <p className="font-semibold text-[#173b2a]">No settlements found in database.</p>
                      <p className="text-[11px] mt-1">
                        Settlements and delivery legs are generated when corporate actions are processed against assigned portfolio holdings.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedSettlement(item)}
                      className="cursor-pointer transition hover:bg-[#edf8f1]"
                    >
                      <td className="px-5 py-3.5 font-mono font-bold text-[#123b28]">
                        {item.id}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-[#173b2a]">
                        {item.action}
                      </td>
                      <td className="px-5 py-3.5 text-[#5f786b]">
                        {item.portfolio}
                      </td>
                      <td className="px-5 py-3.5 text-[#7d9b8b]">
                        {item.type}
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold text-[#126b45]">
                        {item.amount}
                      </td>
                      <td className="px-5 py-3.5 text-[#7d9b8b]">
                        {item.settlementDate}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            item.status === "Settled"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.status === "Scheduled"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSettlement(item);
                          }}
                          className="rounded-lg border border-[#dceee3] bg-white px-2.5 py-1 text-xs font-bold text-[#126b45] hover:bg-[#edf8f1]"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Settlement Detail Modal */}
        {selectedSettlement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#123b28]/40 p-4 backdrop-blur-2xs">
            <div className="w-full max-w-lg rounded-2xl border border-[#dceee3] bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#edf4ef] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#126b45]">
                      {selectedSettlement.id}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      {selectedSettlement.status}
                    </span>
                  </div>
                  <h3 className="mt-1 text-base font-bold text-[#123b28]">
                    {selectedSettlement.action}
                  </h3>
                </div>

                <button
                  onClick={() => setSelectedSettlement(null)}
                  className="rounded-lg p-1 text-[#88a395] hover:bg-[#f0f7f3] hover:text-[#173b2a]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#f8fcf9] p-3.5">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#88a395]">Portfolio</span>
                    <p className="mt-0.5 font-bold text-[#173b2a]">{selectedSettlement.portfolio}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#88a395]">Settlement Type</span>
                    <p className="mt-0.5 font-bold text-[#173b2a]">{selectedSettlement.type}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#88a395]">Clearing Reference</span>
                    <p className="mt-0.5 font-mono text-[#173b2a]">{selectedSettlement.clearingRef}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#88a395]">Custodian</span>
                    <p className="mt-0.5 font-medium text-[#173b2a]">{selectedSettlement.custodian}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-[#dceee3] p-3.5">
                  <span className="text-[10px] uppercase font-bold text-[#88a395]">Total Value / Units Credited</span>
                  <p className="mt-1 font-mono text-xl font-bold text-[#126b45]">
                    {selectedSettlement.amount}
                  </p>
                </div>

                <p className="rounded-xl bg-[#f8fcf9] p-3 text-[11px] text-[#5f786b] border border-[#edf4ef]">
                  <strong className="text-[#123b28]">Settlement Notes:</strong> {selectedSettlement.notes}
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  onClick={() => setSelectedSettlement(null)}
                  className="rounded-xl bg-[#126b45] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#0c5636]"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
