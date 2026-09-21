"use client";

import Link from "next/link";
import { useState } from "react";
import {
  hitRate,
  leaderboardDisplayValue,
  SORT_LABELS,
  type LeaderboardSortKey,
} from "@/lib/format";
import { backLinkParam } from "@/lib/back-link";
import type { Player } from "@/db/types";

function DeltaLabel({ value }: { value: number | null }) {
  if (value == null) return <span className="text-foam-faint">–</span>;
  if (value > 0) return <span className="text-moss">▲{value}</span>;
  if (value < 0) return <span className="text-clay">▼{Math.abs(value)}</span>;
  return <span className="text-foam-faint">±0</span>;
}

/** Hauptfläche tippt direkt zum Profil, der Chevron rechts klappt die
 *  Stat-Kacheln separat auf — zwei getrennte Trefferflächen in einer
 *  Zeile, wie im Redesign vorgesehen (Zeile → Profil, Chevron → Details).
 *  rankDelta und lastEloDelta beziehen sich immer auf die Elo-Rangliste —
 *  bei anderer Sortierung passen sie nicht mehr zur angezeigten Rang-
 *  bzw. Kennzahl, deshalb blenden wir sie dann aus statt ein irreführendes
 *  Delta zu zeigen. Die groß dargestellte Kennzahl rechts wechselt mit der
 *  aktiven Sortierung (Elo/Quote/Spiele/Bonusbiere/Siege) — vorher stand
 *  dort unabhängig von sortBy immer die Elo. */
export function LeaderboardRow({
  player,
  rank,
  sortBy = "elo",
}: {
  player: Player;
  rank: number;
  sortBy?: LeaderboardSortKey;
}) {
  const [expanded, setExpanded] = useState(false);
  const showEloDelta = sortBy === "elo";
  const { value: displayValue, suffix: displaySuffix } = leaderboardDisplayValue(player, sortBy);

  return (
    <li className="animate-[rank-in_0.55s_cubic-bezier(0.22,1,0.36,1)_both] border-b-[3px] border-transparent [border-image:repeating-linear-gradient(-35deg,var(--color-clay)_0px,var(--color-clay)_8px,var(--color-signal-yellow)_8px,var(--color-signal-yellow)_16px)_1]">
      <div className="flex items-stretch">
        <Link
          href={`/spieler/${player.id}${backLinkParam("board")}`}
          className="flex min-h-[64px] min-w-0 flex-1 items-center gap-[11px] py-[10px] pl-3 pr-1 sm:pl-5"
        >
          <span className="flex w-[42px] shrink-0 flex-col items-center gap-[3px]">
            <span className="flex h-[42px] w-[42px] items-center justify-center bg-rubber font-display text-[15px] text-amber">
              {rank}
            </span>
            <span className="text-[11px] font-semibold tracking-[0.04em]">
              <DeltaLabel value={showEloDelta ? player.rankDelta : null} />
            </span>
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-[17px] text-foam">
              {player.name}
              {player.alias ? (
                <span className="ml-2 text-sm font-normal text-foam-muted">
                  ({player.alias})
                </span>
              ) : null}
            </span>
            <span className="block text-xs text-foam-muted">
              {player.number != null ? `#${player.number} · ` : ""}ELO {player.elo}
            </span>
          </span>

          <span className="shrink-0 text-right">
            <span className="block font-display text-2xl text-foam sm:text-[24px]">
              {displayValue}
              {displaySuffix}
            </span>
            <span className="block text-[11px] font-semibold">
              {!showEloDelta ? (
                <span className="text-foam-faint">{SORT_LABELS[sortBy]}</span>
              ) : player.lastEloDelta == null ? (
                <span className="text-foam-faint">±0</span>
              ) : player.lastEloDelta > 0 ? (
                <span className="text-moss">+{player.lastEloDelta}</span>
              ) : player.lastEloDelta < 0 ? (
                <span className="text-clay">−{Math.abs(player.lastEloDelta)}</span>
              ) : (
                <span className="text-foam-faint">±0</span>
              )}
            </span>
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label="Details"
          className="w-[46px] shrink-0 border-l border-line text-sm text-amber"
        >
          {expanded ? "▲" : "▼"}
        </button>
      </div>

      {expanded ? (
        <div className="grid grid-cols-2 gap-[6px] px-3 pb-3 sm:grid-cols-4 sm:px-5">
          <StatCell label="Quote" value={`${hitRate(player)}%`} />
          <StatCell label="Bonusbiere" value={player.bonusBeers} highlight />
          <StatCell label="Spiele" value={player.games} />
          <StatCell label="W / L" value={`${player.wins}/${player.losses}`} />
        </div>
      ) : null}
    </li>
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
    <div className="border border-line bg-asphalt/60 p-[6px]">
      <p className="text-center text-[9px] uppercase tracking-[0.12em] text-foam-muted">
        {label}
      </p>
      <p
        className={`mt-[3px] text-center font-display text-[17px] ${
          highlight ? "text-signal-yellow" : "text-foam"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
