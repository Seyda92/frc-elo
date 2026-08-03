"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";

const publicLinks = [
  { href: "/", label: "Leaderboard" },
  { href: "/live", label: "Live" },
];

type User = { username: string; role: "admin" | "user" };

export function SiteHeader({ user }: { user: User | null }) {
  const pathname = usePathname();
  const links =
    user?.role === "admin" ? [...publicLinks, { href: "/admin", label: "Schiri" }] : publicLinks;

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
