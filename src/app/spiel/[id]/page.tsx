import Link from "next/link";
import { notFound } from "next/navigation";
import { BackBar } from "@/components/BackBar";
import { getMatchDetail } from "@/db/queries";
import { formatDateTime } from "@/lib/format";
import { backLinkParam, resolveBackLink } from "@/lib/back-link";
import type { MatchDetail } from "@/db/types";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
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

export default async function MatchPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { from } = await searchParams;
  const numericId = parseId(id);
  const match = numericId != null ? await getMatchDetail(numericId) : undefined;
  if (!match) notFound();

  const isPlayed = match.status === "played";
  const back = resolveBackLink(from, { label: "Spiele", href: "/spiele" });

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <BackBar label={back.label} href={back.href} />

      <div className="border-b border-line bg-asphalt-raised/80 px-[14px] py-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-signal-yellow">
          {match.name ?? `Spiel #${match.id}`} · {isPlayed ? "beendet" : "geplant"}
          {match.eventName ? ` · ${match.eventName}` : ""}
        </p>
        <h1 className="mt-[6px] font-display text-[21px] text-foam">
          {match.teamAName} vs. {match.teamBName}
        </h1>
        <p className="mt-[5px] text-xs text-foam-muted">
          {formatDateTime(match.playedAt)}
          {match.eventLocation ? ` · ${match.eventLocation}` : ""}
        </p>
        {match.note && <p className="mt-2 text-sm text-foam-muted">{match.note}</p>}
      </div>

      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
        {isPlayed && match.winner ? (
          <div className="mb-6 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <ScoreColumn
              label={match.teamAName}
              score={match.playerStats.filter((s) => s.side === "A").reduce((sum, s) => sum + s.hits, 0)}
              isWinner={match.winner === "A"}
            />
            <span
              className="h-[60px] w-[5px] shrink-0"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(-35deg, var(--color-clay) 0px, var(--color-clay) 10px, var(--color-signal-yellow) 10px, var(--color-signal-yellow) 20px)",
              }}
              aria-hidden="true"
            />
            <ScoreColumn
              label={match.teamBName}
              score={match.playerStats.filter((s) => s.side === "B").reduce((sum, s) => sum + s.hits, 0)}
              isWinner={match.winner === "B"}
            />
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

function ScoreColumn({
  label,
  score,
  isWinner,
}: {
  label: string;
  score: number;
  isWinner: boolean;
}) {
  return (
    <div className="text-center">
      <p className={`font-display text-[40px] leading-none ${isWinner ? "text-amber" : "text-foam"}`}>
        {score}
      </p>
      <p
        className={`mt-[6px] text-[10px] uppercase tracking-[0.14em] ${
          isWinner ? "text-amber" : "text-foam-muted"
        }`}
      >
        {isWinner ? "Sieger" : label}
      </p>
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
      className={isWinner ? "border border-amber bg-amber/5" : "border border-line bg-asphalt-raised/40"}
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
          <span className="text-xs uppercase tracking-[0.16em] text-amber">Sieger</span>
        )}
      </header>

      <ul className="divide-y divide-line">
        {roster.map((stats) => (
          <li key={stats.playerId} className="flex items-center gap-[10px] px-3 py-[11px] sm:px-5">
            <Link
              href={`/spieler/${stats.playerId}${backLinkParam(`spiel:${match.id}`)}`}
              className="flex min-w-0 flex-1 items-center gap-[10px] transition hover:opacity-90"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-rubber font-display text-[13px] text-amber">
                {stats.number ?? "–"}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-display text-[13px] text-foam">
                  {stats.name}
                  {stats.alias ? (
                    <span className="ml-1 text-xs font-normal text-foam-muted">
                      ({stats.alias})
                    </span>
                  ) : null}
                </span>
                <span className="block text-[11px] text-foam-muted">
                  {stats.hits}/{stats.throws} · {stats.bonusBeers} BB · {title}
                </span>
              </span>
            </Link>
            <EloDelta delta={stats.eloDelta} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function EloDelta({ delta }: { delta: number }) {
  const positive = delta >= 0;
  return (
    <span className={`shrink-0 text-[11px] font-semibold ${positive ? "text-moss" : "text-clay"}`}>
      {positive ? "+" : ""}
      {delta}
    </span>
  );
}
