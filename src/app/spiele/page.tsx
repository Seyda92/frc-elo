import Link from "next/link";
import { getAllMatches } from "@/db/queries";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Spiele" };

const PAGE_SIZE = 20;

type Props = {
  searchParams: Promise<{ page?: string }>;
};

function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 1 ? n : 1;
}

export default async function MatchesPage({ searchParams }: Props) {
  const { page: rawPage } = await searchParams;
  const page = parsePage(rawPage);
  const offset = (page - 1) * PAGE_SIZE;

  const { matches, total } = await getAllMatches(offset, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <div className="border-b border-line bg-asphalt-raised/80">
        <div className="stripe-leuchtturm h-1.5 w-full" aria-hidden="true" />
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-amber">Übersicht</p>
            <h1 className="font-display text-3xl tracking-tight text-foam sm:text-4xl">
              Spiele
            </h1>
          </div>
          <span className="text-sm text-foam-muted">{total} Spiele insgesamt</span>
        </div>
      </div>

      <div className="section-stack mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
        <section className="border border-line bg-asphalt-raised/40">
          <header className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="font-display text-2xl tracking-tight text-foam sm:text-3xl">
              Alle Spiele
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
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.16em] text-foam-muted">
                        {formatDateTime(m.playedAt)}
                      </p>
                      <span
                        className={`text-xs uppercase tracking-[0.14em] ${
                          m.status === "planned" ? "text-signal-yellow" : "text-amber"
                        }`}
                      >
                        {m.status === "planned" ? "Geplant" : "Gespielt"}
                      </span>
                    </div>
                    {m.name && (
                      <p className="mt-1 font-display text-lg text-foam">{m.name}</p>
                    )}
                    <p className="mt-2 text-sm text-foam-muted">
                      {m.teamA.map((p) => p.name.split(" ")[0]).join(", ")}
                      <span className="mx-2 font-display text-amber">VS</span>
                      {m.teamB.map((p) => p.name.split(" ")[0]).join(", ")}
                    </p>
                    <p className="mt-2 font-display text-lg text-foam">{m.scoreLabel}</p>
                    {m.note && (
                      <p className="mt-2 text-sm text-foam-muted">{m.note}</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {totalPages > 1 ? (
          <nav className="flex items-center justify-between gap-3">
            {page > 1 ? (
              <Link
                href={`/spiele?page=${page - 1}`}
                className="border border-line px-4 py-2 text-xs uppercase tracking-[0.14em] text-foam-muted transition hover:border-amber hover:text-amber"
              >
                ← Neuer
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs uppercase tracking-[0.14em] text-foam-muted">
              Seite {page} von {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={`/spiele?page=${page + 1}`}
                className="border border-line px-4 py-2 text-xs uppercase tracking-[0.14em] text-foam-muted transition hover:border-amber hover:text-amber"
              >
                Älter →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
