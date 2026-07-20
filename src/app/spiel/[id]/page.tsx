import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatDateTime,
  getEvent,
  getMatch,
  getMatchStat,
  getPlayer,
  matches,
  type MatchPlayerStat,
  type MatchSummary,
} from "@/data/dummy";

type Props = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return matches.map((match) => ({ id: match.id }));
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const match = getMatch(id);
  return {
    title: match ? match.scoreLabel : "Spiel",
  };
}

export default async function MatchPage({ params }: Props) {
  const { id } = await params;
  const match = getMatch(id);
  if (!match) notFound();

  const event = match.eventId ? getEvent(match.eventId) : undefined;
  const isPlayed = match.status === "played";

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <div className="border-b border-line bg-asphalt-raised/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-amber">
              {isPlayed ? "Spielbericht" : "Geplantes Match"}
              {event ? ` · ${event.name}` : ""}
            </p>
            <h1 className="font-display text-3xl tracking-tight text-foam sm:text-4xl">
              {match.scoreLabel}
            </h1>
            <p className="mt-1 text-sm text-foam-muted">
              {formatDateTime(match.playedAt)}
              {event ? ` · ${event.location}` : ""}
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
              Team A {match.winner === "A" ? "gewinnt" : ""}
            </span>
            <span className="font-display text-2xl text-amber">VS</span>
            <span
              className={`min-h-14 min-w-[10rem] px-5 py-3 text-center font-display text-lg uppercase tracking-wide ${
                match.winner === "B"
                  ? "bg-amber text-asphalt"
                  : "border border-line text-foam-muted"
              }`}
            >
              Team B {match.winner === "B" ? "gewinnt" : ""}
            </span>
          </div>
        ) : (
          <p className="mb-6 text-center text-sm text-foam-muted">
            Noch nicht gespielt – Aufstellung steht.
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          <TeamPanel
            title="Team A"
            accent="amber"
            playerIds={match.teamA}
            match={match}
            isWinner={match.winner === "A"}
          />
          <TeamPanel
            title="Team B"
            accent="foam"
            playerIds={match.teamB}
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
  playerIds,
  match,
  isWinner,
}: {
  title: string;
  accent: "amber" | "foam";
  playerIds: string[];
  match: MatchSummary;
  isWinner: boolean;
}) {
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
        {playerIds.map((playerId) => {
          const player = getPlayer(playerId);
          if (!player) return null;
          const stats = getMatchStat(match, playerId);
          return (
            <li key={playerId} className="px-3 py-4 sm:px-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <Link
                  href={`/spieler/${player.id}`}
                  className="flex items-center gap-3 transition hover:opacity-90"
                >
                  <span className="flex h-12 w-12 items-center justify-center bg-rubber font-display text-amber">
                    {player.number}
                  </span>
                  <div>
                    <p className="font-display text-xl text-foam hover:text-amber sm:text-2xl">
                      {player.name}
                    </p>
                    <p className="text-sm text-foam-muted">ELO {player.elo}</p>
                  </div>
                </Link>
                {stats ? <EloDelta delta={stats.eloDelta} /> : null}
              </div>

              {stats ? <StatGrid stats={stats} /> : null}
            </li>
          );
        })}
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
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatCell label="Würfe" value={stats.throws} />
      <StatCell label="Treffer" value={stats.hits} highlight />
      <StatCell label="Bier" value={stats.bonusBeers} />
      <StatCell label="Verwarn." value={stats.warnings} danger={stats.warnings > 0} />
    </div>
  );
}

function StatCell({
  label,
  value,
  highlight,
  danger,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="border border-line bg-asphalt/60 p-2">
      <p className="text-center text-[0.65rem] uppercase tracking-[0.14em] text-foam-muted">
        {label}
      </p>
      <p
        className={`mt-1 text-center font-display text-2xl ${
          danger ? "text-clay" : highlight ? "text-amber" : "text-foam"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
