import { notFound } from "next/navigation";
import { getMatchScoringContext, markMatchStarted } from "@/db/queries";
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
  const detail = matchId != null ? await getMatchScoringContext(matchId) : undefined;
  if (!detail) notFound();

  // ScoreMatchForm wird immer gerendert, auch mit leerem Kader (bereits
  // bewertetes Match) — nie eine andere Baumform an dieser Stelle. Next.js
  // rendert diese Server Component nach der scoreMatch-Server-Action neu
  // (aktuell genügt dafür schon ein revalidatePath auf einer ANDEREN
  // Route), lange bevor ein Client-Redirect greifen könnte. Ein Wechsel zu
  // notFound() oder einer anderen Komponente an dieser Stelle würde React
  // zwingen, den Formular-Baum neu zu mounten und seinen lokalen State
  // (u. a. den Erfolgs-Block) zu verlieren — deshalb erkennt das Formular
  // selbst anhand seines eigenen State, dass gespeichert wurde, statt sich
  // auf einen weiterhin gefüllten Kader zu verlassen.
  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <div className="border-b border-line bg-asphalt-raised/80 px-[14px] py-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-signal-yellow">
          Bewerten · Spiel #{detail.matchId}
          {detail.eventName ? ` · ${detail.eventName}` : ""}
        </p>
        <h1 className="mt-[6px] font-display text-[21px] text-foam">
          {detail.teamAName} vs. {detail.teamBName}
        </h1>
        <p className="mt-[5px] text-xs text-foam-muted">
          {formatDateTime(detail.playedAt)}
          {detail.refereeName ? ` · Schiri: ${detail.refereeName}` : ""}
        </p>
      </div>

      <div className="mx-auto max-w-7xl sm:px-6 sm:py-8">
        <section className="border-line sm:border">
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
