"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";
import type { Role } from "@/lib/session";

const publicLinks = [
  { href: "/", label: "Leaderboard" },
  { href: "/spiele", label: "Spiele" },
];

type User = { username: string; role: Role };

export function SiteHeader({ user }: { user: User | null }) {
  const pathname = usePathname();
  const links =
    user?.role === "admin" || user?.role === "owner"
      ? [...publicLinks, { href: "/admin", label: "Schiri" }]
      : publicLinks;

  return (
    <header className="sticky top-0 z-40 overflow-hidden border-b border-line bg-asphalt/95 backdrop-blur-md">
      <div className="surface-leuchtturm pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="stripe-leuchtturm h-1.5 w-full" aria-hidden="true" />
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
