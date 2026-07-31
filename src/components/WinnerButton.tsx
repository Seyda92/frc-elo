"use client";

export function WinnerButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-14 min-w-[10rem] px-5 py-3 font-display text-lg uppercase tracking-wide transition ${
        active
          ? "bg-amber text-asphalt"
          : "border border-line bg-rubber/40 text-foam hover:border-amber"
      }`}
    >
      {label}
    </button>
  );
}
