"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Leaderboard" },
  { href: "/live", label: "Live" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-asphalt/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-display text-2xl tracking-tight text-amber transition group-hover:text-amber-hot sm:text-3xl">
            1. FRC
          </span>
          <span className="hidden text-xs uppercase tracking-[0.2em] text-foam-muted sm:inline">
            ELO
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/" || pathname.startsWith("/spieler")
                : pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`min-h-10 px-3 py-2 text-xs uppercase tracking-[0.14em] transition sm:px-4 ${
                  active
                    ? "bg-amber text-asphalt"
                    : "border border-line text-foam-muted hover:border-amber hover:text-amber"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
