import Link from "next/link";
import { getPlannedMatches, getRecentMatches } from "@/db/queries";
import { formatDateTime } from "@/lib/format";
import { backLinkParam } from "@/lib/back-link";

export const metadata = { title: "Spiele" };

export default async function AdminMatchesPage() {
  const [planned, matches] = await Promise.all([getPlannedMatches(), getRecentMatches(20)]);

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

      <div className="section-stack mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
        <section className="border border-line bg-asphalt-raised/40">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
            <div>
              <h2 className="font-display text-2xl tracking-tight text-amber sm:text-3xl">
                Neues Match
              </h2>
              <p className="mt-1 text-sm text-foam-muted">
                Erst Teams zusammenstellen, dann direkt oder später bewerten.
              </p>
            </div>
            <Link
              href="/admin/spiele/anlegen"
              className="bg-amber px-4 py-2 font-display text-sm uppercase tracking-wide text-asphalt transition hover:bg-amber-hot"
            >
              + Neues Match anlegen
            </Link>
          </header>
        </section>

        <section className="border border-line bg-asphalt-raised/40">
          <header className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="font-display text-2xl tracking-tight text-foam sm:text-3xl">
              Geplante Matches ({planned.length})
            </h2>
          </header>
          {planned.length === 0 ? (
            <p className="px-4 py-4 text-sm text-foam-muted sm:px-5">
              Kein Match wartet auf Bewertung.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {planned.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/admin/spiele/${m.id}/bewerten`}
                    className="block px-4 py-4 transition hover:bg-rubber/30 sm:px-5"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-foam-muted">
                      {formatDateTime(m.playedAt)}
                    </p>
                    {m.name && (
                      <p className="mt-1 font-display text-lg text-foam">{m.name}</p>
                    )}
                    <p className="mt-2 text-sm text-foam-muted">
                      {m.teamA.map((p) => p.name.split(" ")[0]).join(", ")}
                      <span className="mx-2 font-display text-amber">VS</span>
                      {m.teamB.map((p) => p.name.split(" ")[0]).join(", ")}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.14em] text-amber">
                      Jetzt bewerten →
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
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
                    href={`/spiel/${m.id}${backLinkParam("admin-spiele")}`}
                    className="block px-4 py-4 transition hover:bg-rubber/30 sm:px-5"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-foam-muted">
                      {formatDateTime(m.playedAt)}
                    </p>
                    {m.name && (
                      <p className="mt-1 font-display text-lg text-foam">{m.name}</p>
                    )}
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
