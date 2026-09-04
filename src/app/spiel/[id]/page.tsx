import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchDetail } from "@/db/queries";
import { formatDateTime } from "@/lib/format";
import type { MatchDetail, MatchPlayerStat } from "@/db/types";

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
  const match = numericId != null ? await getMatchDetail(numericId) : undefined;
  return {
    title: match ? match.scoreLabel : "Spiel",
  };
}

export default async function MatchPage({ params }: Props) {
  const { id } = await params;
  const numericId = parseId(id);
  const match = numericId != null ? await getMatchDetail(numericId) : undefined;
  if (!match) notFound();

  const isPlayed = match.status === "played";

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <div className="border-b border-line bg-asphalt-raised/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-amber">
              {isPlayed ? "Spielbericht" : "Geplantes Match"}
              {match.eventName ? ` · ${match.eventName}` : ""}
            </p>
            <h1 className="font-display text-3xl tracking-tight text-foam sm:text-4xl">
              {match.name ?? match.scoreLabel}
            </h1>
            {match.name && (
              <p className="mt-1 font-display text-lg text-foam-muted">{match.scoreLabel}</p>
            )}
            <p className="mt-1 text-sm text-foam-muted">
              {formatDateTime(match.playedAt)}
              {match.eventLocation ? ` · ${match.eventLocation}` : ""}
            </p>
            {match.note && (
              <p className="mt-2 text-sm text-foam-muted">{match.note}</p>
            )}
          </div>
          <Link
            href="/"
            className="border border-line px-4 py-2 text-xs uppercase tracking-[0.14em] text-foam-muted transition hover:border-amber hover:text-amber"
          >
            Zurück
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
        {isPlayed && match.winner ? (
          <div className="mb-6 flex flex-wrap items-center justify-center gap-4">
            <span
              className={`min-h-14 min-w-[10rem] px-5 py-3 text-center font-display text-lg uppercase tracking-wide ${
                match.winner === "A"
                  ? "bg-amber text-asphalt"
                  : "border border-line text-foam-muted"
              }`}
            >
              {match.teamAName} {match.winner === "A" ? "gewinnt" : ""}
            </span>
            <span className="font-display text-2xl text-amber">VS</span>
            <span
              className={`min-h-14 min-w-[10rem] px-5 py-3 text-center font-display text-lg uppercase tracking-wide ${
                match.winner === "B"
                  ? "bg-amber text-asphalt"
                  : "border border-line text-foam-muted"
              }`}
            >
              {match.teamBName} {match.winner === "B" ? "gewinnt" : ""}
            </span>
          </div>
        ) : (
          <p className="mb-6 text-center text-sm text-foam-muted">
            Noch nicht gespielt – Aufstellung steht.
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          <TeamPanel
            title={match.teamAName}
            accent="amber"
            side="A"
            match={match}
            isWinner={match.winner === "A"}
          />
          <TeamPanel
            title={match.teamBName}
            accent="foam"
            side="B"
            match={match}
            isWinner={match.winner === "B"}
          />
        </div>
      </div>
    </div>
  );
}

function TeamPanel({
  title,
  accent,
  side,
  match,
  isWinner,
}: {
  title: string;
  accent: "amber" | "foam";
  side: "A" | "B";
  match: MatchDetail;
  isWinner: boolean;
}) {
  const roster = match.playerStats.filter((s) => s.side === side);

  return (
    <section
      className={`border ${
        isWinner ? "border-amber bg-amber/5" : "border-line bg-asphalt-raised/40"
      }`}
    >
      <header className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-5">
        <h2
          className={`font-display text-3xl tracking-tight ${
            accent === "amber" ? "text-amber" : "text-foam"
          }`}
        >
          {title}
        </h2>
        {isWinner && (
          <span className="text-xs uppercase tracking-[0.16em] text-amber">
            Sieger
          </span>
        )}
      </header>

      <ul className="divide-y divide-line">
        {roster.map((stats) => (
          <li key={stats.playerId} className="px-3 py-4 sm:px-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <Link
                href={`/spieler/${stats.playerId}`}
                className="flex items-center gap-3 transition hover:opacity-90"
              >
                <span className="flex h-12 w-12 items-center justify-center bg-rubber font-display text-amber">
                  {stats.number ?? "–"}
                </span>
                <div>
                  <p className="font-display text-xl text-foam hover:text-amber sm:text-2xl">
                    {stats.name}
                    {stats.alias ? (
                      <span className="ml-2 text-sm font-normal text-foam-muted">
                        ({stats.alias})
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-foam-muted">ELO {stats.elo}</p>
                </div>
              </Link>
              <EloDelta delta={stats.eloDelta} />
            </div>

            <StatGrid stats={stats} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function EloDelta({ delta }: { delta: number }) {
  const positive = delta >= 0;
  return (
    <span
      className={`font-display text-2xl ${
        positive ? "text-moss" : "text-clay"
      }`}
    >
      {positive ? "+" : ""}
      {delta}
    </span>
  );
}

function StatGrid({ stats }: { stats: MatchPlayerStat }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <StatCell label="Würfe" value={stats.throws} />
      <StatCell label="Treffer" value={stats.hits} highlight />
      <StatCell label="Bonusbiere" value={stats.bonusBeers} />
    </div>
  );
}

function StatCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="border border-line bg-asphalt/60 p-2">
      <p className="text-center text-[0.65rem] uppercase tracking-[0.14em] text-foam-muted">
        {label}
      </p>
      <p
        className={`mt-1 text-center font-display text-2xl ${
          highlight ? "text-signal-yellow" : "text-foam"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
