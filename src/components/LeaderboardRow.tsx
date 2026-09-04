"use client";

import Link from "next/link";
import { useState } from "react";
import { hitRate } from "@/lib/format";
import type { Player } from "@/db/types";

/** Startet eingeklappt (nur Rang/Name/Elo) — Klick auf die Kopfzeile
 *  blendet die Stat-Kacheln ein/aus, ohne die Navigation zur
 *  Spielerseite zu stören (die bleibt ein eigener Link im Fußbereich). */
export function LeaderboardRow({ player, rank }: { player: Player; rank: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="animate-[rank-in_0.55s_cubic-bezier(0.22,1,0.36,1)_both] px-3 py-4 sm:px-5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center bg-rubber font-display text-amber">
            {rank}
          </span>
          <div>
            <p className="font-display text-xl text-foam sm:text-2xl">
              {player.name}
              {player.alias ? (
                <span className="ml-2 text-sm font-normal text-foam-muted">
                  ({player.alias})
                </span>
              ) : null}
            </p>
            <p className="text-sm text-foam-muted">
              {player.number != null ? `#${player.number} · ` : ""}ELO {player.elo}
            </p>
          </div>
        </div>
        <span className="font-display text-3xl text-foam sm:text-4xl">{player.elo}</span>
      </button>

      {expanded ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCell label="Quote" value={`${hitRate(player)}%`} />
          <StatCell label="Bonusbiere" value={player.bonusBeers} highlight />
          <StatCell label="Spiele" value={player.games} />
          <StatCell label="W / L" value={`${player.wins}/${player.losses}`} />
          <Link
            href={`/spieler/${player.id}`}
            className="col-span-2 mt-1 border border-line px-3 py-2 text-center text-xs uppercase tracking-[0.14em] text-foam-muted transition hover:border-amber hover:text-amber sm:col-span-4"
          >
            Spielerprofil ansehen →
          </Link>
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
