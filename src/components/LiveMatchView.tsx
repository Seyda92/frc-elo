"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fetchLiveMatch } from "@/app/live/actions";
import { formatDateTime } from "@/lib/format";
import type { MatchEntryPlayer, PlannedMatchDetail } from "@/db/queries";

/** Wie oft /live nachfragt, ob sich der Zwischenstand geändert hat — kein
 *  WebSocket-Setup im Projekt, daher Polling. */
const POLL_INTERVAL_MS = 3000;

export function LiveMatchView({ initialMatch }: { initialMatch: PlannedMatchDetail | undefined }) {
  const [match, setMatch] = useState(initialMatch);
  const inFlight = useRef(false);

  useEffect(() => {
    const id = setInterval(async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        setMatch(await fetchLiveMatch());
      } catch {
        // still — ein einzelner fehlgeschlagener Poll ist kein Problem,
        // der naechste Versuch folgt in POLL_INTERVAL_MS.
      } finally {
        inFlight.current = false;
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  if (!match) {
    return (
      <div className="flex min-h-[calc(100svh-3.5rem)] flex-col items-center justify-center gap-4 bg-asphalt px-4 text-center">
        <p className="text-xs uppercase tracking-[0.22em] text-amber">Live</p>
        <h1 className="font-display text-2xl text-foam sm:text-3xl">
          Gerade läuft kein Spiel.
        </h1>
        <Link
          href="/"
          className="border border-line px-4 py-2 text-xs uppercase tracking-[0.14em] text-foam-muted transition hover:border-amber hover:text-amber"
        >
          Zum Leaderboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <div className="border-b border-line bg-asphalt-raised/80">
        <div className="stripe-leuchtturm h-1.5 w-full" aria-hidden="true" />
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-clay">
              <span className="h-2 w-2 animate-[pulse-hit_1.4s_ease-out_infinite] bg-clay" />
              Live
              {match.eventName ? ` · ${match.eventName}` : ""}
            </p>
            <h1 className="font-display text-3xl tracking-tight text-foam sm:text-4xl">
              {match.teamAName} vs. {match.teamBName}
            </h1>
            <p className="mt-1 text-sm text-foam-muted">
              {formatDateTime(match.playedAt)}
              {match.refereeName ? ` · Schiri: ${match.refereeName}` : ""}
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
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          <TeamPanel title={match.teamAName} accent="amber" roster={match.teamA} />
          <TeamPanel title={match.teamBName} accent="foam" roster={match.teamB} />
        </div>

        <p className="mt-8 text-center text-sm text-foam-muted">
          Zuschauer-Ansicht — die Statistik wird über das Bewerten-Formular erfasst.
        </p>
      </div>
    </div>
  );
}

function TeamPanel({
  title,
  accent,
  roster,
}: {
  title: string;
  accent: "amber" | "foam";
  roster: MatchEntryPlayer[];
}) {
  return (
    <section className="border border-line bg-asphalt-raised/40">
      <header className="border-b border-line px-4 py-4 sm:px-5">
        <h2
          className={`font-display text-3xl tracking-tight ${
            accent === "amber" ? "text-amber" : "text-foam"
          }`}
        >
          {title}
        </h2>
      </header>

      <ul className="divide-y divide-line">
        {roster.map((p) => (
          <li key={p.playerId} className="px-3 py-4 sm:px-5">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center bg-rubber font-display text-amber">
                {p.jerseyNumber ?? "–"}
              </span>
              <div>
                <p className="font-display text-xl text-foam sm:text-2xl">
                  {p.name}
                  {p.alias ? (
                    <span className="ml-2 text-sm font-normal text-foam-muted">
                      ({p.alias})
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-foam-muted">ELO {p.rating}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <StatCell label="Würfe" value={p.liveThrows ?? 0} />
              <StatCell label="Treffer" value={p.liveHits ?? 0} highlight />
              <StatCell label="Bonusbier" value={p.liveBonusBeer ?? 0} />
            </div>
          </li>
        ))}
      </ul>
    </section>
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
