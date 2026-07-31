import Link from "next/link";
import { getAllEvents, getPlayersForMatchEntry, getRecentMatches } from "@/db/queries";
import { formatDateTime } from "@/lib/format";
import { MatchForm } from "./MatchForm";

export const metadata = { title: "Spiele" };

export default async function AdminMatchesPage() {
  const [players, events, matches] = await Promise.all([
    getPlayersForMatchEntry(),
    getAllEvents(),
    getRecentMatches(20),
  ]);

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <div className="border-b border-line bg-asphalt-raised/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-amber">Admin</p>
            <h1 className="font-display text-3xl tracking-tight text-foam sm:text-4xl">
              Spiele
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

      <div className="mx-auto max-w-7xl space-y-4 px-3 py-6 sm:px-6 sm:py-8 lg:space-y-6">
        <section className="border border-line bg-asphalt-raised/40">
          <header className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="font-display text-2xl tracking-tight text-amber sm:text-3xl">
              Match erfassen
            </h2>
            <p className="mt-1 text-sm text-foam-muted">
              Die Wertung wird sofort mit dem aktuellen Stand berechnet — auch bei
              nachgetragenen Matches.
            </p>
          </header>
          {players.length < 2 ? (
            <p className="px-4 py-4 text-sm text-foam-muted sm:px-5">
              Es müssen mindestens zwei aktive Spieler angelegt sein.
            </p>
          ) : (
            <MatchForm players={players} events={events} />
          )}
        </section>

        <section className="border border-line bg-asphalt-raised/40">
          <header className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="font-display text-2xl tracking-tight text-foam sm:text-3xl">
              Zuletzt erfasst ({matches.length})
            </h2>
          </header>
          {matches.length === 0 ? (
            <p className="px-4 py-4 text-sm text-foam-muted sm:px-5">
              Noch kein Match erfasst.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {matches.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/spiel/${m.id}`}
                    className="block px-4 py-4 transition hover:bg-rubber/30 sm:px-5"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-foam-muted">
                      {formatDateTime(m.playedAt)}
                    </p>
                    <p className="mt-1 font-display text-xl text-foam">{m.scoreLabel}</p>
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
