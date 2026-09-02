import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getAllEvents, getAllPlayers, getAppUsers, getClubs, getMatchCount } from "@/db/queries";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const session = await requireAdmin();
  const [clubs, players, events, matchCount, users] = await Promise.all([
    getClubs(),
    getAllPlayers(),
    getAllEvents(),
    getMatchCount(),
    session.role === "owner" ? getAppUsers() : Promise.resolve(null),
  ]);

  const sections = [
    { href: "/admin/vereine", label: "Vereine", count: clubs.length },
    { href: "/admin/spieler", label: "Spieler", count: players.length },
    { href: "/admin/events", label: "Events", count: events.length },
    { href: "/admin/spiele", label: "Spiele", count: matchCount },
    ...(users !== null ? [{ href: "/admin/schiris", label: "Schiris", count: users.length }] : []),
  ];

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <div className="border-b border-line bg-asphalt-raised/80">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <p className="text-xs uppercase tracking-[0.22em] text-amber">Verwaltung</p>
          <h1 className="font-display text-3xl tracking-tight text-foam sm:text-4xl">
            Admin
          </h1>
          <p className="mt-1 text-sm text-foam-muted">
            Stammdaten pflegen und gespielte Matches erfassen.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {sections.map((section) => (
            <li key={section.href}>
              <Link
                href={section.href}
                className="group block border border-line bg-asphalt-raised/40 p-5 transition hover:border-amber"
              >
                <p className="font-display text-2xl text-foam group-hover:text-amber sm:text-3xl">
                  {section.label}
                </p>
                <p className="mt-2 font-display text-4xl text-amber">{section.count}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.14em] text-foam-muted">
                  Anlegen &amp; ansehen →
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
