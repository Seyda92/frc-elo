import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlannedMatchDetail, markMatchStarted } from "@/db/queries";
import { formatDateTime } from "@/lib/format";
import { ScoreMatchForm } from "./ScoreMatchForm";

type Props = {
  params: Promise<{ id: string }>;
};

function parseId(id: string): number | undefined {
  const n = Number(id);
  return Number.isInteger(n) ? n : undefined;
}

export const metadata = { title: "Match bewerten" };

export default async function ScoreMatchPage({ params }: Props) {
  const { id } = await params;
  const matchId = parseId(id);
  if (matchId != null) await markMatchStarted(matchId);
  const detail = matchId != null ? await getPlannedMatchDetail(matchId) : undefined;
  if (!detail) notFound();

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <div className="border-b border-line bg-asphalt-raised/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-amber">
              Match bewerten
              {detail.eventName ? ` · ${detail.eventName}` : ""}
            </p>
            <h1 className="font-display text-3xl tracking-tight text-foam sm:text-4xl">
              {detail.teamAName} vs. {detail.teamBName}
            </h1>
            <p className="mt-1 text-sm text-foam-muted">
              {formatDateTime(detail.playedAt)}
              {detail.refereeName ? ` · Schiri: ${detail.refereeName}` : ""}
            </p>
          </div>
          <Link
            href="/admin/spiele"
            className="border border-line px-4 py-2 text-xs uppercase tracking-[0.14em] text-foam-muted transition hover:border-amber hover:text-amber"
          >
            Zurück
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
        <section className="border border-line bg-asphalt-raised/40">
          <ScoreMatchForm
            matchId={detail.matchId}
            teamA={detail.teamA}
            teamB={detail.teamB}
            teamAName={detail.teamAName}
            teamBName={detail.teamBName}
          />
        </section>
      </div>
    </div>
  );
}
