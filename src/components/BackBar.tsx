import Link from "next/link";

/** Kontextabhängige "Zurück"-Leiste für Detailseiten — Label und Ziel
 *  folgen der Herkunft (siehe lib/back-link.ts) statt fest auf "/" zu
 *  zeigen. */
export function BackBar({ label, href }: { label: string; href: string }) {
  return (
    <div className="border-b border-line bg-[var(--color-header)] px-[14px] py-[10px]">
      <Link
        href={href}
        className="text-[11.5px] uppercase tracking-[0.1em] text-amber transition hover:text-amber-hot"
      >
        ‹ {label}
      </Link>
    </div>
  );
}
