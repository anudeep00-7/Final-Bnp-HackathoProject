import { Inbox } from "lucide-react";

export default function EmptyState({
  icon: Icon = Inbox,
  title = "No data available",
  description = "There is currently no information to display.",
}) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-10 text-center">
      <div
        className="
          flex h-12 w-12 items-center justify-center
          rounded-lg
          bg-[#e8f5ef] text-[#126b45]
        "
      >
        <Icon size={21} strokeWidth={1.8} />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-[#123b28]">
        {title}
      </h3>

      <p className="mt-1 max-w-md text-xs leading-5 text-[#7d9b8b]">
        {description}
      </p>
    </div>
  );
}