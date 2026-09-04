import Link from "next/link";
import { getAllPlayers, getClubs } from "@/db/queries";
import { PlayerForm } from "./PlayerForm";

export const metadata = { title: "Spieler" };

export default async function AdminPlayersPage() {
  const [clubs, players] = await Promise.all([getClubs(), getAllPlayers()]);

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <div className="border-b border-line bg-asphalt-raised/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-amber">Admin</p>
            <h1 className="font-display text-3xl tracking-tight text-foam sm:text-4xl">
              Spieler
            </h1>
          </div>
          <Link
            href="/admin"
            className="border border-line px-4 py-2 text-xs uppercase tracking-[0.14em] text-foam-muted transition hover:border-amber hover:text-amber"
          >
            Zurück
          </Link>
        </div>
      </div>

      <div className="section-stack mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
        <section className="border border-line bg-asphalt-raised/40">
          <header className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="font-display text-2xl tracking-tight text-amber sm:text-3xl">
              Neuer Spieler
            </h2>
            <p className="mt-1 text-sm text-foam-muted">
              Startet mit der Wertung aus dem Modell und ohne gespielte Matches.
            </p>
          </header>
          <PlayerForm clubs={clubs} />
        </section>

        <section className="border border-line bg-asphalt-raised/40">
          <header className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="font-display text-2xl tracking-tight text-foam sm:text-3xl">
              Bestand ({players.length})
            </h2>
          </header>
          {players.length === 0 ? (
            <p className="px-4 py-4 text-sm text-foam-muted sm:px-5">
              Noch kein Spieler angelegt.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {players.map((player) => (
                <li
                  key={player.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5"
                >
                  <Link
                    href={`/spieler/${player.id}`}
                    className="group flex items-center gap-3 transition hover:opacity-90"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-rubber font-display text-amber">
                      {player.number ?? "–"}
                    </span>
                    <div>
                      <p className="font-display text-xl text-foam group-hover:text-amber sm:text-2xl">
                        {player.name}
                        {player.alias ? (
                          <span className="ml-2 text-sm font-normal text-foam-muted">
                            ({player.alias})
                          </span>
                        ) : null}
                      </p>
                      <p className="text-sm text-foam-muted">{player.clubName}</p>
                    </div>
                  </Link>
                  <Link
                    href={`/admin/spieler/${player.id}/bearbeiten`}
                    className="border border-line px-3 py-2 text-xs uppercase tracking-[0.14em] text-foam-muted transition hover:border-amber hover:text-amber"
                  >
                    Bearbeiten
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
