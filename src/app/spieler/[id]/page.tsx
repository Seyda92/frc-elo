import Link from "next/link";
import { notFound } from "next/navigation";
import { EloSparkline } from "@/components/EloSparkline";
import {
  club,
  formatDateTime,
  getPlayer,
  hitRate,
  matches,
  players,
} from "@/data/dummy";

type Props = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return players.map((player) => ({ id: player.id }));
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const player = getPlayer(id);
  return {
    title: player ? player.name : "Spieler",
  };
}

export default async function PlayerPage({ params }: Props) {
  const { id } = await params;
  const player = getPlayer(id);
  if (!player) notFound();

  const rate = hitRate(player);
  const playerMatches = matches
    .filter(
      (m) =>
        m.status === "played" &&
        (m.teamA.includes(player.id) || m.teamB.includes(player.id)),
    )
    .slice(0, 4);

  const eloDelta =
    player.eloHistory.length >= 2
      ? player.elo - player.eloHistory[0].elo
      : 0;

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <div className="border-b border-line bg-asphalt-raised/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center bg-rubber font-display text-2xl text-amber">
              {player.number}
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-amber">
                Spielerprofil · {club.name.split(" ").slice(0, 2).join(" ")}
              </p>
              <h1 className="font-display text-3xl tracking-tight text-foam sm:text-4xl">
                {player.name}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.14em] text-foam-muted">
                ELO
              </p>
              <p className="font-display text-3xl text-foam sm:text-4xl">
                {player.elo}
              </p>
            </div>
            <Link
              href="/"
              className="border border-line px-4 py-2 text-xs uppercase tracking-[0.14em] text-foam-muted transition hover:border-amber hover:text-amber"
            >
              Zurück
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-4 px-3 py-6 sm:px-6 sm:py-8 lg:space-y-6">
        <section className="border border-line bg-asphalt-raised/40">
          <header className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="font-display text-2xl tracking-tight text-amber sm:text-3xl">
              Saison-Stats
            </h2>
            <p className="mt-1 text-sm text-foam-muted">
              {eloDelta >= 0 ? "+" : ""}
              {eloDelta} ELO seit Saisonstart
            </p>
          </header>
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 sm:p-4">
            <StatCell
              label="Quote"
              value={`${rate}%`}
              hint={`${player.hits}/${player.throws}`}
            />
            <StatCell label="Bier" value={player.bonusBeers} highlight />
            <StatCell
              label="W / L"
              value={`${player.wins}/${player.losses}`}
              hint={`${player.games} Spiele`}
            />
            <StatCell
              label="Verwarn."
              value={player.warnings}
              danger={player.warnings > 0}
            />
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          <section className="border border-line bg-asphalt-raised/40">
            <header className="border-b border-line px-4 py-4 sm:px-5">
              <h2 className="font-display text-2xl tracking-tight text-foam sm:text-3xl">
                ELO-Verlauf
              </h2>
            </header>
            <div className="p-4 sm:p-5">
              <EloSparkline points={player.eloHistory} />
            </div>
          </section>

          <section className="border border-line bg-asphalt-raised/40">
            <header className="border-b border-line px-4 py-4 sm:px-5">
              <h2 className="font-display text-2xl tracking-tight text-foam sm:text-3xl">
                Achievements
              </h2>
            </header>
            <ul className="divide-y divide-line">
              {player.achievements.map((a) => (
                <li
                  key={a}
                  className="px-4 py-4 font-display text-xl uppercase tracking-wide text-amber sm:px-5 sm:text-2xl"
                >
                  {a}
                </li>
              ))}
              <li className="px-4 py-4 text-sm text-foam-muted sm:px-5">
                {player.warnings === 0
                  ? "Saubere Weste – bisher keine Verwarnung."
                  : `${player.warnings}× ermahnt. Fair Play hält den ELO-Wert stabil.`}
              </li>
            </ul>
          </section>
        </div>

        <section className="border border-line bg-asphalt-raised/40">
          <header className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="font-display text-2xl tracking-tight text-foam sm:text-3xl">
              Letzte Spiele
            </h2>
          </header>
          <ul className="divide-y divide-line">
            {playerMatches.map((match) => {
              const onA = match.teamA.includes(player.id);
              const won =
                (onA && match.winner === "A") || (!onA && match.winner === "B");
              return (
                <li key={match.id}>
                  <Link
                    href={`/spiel/${match.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 transition hover:bg-rubber/30 sm:px-5"
                  >
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-foam-muted">
                        {formatDateTime(match.playedAt)}
                      </p>
                      <p className="mt-1 font-display text-xl text-foam">
                        {onA ? "Team A" : "Team B"} ·{" "}
                        {(onA ? match.teamA : match.teamB)
                          .map((pid) => getPlayer(pid)?.name.split(" ")[0])
                          .join(", ")}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-amber">
                        Spiel ansehen →
                      </p>
                    </div>
                    <span
                      className={`min-h-12 px-4 py-2 font-display text-lg uppercase tracking-wide ${
                        won
                          ? "bg-amber text-asphalt"
                          : "border border-line text-clay"
                      }`}
                    >
                      {won ? "Sieg" : "Niederlage"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <p className="text-center text-sm text-foam-muted">
          Mockup · Tippen aufs Leaderboard für andere Spieler
        </p>
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  hint,
  highlight,
  danger,
}: {
  label: string;
  value: string | number;
  hint?: string;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="border border-line bg-asphalt/60 p-3">
      <p className="text-center text-[0.65rem] uppercase tracking-[0.14em] text-foam-muted">
        {label}
      </p>
      <p
        className={`mt-1 text-center font-display text-3xl ${
          danger ? "text-clay" : highlight ? "text-amber" : "text-foam"
        }`}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-center text-xs text-foam-muted">{hint}</p>
      ) : null}
    </div>
  );
}
