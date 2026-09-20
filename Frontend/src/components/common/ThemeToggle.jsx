import React from "react";

export default function ThemeToggle() {
  // Theme toggle is replaced with a clean verified system indicator for BNP Paribas enterprise styling
  return (
    <div
      title="BNP Paribas Enterprise Mode"
      className="hidden sm:flex h-9 items-center gap-1.5 rounded-lg border border-[#dceee3] bg-white px-2.5 text-xs font-semibold text-[#126b45] shadow-2xs"
    >
      <span className="h-2 w-2 rounded-full bg-[#126b45]" />
      <span>BNP Clean Mode</span>
    </div>
  );
}