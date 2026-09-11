import Link from "next/link";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { getAdminSession } from "@/lib/auth";
import { getAllPlayers, getAppUsers, getClubs } from "@/db/queries";
import { backLinkParam } from "@/lib/back-link";
import { PlayerForm } from "./PlayerForm";
import { RefereeQuickForm } from "./RefereeQuickForm";

export const metadata = { title: "Spieler" };

export default async function AdminPlayersPage() {
  const session = await getAdminSession();
  const isOwner = session?.role === "owner";
  const [clubs, players, users] = await Promise.all([
    getClubs(),
    getAllPlayers(),
    // Nur geladen, wenn tatsaechlich benoetigt (Owner sieht den
    // "Zu Schiri machen"-Button) - normale Schiris brauchen die Liste
    // aller Konten hier nicht.
    isOwner ? getAppUsers() : Promise.resolve([]),
  ]);
  const linkedPlayerIds = new Set(
    users.map((u) => u.playerId).filter((id): id is number => id != null),
  );

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <AdminPageHeader
        eyebrow="Schiri-Bereich"
        title="Spieler"
        meta={`${players.length} im Verein`}
        backHref="/admin"
      />

      <div className="border-b border-line px-[14px] py-4">
        <h2 className="font-display text-lg text-amber">Neuer Spieler</h2>
        <p className="mt-1 text-xs text-foam-muted">
          Startet mit der Wertung aus dem Modell und ohne gespielte Matches.
        </p>
        <PlayerForm clubs={clubs} />
      </div>

      {players.length === 0 ? (
        <p className="px-[14px] py-4 text-sm text-foam-muted">Noch kein Spieler angelegt.</p>
      ) : (
        <ul className="divide-y divide-line">
          {players.map((player) => (
            <li key={player.id} className="flex flex-wrap items-center justify-between gap-2 px-[14px] py-3">
              <Link
                href={`/spieler/${player.id}${backLinkParam("admin-spieler")}`}
                className="min-w-0 flex-1 transition hover:opacity-90"
              >
                <p className="truncate font-display text-[13.5px] text-foam">
                  {player.name}
                  {player.alias ? (
                    <span className="ml-1 text-xs font-normal text-foam-muted">
                      ({player.alias})
                    </span>
                  ) : null}
                </p>
                <p className="mt-[2px] text-[11px] text-foam-muted">
                  {player.number != null ? `#${player.number} · ` : ""}
                  {player.clubName}
                </p>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/admin/spieler/${player.id}/bearbeiten`}
                  className="text-[11px] uppercase tracking-[0.1em] text-amber transition hover:text-amber-hot"
                >
                  bearbeiten ›
                </Link>
                {isOwner &&
                  (linkedPlayerIds.has(Number(player.id)) ? (
                    <span className="text-[11px] text-foam-muted">Bereits Schiri</span>
                  ) : (
                    <RefereeQuickForm playerId={player.id} playerName={player.name} />
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
