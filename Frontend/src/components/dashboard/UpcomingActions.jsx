import React, { useState, useEffect } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";

const typeStyles = {
  DIV: "bg-emerald-50 text-emerald-700",
  SPL: "bg-blue-50 text-blue-700",
  BON: "bg-purple-50 text-purple-700",
  RIG: "bg-amber-50 text-amber-700",
  NAM: "bg-[#f0f7f3] text-[#173b2a]",
  ACT: "bg-[#e4f5e9] text-[#126b45]",
};

export default function UpcomingActions() {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadActions() {
      try {
        const data = await api.actions.getAll();
        if (Array.isArray(data)) {
          const mapped = data.slice(0, 5).map((a) => {
            const shortType = (a.action_type || "ACT").substring(0, 3).toUpperCase();
            return {
              id: a.ca_id,
              type: shortType,
              name: a.security_name || a.security_id,
              security: a.symbol || a.security_id,
              detail: `${a.action_type} · Ex-Date: ${a.ex_date}`,
              status: a.status,
              urgent: a.tier === 2 || a.status === "ACTIVE",
            };
          });
          setActions(mapped);
        }
      } catch (err) {
        console.error("Failed to load upcoming actions:", err);
      } finally {
        setLoading(false);
      }
    }
    loadActions();
  }, []);

  return (
    <section className="rounded-2xl border border-[#dceee3] bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#123b28]">
            Upcoming Corporate Actions
          </h2>

          <p className="mt-1 text-xs text-[#7d9b8b]">
            Live announcements requiring analyst review
          </p>
        </div>

        <Link
          to="/analyst/actions"
          className="flex items-center gap-1 text-xs font-semibold text-[#126b45] hover:underline"
        >
          View all
          <ArrowUpRight size={14} />
        </Link>
      </div>

      <div className="mt-5 divide-y divide-[#edf4ef]">
        {loading ? (
          <div className="py-4 text-center text-xs text-[#7d9b8b]">Loading live actions...</div>
        ) : actions.length === 0 ? (
          <div className="py-4 text-center text-xs text-[#7d9b8b]">No upcoming actions in database.</div>
        ) : (
          actions.map((action) => (
            <Link
              to={action.type === "RIG" ? "/analyst/elections" : "/analyst/actions"}
              key={action.id}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 transition hover:bg-[#f8fcf9] rounded-lg px-1.5"
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${typeStyles[action.type] || typeStyles.ACT}`}
              >
                {action.type}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-[#123b28]">
                  {action.name}
                </p>

                <p className="mt-0.5 truncate text-[11px] text-[#7d9b8b]">
                  {action.security} · {action.detail}
                </p>
              </div>

              <span
                className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold ${
                  action.status === "PROCESSED"
                    ? "bg-[#e5f7eb] text-[#087443]"
                    : action.urgent
                    ? "bg-amber-100 text-amber-800"
                    : "bg-[#f0f7f3] text-[#5f786b]"
                }`}
              >
                {action.status}
              </span>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
