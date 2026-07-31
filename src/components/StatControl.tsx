"use client";

export function StatControl({
  label,
  value,
  onInc,
  onDec,
  highlight,
  danger,
}: {
  label: string;
  value: number;
  onInc: () => void;
  onDec: () => void;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="border border-line bg-asphalt/60 p-2">
      <p className="text-center text-[0.65rem] uppercase tracking-[0.14em] text-foam-muted">
        {label}
      </p>
      <div className="mt-1 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={onDec}
          className="flex h-11 w-11 items-center justify-center bg-rubber text-xl text-foam-muted transition hover:text-foam"
          aria-label={`${label} verringern`}
        >
          −
        </button>
        <span
          className={`min-w-8 text-center font-display text-2xl ${
            danger ? "text-clay" : highlight ? "text-amber" : "text-foam"
          }`}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={onInc}
          className="flex h-11 w-11 items-center justify-center bg-rubber text-xl text-foam transition hover:bg-amber hover:text-asphalt"
          aria-label={`${label} erhöhen`}
        >
          +
        </button>
      </div>
    </div>
  );
}
