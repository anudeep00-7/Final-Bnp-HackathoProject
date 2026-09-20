import React, { useState, useEffect } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import StatusBadge from "../common/StatusBadge";

export default function RecentImpacts() {
  const [impacts, setImpacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadImpacts() {
      try {
        const data = await api.reconciliation.getAll();
        if (Array.isArray(data)) {
          const mapped = data.slice(0, 5).map((r, idx) => {
            const deltaSec = (r.after_quantity || 0) - (r.before_quantity || 0);
            return {
              id: r.processing_id || idx,
              date: r.processed_at ? new Date(r.processed_at).toLocaleDateString() : "Live",
              action: r.action_type || "Corporate Action",
              security: r.security_name ? `${r.security_name} (${r.symbol || r.ca_id})` : (r.symbol || "Security"),
              portfolio: r.portfolio_name ? `${r.portfolio_id} - ${r.portfolio_name}` : (r.portfolio_id || "P001"),
              impact: r.cash_movement !== 0
                ? (r.cash_movement > 0 ? `+₹${r.cash_movement.toLocaleString()}` : `-₹${Math.abs(r.cash_movement).toLocaleString()}`)
                : (deltaSec !== 0 ? `${deltaSec > 0 ? "+" : ""}${deltaSec.toLocaleString()} shares` : "0"),
              status: r.reconciled ? "Processed" : "Pending",
            };
          });
          setImpacts(mapped);
        }
      } catch (err) {
        console.error("Failed to load recent impacts:", err);
      } finally {
        setLoading(false);
      }
    }
    loadImpacts();
  }, []);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#dceee3] bg-white shadow-xs">
      <div className="flex items-center justify-between border-b border-[#dceee3] px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-[#123b28]">
            Recent Impact on Your Portfolios
          </h2>

          <p className="mt-1 text-xs text-[#7d9b8b]">
            Live processed corporate actions from PostgreSQL ledger
          </p>
        </div>

        <Link
          to="/analyst/impact"
          className="flex items-center gap-1 text-xs font-semibold text-[#126b45] hover:underline"
        >
          View all
          <ArrowUpRight size={14} />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left">
          <thead>
            <tr className="border-b border-[#edf4ef]">
              {[
                "Date",
                "Action",
                "Security",
                "Portfolio",
                "Impact",
                "Status",
              ].map((heading) => (
                <th
                  key={heading}
                  className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#88a395]"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="px-5 py-6 text-center text-xs text-[#7d9b8b]">
                  Loading recent portfolio adjustments...
                </td>
              </tr>
            ) : impacts.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-5 py-6 text-center text-xs text-[#7d9b8b]">
                  No processed corporate action impacts yet.
                </td>
              </tr>
            ) : (
              impacts.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[#edf4ef] last:border-0 hover:bg-[#edf8f1]/60 transition"
                >
                  <td className="px-5 py-3 text-xs text-[#5f786b]">
                    {item.date}
                  </td>

                  <td className="px-5 py-3 text-xs font-medium text-[#123b28]">
                    {item.action}
                  </td>

                  <td className="px-5 py-3 text-xs text-[#5f786b]">
                    {item.security}
                  </td>

                  <td className="px-5 py-3 text-xs text-[#5f786b]">
                    {item.portfolio}
                  </td>

                  <td className="px-5 py-3 text-xs font-mono font-bold text-[#126b45]">
                    {item.impact}
                  </td>

                  <td className="px-5 py-3">
                    <StatusBadge status={item.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
