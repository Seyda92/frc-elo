"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/login/actions";
import type { Role } from "@/lib/session";
import type { MatchSummary } from "@/db/types";
import { formatDateTime } from "@/lib/format";

const publicLinks = [
  { href: "/", label: "Leaderboard" },
  { href: "/spiele", label: "Spiele" },
];

type User = { username: string; role: Role };

export function SiteHeader({
  user,
  recentMatches,
  upcomingMatches,
}: {
  user: User | null;
  recentMatches: MatchSummary[];
  upcomingMatches: MatchSummary[];
}) {
  const pathname = usePathname();
  const links =
    user?.role === "admin" || user?.role === "owner"
      ? [...publicLinks, { href: "/admin", label: "Schiri" }]
      : publicLinks;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-asphalt/95 backdrop-blur-md">
      <div className="relative overflow-hidden">
        <div className="surface-leuchtturm pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="stripe-leuchtturm h-1.5 w-full" aria-hidden="true" />
      </div>
      <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-center gap-2 transition group-hover:opacity-90">
          <Image
            src="/logo.png"
            alt="1. FRC Flunky Reifen Club"
            width={44}
            height={44}
            className="h-9 w-9 sm:h-11 sm:w-11"
            priority
          />
          <span className="hidden text-xs uppercase tracking-[0.2em] text-foam-muted sm:inline">
            ELO
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/" || pathname.startsWith("/spieler")
                : link.href === "/spiele"
                  ? pathname.startsWith("/spiele") || pathname.startsWith("/spiel/")
                  : link.href === "/admin"
                    ? pathname.startsWith("/admin")
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

          <AktuellesDropdown recentMatches={recentMatches} upcomingMatches={upcomingMatches} />

          {user ? (
            <>
              <span className="hidden px-2 text-xs uppercase tracking-[0.14em] text-foam-muted sm:inline">
                {user.username}
              </span>
              <Link
                href="/passwort-aendern"
                className="min-h-10 border border-line px-3 py-2 text-xs uppercase tracking-[0.14em] text-foam-muted transition hover:border-amber hover:text-amber sm:px-4"
              >
                Passwort
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="min-h-10 border border-line px-3 py-2 text-xs uppercase tracking-[0.14em] text-foam-muted transition hover:border-amber hover:text-amber sm:px-4"
                >
                  Logout
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="min-h-10 border border-line px-3 py-2 text-xs uppercase tracking-[0.14em] text-foam-muted transition hover:border-amber hover:text-amber sm:px-4"
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

/** Auf jeder Seite abrufbare Kurzübersicht — die Startseite zeigt "Letzte
 *  Spiele"/"Nächstes Match" bereits als eigene Sektionen, aber nur dort.
 *  Kein Portal/Library nötig: absolut positioniertes Panel. Schließt sich
 *  über einen mousedown-Listener auf document statt onBlur — onBlur würde
 *  das Panel schon vor dem click-Event auf einem Link darin schließen und
 *  damit die Navigation verhindern (Blur feuert vor Click). */
function AktuellesDropdown({
  recentMatches,
  upcomingMatches,
}: {
  recentMatches: MatchSummary[];
  upcomingMatches: MatchSummary[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isEmpty = recentMatches.length === 0 && upcomingMatches.length === 0;

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`min-h-10 px-3 py-2 text-xs uppercase tracking-[0.14em] transition sm:px-4 ${
          open
            ? "bg-amber text-asphalt"
            : "border border-line text-foam-muted hover:border-amber hover:text-amber"
        }`}
      >
        Aktuelles
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 border border-amber bg-asphalt-raised shadow-lg">
          {isEmpty ? (
            <p className="px-4 py-4 text-sm text-foam-muted">Noch keine Spiele.</p>
          ) : (
            <>
              {upcomingMatches.length > 0 && (
                <div className="border-b border-line px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-amber">
                    Nächstes Match
                  </p>
                  {upcomingMatches.map((m) => (
                    <Link
                      key={m.id}
                      href={`/spiel/${m.id}`}
                      className="mt-1 block transition hover:text-amber"
                    >
                      <p className="text-xs text-foam-muted">{formatDateTime(m.playedAt)}</p>
                      <p className="font-display text-foam hover:text-amber">
                        {m.teamA.map((p) => p.name.split(" ")[0]).join(", ")} vs.{" "}
                        {m.teamB.map((p) => p.name.split(" ")[0]).join(", ")}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
              {recentMatches.length > 0 && (
                <div className="px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-foam-muted">
                    Letzte Spiele
                  </p>
                  <ul className="mt-1 space-y-2">
                    {recentMatches.map((m) => (
                      <li key={m.id}>
                        <Link href={`/spiel/${m.id}`} className="block transition hover:text-amber">
                          <p className="text-xs text-foam-muted">{formatDateTime(m.playedAt)}</p>
                          <p className="font-display text-foam hover:text-amber">{m.scoreLabel}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
