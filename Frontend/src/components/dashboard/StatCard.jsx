export default function StatCard({
  title,
  value,
  change,
  subtitle,
  icon: Icon,
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[#dceee3] bg-white p-5 shadow-xs transition hover:border-[#a9d7bb] hover:shadow-md">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e4f5e9] text-[#126b45]">
        <Icon size={22} />
      </div>

      <div className="min-w-0 flex-1">
        <span className="text-xs font-semibold text-[#82a090]">
          {title}
        </span>
        <h3 className="text-2xl font-bold text-[#123b28]">
          {value}
        </h3>
        <div className="mt-1 flex items-center gap-1.5 text-[11px]">
          <span className="font-bold text-[#126b45]">
            {change}
          </span>
          <span className="text-[#82a090]">
            {subtitle}
          </span>
        </div>
      </div>
    </div>
  );
}