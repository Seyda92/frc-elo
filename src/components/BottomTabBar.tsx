"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", glyph: "≡", label: "Rang", match: (p: string) => p === "/" || p.startsWith("/spieler") },
  { href: "/spiele", glyph: "⧗", label: "Spiele", match: (p: string) => p.startsWith("/spiele") || p.startsWith("/spiel/") },
  {
    href: "/live",
    glyph: "●",
    label: "Live",
    match: (p: string) => p.startsWith("/live") || /^\/admin\/spiele\/[^/]+\/bewerten/.test(p),
  },
  { href: "/mehr", glyph: "⋯", label: "Mehr", match: (p: string) => p.startsWith("/mehr") },
];

/** Mobile Bottom-Tab-Bar mit den vier Kernzielen der App. Desktop (≥ lg)
 *  behält vorerst die bestehende Top-Nav in SiteHeader — eine Desktop-
 *  Ansicht der Tab-Bar ist im Design-Handoff bewusst nicht entworfen. */
export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-[var(--color-nav)] lg:hidden"
      aria-label="Hauptnavigation"
    >
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[60px] flex-col items-center justify-center gap-[5px] border-t-[3px] text-[10px] uppercase tracking-[0.12em] transition ${
              active ? "border-amber text-amber" : "border-transparent text-foam-muted"
            }`}
          >
            <span className="font-display text-sm" aria-hidden="true">
              {tab.glyph}
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
