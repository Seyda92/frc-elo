import Link from "next/link";
import { notFound } from "next/navigation";
import { EloSparkline } from "@/components/EloSparkline";
import { getPlayerDetail, getPlayerRecentMatches, getPrimaryClub } from "@/db/queries";
import { formatDateTime, hitRate } from "@/lib/format";

type Props = {
  params: Promise<{ id: string }>;
};

function parseId(id: string): number | undefined {
  const n = Number(id);
  return Number.isInteger(n) ? n : undefined;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const numericId = parseId(id);
  const player = numericId != null ? await getPlayerDetail(numericId) : undefined;
  return {
    title: player ? player.name : "Spieler",
  };
}

export default async function PlayerPage({ params }: Props) {
  const { id } = await params;
  const numericId = parseId(id);
  if (numericId == null) notFound();

  const [player, club, playerMatches] = await Promise.all([
    getPlayerDetail(numericId),
    getPrimaryClub(),
    getPlayerRecentMatches(numericId, 4),
  ]);
  if (!player) notFound();

  const rate = hitRate(player);
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
              {player.number ?? "–"}
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-amber">
                Spielerprofil{club ? ` · ${club.name.split(" ").slice(0, 2).join(" ")}` : ""}
              </p>
              <h1 className="font-display text-3xl tracking-tight text-foam sm:text-4xl">
                {player.name}
                {player.alias ? (
                  <span className="ml-2 text-lg font-normal text-foam-muted">
                    ({player.alias})
                  </span>
                ) : null}
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

      <div className="section-stack mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
        <section className="border border-line bg-asphalt-raised/40">
          <header className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="font-display text-2xl tracking-tight text-amber sm:text-3xl">
              Karriere-Stats
            </h2>
            <p className="mt-1 text-sm text-foam-muted">
              {eloDelta >= 0 ? "+" : ""}
              {eloDelta} ELO seit dem ersten Spiel
            </p>
          </header>
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 sm:p-4">
            <StatCell
              label="Quote"
              value={`${rate}%`}
              hint={`${player.hits}/${player.throws}`}
            />
            <StatCell label="Bonusbiere" value={player.bonusBeers} highlight />
            <StatCell
              label="W / L"
              value={`${player.wins}/${player.losses}`}
              hint={`${player.games} Spiele`}
            />
          </div>
        </section>

        {player.eloHistory.length >= 2 ? (
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
        ) : null}

        <section className="border border-line bg-asphalt-raised/40">
          <header className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="font-display text-2xl tracking-tight text-foam sm:text-3xl">
              Letzte Spiele
            </h2>
          </header>
          <ul className="divide-y divide-line">
            {playerMatches.map((match) => {
              const onA = match.teamA.some((p) => p.id === player.id);
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
                        {onA ? match.teamAName : match.teamBName} ·{" "}
                        {(onA ? match.teamA : match.teamB)
                          .map((p) => p.name.split(" ")[0])
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
          Tippen aufs Leaderboard für andere Spieler
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
}: {
  label: string;
  value: string | number;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div className="border border-line bg-asphalt/60 p-3">
      <p className="text-center text-[0.65rem] uppercase tracking-[0.14em] text-foam-muted">
        {label}
      </p>
      <p
        className={`mt-1 text-center font-display text-3xl ${
          highlight ? "text-signal-yellow" : "text-foam"
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
