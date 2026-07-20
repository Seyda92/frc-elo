"use client";

import Link from "next/link";
import { useState } from "react";
import { getPlayer, liveMatch, type LivePlayerStats } from "@/data/dummy";

type TeamKey = "A" | "B";

function cloneLive() {
  return {
    ...liveMatch,
    teamA: liveMatch.teamA.map((p) => ({ ...p })),
    teamB: liveMatch.teamB.map((p) => ({ ...p })),
  };
}

export default function LivePage() {
  const [match, setMatch] = useState(cloneLive);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [winner, setWinner] = useState<"A" | "B" | null>(liveMatch.winner);

  function updateStat(
    team: TeamKey,
    playerId: string,
    field: keyof Omit<LivePlayerStats, "playerId">,
    delta: number,
  ) {
    setMatch((prev) => {
      const key = team === "A" ? "teamA" : "teamB";
      return {
        ...prev,
        [key]: prev[key].map((row) => {
          if (row.playerId !== playerId) return row;
          const next = Math.max(0, row[field] + delta);
          return { ...row, [field]: next };
        }),
      };
    });

    if (field === "hits" && delta > 0) {
      setFlashKey(`${team}-${playerId}`);
      window.setTimeout(() => setFlashKey(null), 700);
    }
  }

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <div className="border-b border-line bg-asphalt-raised/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-amber">
              Live · Bar-Modus
            </p>
            <h1 className="font-display text-3xl tracking-tight text-foam sm:text-4xl">
              {match.eventName}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-foam-muted">
              Teams {match.teamSize}v{match.teamSize}
            </span>
            <Link
              href="/"
              className="border border-line px-4 py-2 text-xs uppercase tracking-[0.14em] text-foam-muted transition hover:border-amber hover:text-amber"
            >
              Zurück
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-center gap-4">
          <WinnerButton
            label="Team A gewinnt"
            active={winner === "A"}
            onClick={() => setWinner("A")}
          />
          <span className="font-display text-2xl text-amber">VS</span>
          <WinnerButton
            label="Team B gewinnt"
            active={winner === "B"}
            onClick={() => setWinner("B")}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          <TeamPanel
            title="Team A"
            accent="amber"
            rows={match.teamA}
            flashKey={flashKey}
            team="A"
            isWinner={winner === "A"}
            onChange={updateStat}
          />
          <TeamPanel
            title="Team B"
            accent="foam"
            rows={match.teamB}
            flashKey={flashKey}
            team="B"
            isWinner={winner === "B"}
            onChange={updateStat}
          />
        </div>

        <p className="mt-8 text-center text-sm text-foam-muted">
          Mockup: Tippen erhöht Treffer / Würfe / Bier / Verwarnungen. Keine Persistenz.
        </p>
      </div>
    </div>
  );
}

function WinnerButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-14 min-w-[10rem] px-5 py-3 font-display text-lg uppercase tracking-wide transition ${
        active
          ? "bg-amber text-asphalt"
          : "border border-line bg-rubber/40 text-foam hover:border-amber"
      }`}
    >
      {label}
    </button>
  );
}

function TeamPanel({
  title,
  accent,
  rows,
  team,
  flashKey,
  isWinner,
  onChange,
}: {
  title: string;
  accent: "amber" | "foam";
  rows: LivePlayerStats[];
  team: TeamKey;
  flashKey: string | null;
  isWinner: boolean;
  onChange: (
    team: TeamKey,
    playerId: string,
    field: keyof Omit<LivePlayerStats, "playerId">,
    delta: number,
  ) => void;
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
        {rows.map((row) => {
          const player = getPlayer(row.playerId);
          if (!player) return null;
          const flashing = flashKey === `${team}-${row.playerId}`;
          return (
            <li
              key={row.playerId}
              className={`px-3 py-4 sm:px-5 ${
                flashing ? "animate-[pulse-hit_0.7s_ease-out]" : ""
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center bg-rubber font-display text-amber">
                    {player.number}
                  </span>
                  <div>
                    <p className="font-display text-xl text-foam sm:text-2xl">
                      {player.name}
                    </p>
                    <p className="text-sm text-foam-muted">ELO {player.elo}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatControl
                  label="Würfe"
                  value={row.throws}
                  onInc={() => onChange(team, row.playerId, "throws", 1)}
                  onDec={() => onChange(team, row.playerId, "throws", -1)}
                />
                <StatControl
                  label="Treffer"
                  value={row.hits}
                  highlight
                  onInc={() => onChange(team, row.playerId, "hits", 1)}
                  onDec={() => onChange(team, row.playerId, "hits", -1)}
                />
                <StatControl
                  label="Bier"
                  value={row.bonusBeers}
                  onInc={() => onChange(team, row.playerId, "bonusBeers", 1)}
                  onDec={() => onChange(team, row.playerId, "bonusBeers", -1)}
                />
                <StatControl
                  label="Verwarn."
                  value={row.warnings}
                  danger
                  onInc={() => onChange(team, row.playerId, "warnings", 1)}
                  onDec={() => onChange(team, row.playerId, "warnings", -1)}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StatControl({
  label,
  value,
  onInc,
  onDec,
  highlight,
  danger,
}: {
  label: string;
  value: number;
  onInc: () => void;
  onDec: () => void;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="border border-line bg-asphalt/60 p-2">
      <p className="text-center text-[0.65rem] uppercase tracking-[0.14em] text-foam-muted">
        {label}
      </p>
      <div className="mt-1 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={onDec}
          className="flex h-11 w-11 items-center justify-center bg-rubber text-xl text-foam-muted transition hover:text-foam"
          aria-label={`${label} verringern`}
        >
          −
        </button>
        <span
          className={`min-w-8 text-center font-display text-2xl ${
            danger
              ? "text-clay"
              : highlight
                ? "text-amber"
                : "text-foam"
          }`}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={onInc}
          className="flex h-11 w-11 items-center justify-center bg-rubber text-xl text-foam transition hover:bg-amber hover:text-asphalt"
          aria-label={`${label} erhöhen`}
        >
          +
        </button>
      </div>
    </div>
  );
}
