import Link from "next/link";
import type { PlannedMatchDetail } from "@/db/queries";

function teamScore(team: PlannedMatchDetail["teamA"]): number {
  return team.reduce((sum, p) => sum + (p.liveHits ?? 0), 0);
}

/** Klebender Streifen unter dem Header, nur sichtbar während ein Match
 *  läuft — auf jeder Seite, tappbar zu /live. Ersetzt für den Live-Fall
 *  das bisherige "Aktuelles"-Dropdown als primäre Live-Anzeige. */
export function LiveStrip({ liveMatch }: { liveMatch: PlannedMatchDetail | undefined }) {
  if (!liveMatch) return null;

  const scoreA = teamScore(liveMatch.teamA);
  const scoreB = teamScore(liveMatch.teamB);

  return (
    <Link
      href="/live"
      className="flex min-h-[38px] w-full items-center gap-[10px] border-b border-line bg-[var(--color-live-strip)] px-[14px] py-[9px] text-foam"
    >
      <span
        className="h-2 w-2 shrink-0 animate-[frcpulse_1.4s_ease-out_infinite] bg-clay"
        aria-hidden="true"
      />
      <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-clay">Live</span>
      <span className="min-w-0 flex-1 truncate font-display text-[13px]">
        {liveMatch.teamAName} {scoreA} : {scoreB} {liveMatch.teamBName}
      </span>
      <span className="shrink-0 text-base text-amber" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
