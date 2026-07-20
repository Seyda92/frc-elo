import Link from "next/link";
import {
  club,
  events,
  formatDate,
  formatDateTime,
  getPlayer,
  hitRate,
  matches,
  players,
} from "@/data/dummy";

export default function HomePage() {
  const ranked = [...players].sort((a, b) => b.elo - a.elo);
  const recent = matches.filter((m) => m.status === "played").slice(0, 3);
  const upcoming = matches.filter((m) => m.status === "planned");
  const featuredEvents = events.filter((e) => e.status !== "past");

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <div className="border-b border-line bg-asphalt-raised/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-amber">
              Saison 2026 · Rangliste
            </p>
            <h1 className="font-display text-3xl tracking-tight text-foam sm:text-4xl">
              1. FRC Leaderboard
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-foam-muted">{ranked.length} Spieler</span>
            <Link
              href="/live"
              className="bg-amber px-4 py-2 font-display text-sm uppercase tracking-wide text-asphalt transition hover:bg-amber-hot"
            >
              Live-Spieltag
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-4 px-3 py-6 sm:px-6 sm:py-8 lg:space-y-6">
        <section className="border border-line bg-asphalt-raised/40">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
            <div>
              <h2 className="font-display text-2xl tracking-tight text-amber sm:text-3xl">
                ELO-Tabelle
              </h2>
              <p className="mt-1 text-sm text-foam-muted">{club.name}</p>
            </div>
          </header>

          <ul className="divide-y divide-line rank-stagger">
            {ranked.map((player, index) => (
              <li
                key={player.id}
                className="animate-[rank-in_0.55s_cubic-bezier(0.22,1,0.36,1)_both] px-3 py-4 sm:px-5"
              >
                <Link
                  href={`/spieler/${player.id}`}
                  className="group block transition hover:bg-rubber/20"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center bg-rubber font-display text-amber">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-display text-xl text-foam group-hover:text-amber sm:text-2xl">
                          {player.name}
                        </p>
                        <p className="text-sm text-foam-muted">
                          #{player.number} · ELO {player.elo}
                        </p>
                      </div>
                    </div>
                    <span className="font-display text-3xl text-foam sm:text-4xl">
                      {player.elo}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <StatCell label="Quote" value={`${hitRate(player)}%`} />
                    <StatCell label="Bier" value={player.bonusBeers} highlight />
                    <StatCell label="Spiele" value={player.games} />
                    <StatCell
                      label="W / L"
                      value={`${player.wins}/${player.losses}`}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          <section className="border border-line bg-asphalt-raised/40">
            <header className="border-b border-line px-4 py-4 sm:px-5">
              <h2 className="font-display text-2xl tracking-tight text-foam sm:text-3xl">
                Letzte Spiele
              </h2>
            </header>
            <ul className="divide-y divide-line">
              {recent.map((match) => (
                <li key={match.id}>
                  <Link
                    href={`/spiel/${match.id}`}
                    className="block px-4 py-4 transition hover:bg-rubber/30 sm:px-5"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-foam-muted">
                      {formatDateTime(match.playedAt)}
                    </p>
                    <p className="mt-2 font-display text-xl text-foam sm:text-2xl">
                      {match.scoreLabel}
                    </p>
                    <p className="mt-2 text-sm text-foam-muted">
                      {match.teamA
                        .map((id) => getPlayer(id)?.name.split(" ")[0])
                        .join(", ")}
                      <span className="mx-2 font-display text-amber">VS</span>
                      {match.teamB
                        .map((id) => getPlayer(id)?.name.split(" ")[0])
                        .join(", ")}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.14em] text-amber">
                      Spiel ansehen →
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="border border-line bg-asphalt-raised/40">
            <header className="border-b border-line px-4 py-4 sm:px-5">
              <h2 className="font-display text-2xl tracking-tight text-foam sm:text-3xl">
                Events &amp; Planung
              </h2>
            </header>
            <ul className="divide-y divide-line">
              {featuredEvents.map((event) => (
                <li key={event.id} className="px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-display text-xl text-foam sm:text-2xl">
                      {event.name}
                    </p>
                    <span
                      className={`text-xs uppercase tracking-[0.14em] ${
                        event.status === "ongoing" ? "text-amber" : "text-foam-muted"
                      }`}
                    >
                      {event.status === "ongoing" ? "Läuft" : "Geplant"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foam-muted">
                    {formatDate(event.startsAt)}
                    {event.endsAt !== event.startsAt
                      ? ` – ${formatDate(event.endsAt)}`
                      : ""}{" "}
                    · {event.location}
                  </p>
                </li>
              ))}
              {upcoming.map((match) => (
                <li key={match.id} className="px-4 py-4 sm:px-5">
                  <p className="text-xs uppercase tracking-[0.16em] text-amber">
                    Nächstes Match
                  </p>
                  <p className="mt-2 font-display text-xl sm:text-2xl">
                    {match.scoreLabel}
                  </p>
                  <p className="mt-2 text-sm text-foam-muted">
                    {match.teamA
                      .map((id) => getPlayer(id)?.name.split(" ")[0])
                      .join(", ")}
                    <span className="mx-2 font-display text-amber">VS</span>
                    {match.teamB
                      .map((id) => getPlayer(id)?.name.split(" ")[0])
                      .join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <p className="text-center text-sm text-foam-muted">
          Mockup · Dummy-Daten · {club.name}
        </p>
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="border border-line bg-asphalt/60 p-2">
      <p className="text-center text-[0.65rem] uppercase tracking-[0.14em] text-foam-muted">
        {label}
      </p>
      <p
        className={`mt-1 text-center font-display text-2xl ${
          highlight ? "text-amber" : "text-foam"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
