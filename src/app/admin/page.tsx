import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import {
  getAllEvents,
  getAllPlayers,
  getAppUsers,
  getClubs,
  getLiveMatch,
  getMatchCount,
  getPlannedMatches,
} from "@/db/queries";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const session = await requireAdmin();
  const [clubs, players, events, matchCount, users, liveMatch, planned] = await Promise.all([
    getClubs(),
    getAllPlayers(),
    getAllEvents(),
    getMatchCount(),
    session.role === "owner" ? getAppUsers() : Promise.resolve(null),
    getLiveMatch(),
    getPlannedMatches(),
  ]);

  const isOwner = session.role === "owner";
  const tiles = [
    { href: "/admin/spiele/anlegen", label: "Spiel anlegen", sub: "Team-Builder", accent: true },
    { href: "/admin/spiele", label: "Spiele", sub: `${matchCount} · ${planned.length} offen` },
    { href: "/admin/spieler", label: "Spieler", sub: `${players.length} im Verein` },
    { href: "/admin/events", label: "Events", sub: `${events.length} · ${events.filter((e) => e.status === "upcoming").length} geplant` },
    { href: "/admin/vereine", label: "Vereine", sub: `${clubs.length}` },
    ...(users !== null
      ? [{ href: "/admin/schiris", label: "Schiris", sub: `${users.length} Zugänge`, danger: true }]
      : []),
  ];

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <div className="border-b border-line bg-asphalt-raised/80 px-[14px] py-4">
        <p className={`text-[10px] uppercase tracking-[0.2em] ${isOwner ? "text-clay" : "text-signal-yellow"}`}>
          {isOwner ? "Owner" : "Schiri-Bereich"}
        </p>
        <h1 className="mt-[6px] font-display text-[20px] text-foam">{session.username}</h1>
      </div>

      {liveMatch ? (
        <div className="bg-[var(--color-live-strip)] px-[14px] py-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-clay">Offen</p>
          <p className="mt-1 font-display text-sm text-foam">
            Spiel #{liveMatch.matchId} läuft — weiter bewerten
          </p>
          <Link
            href={`/admin/spiele/${liveMatch.matchId}/bewerten`}
            className="mt-2 flex min-h-11 items-center justify-center bg-amber font-display text-xs uppercase tracking-[0.08em] text-asphalt transition hover:bg-amber-hot"
          >
            Bewerten öffnen
          </Link>
        </div>
      ) : null}

      <div className="px-[14px] py-4">
        <div className="grid grid-cols-2 gap-[8px]">
          {tiles.map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              className="flex min-h-[74px] flex-col justify-center border border-line bg-asphalt/60 p-3 transition hover:border-amber"
            >
              <p
                className={`font-display text-base ${
                  tile.accent ? "text-amber" : tile.danger ? "text-clay" : "text-foam"
                }`}
              >
                {tile.label}
              </p>
              <p className="mt-1 text-xs text-foam-muted">{tile.sub}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
