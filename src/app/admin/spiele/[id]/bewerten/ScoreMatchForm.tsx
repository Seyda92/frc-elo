"use client";

import { useActionState, useState } from "react";
import { scoreMatch } from "@/app/admin/actions";
import { Field, FormStatus, SubmitButton } from "@/components/form";
import { StatControl } from "@/components/StatControl";
import { WinnerButton } from "@/components/WinnerButton";
import type { ScoringPayload } from "@/lib/match-input";
import type { ActionResult } from "@/lib/action-result";
import type { MatchEntryPlayer } from "@/db/queries";

type RowState = { bonusBeer: number; throws: number; hits: number };
const EMPTY_ROW: RowState = { bonusBeer: 0, throws: 0, hits: 0 };

export function ScoreMatchForm({
  matchId,
  teamA,
  teamB,
  teamAName,
  teamBName,
}: {
  matchId: number;
  teamA: MatchEntryPlayer[];
  teamB: MatchEntryPlayer[];
  teamAName: string;
  teamBName: string;
}) {
  // Bei Erfolg leitet scoreMatch serverseitig auf /spiel/[id] weiter
  // (redirect() in der Action) — kein Client-Redirect hier nötig, und aus
  // gutem Grund: die Bewerten-Seite wird durch das Speichern selbst
  // ungültig (match_planned_roster ist danach leer), ein Client-Redirect
  // würde gegen Next.js' Revalidierung der aktuellen Route verlieren.
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    scoreMatch,
    null,
  );

  const [rows, setRows] = useState<Map<number, RowState>>(
    () => new Map([...teamA, ...teamB].map((p) => [p.playerId, { ...EMPTY_ROW }])),
  );
  const [winner, setWinner] = useState<"A" | "B" | null>(null);

  function updateStat(playerId: number, field: keyof RowState, delta: number) {
    setRows((prev) => {
      const row = prev.get(playerId) ?? { ...EMPTY_ROW };
      const next = new Map(prev);
      if (field === "bonusBeer") {
        next.set(playerId, { ...row, bonusBeer: Math.min(10, Math.max(0, row.bonusBeer + delta)) });
      } else if (field === "throws") {
        const throwsValue = Math.max(0, row.throws + delta);
        const hitsValue = Math.min(row.hits, throwsValue);
        next.set(playerId, { ...row, throws: throwsValue, hits: hitsValue });
      } else {
        const hitsValue = Math.max(0, Math.min(row.throws, row.hits + delta));
        next.set(playerId, { ...row, hits: hitsValue });
      }
      return next;
    });
  }

  function handleSubmit(formData: FormData) {
    const rowPayload = (p: MatchEntryPlayer) => {
      const row = rows.get(p.playerId) ?? EMPTY_ROW;
      return {
        playerId: String(p.playerId),
        bonusBeer: row.bonusBeer,
        throws: row.throws,
        hits: row.hits,
      };
    };

    const payload: ScoringPayload = {
      winner,
      note: (formData.get("note") as string) || null,
      teamA: teamA.map(rowPayload),
      teamB: teamB.map(rowPayload),
    };

    formData.set("match_id", String(matchId));
    formData.set("payload", JSON.stringify(payload));
    formAction(formData);
  }

  return (
    <form action={handleSubmit} className="space-y-6 p-4 sm:p-5">
      <FormStatus state={state} />

      <div className="flex flex-wrap items-center justify-center gap-4">
        <WinnerButton
          label={`${teamAName} gewinnt`}
          active={winner === "A"}
          onClick={() => setWinner("A")}
        />
        <span className="font-display text-2xl text-amber">VS</span>
        <WinnerButton
          label={`${teamBName} gewinnt`}
          active={winner === "B"}
          onClick={() => setWinner("B")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <TeamPanel
          title={teamAName}
          accent="amber"
          roster={teamA}
          rows={rows}
          isWinner={winner === "A"}
          onChange={updateStat}
        />
        <TeamPanel
          title={teamBName}
          accent="foam"
          roster={teamB}
          rows={rows}
          isWinner={winner === "B"}
          onChange={updateStat}
        />
      </div>

      <Field label="Notiz" name="note" placeholder="optional, z. B. Besonderheiten zum Spiel" />

      <SubmitButton pending={pending}>Ergebnis speichern</SubmitButton>
    </form>
  );
}

function TeamPanel({
  title,
  accent,
  roster,
  rows,
  isWinner,
  onChange,
}: {
  title: string;
  accent: "amber" | "foam";
  roster: MatchEntryPlayer[];
  rows: Map<number, RowState>;
  isWinner: boolean;
  onChange: (playerId: number, field: keyof RowState, delta: number) => void;
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
          <span className="text-xs uppercase tracking-[0.16em] text-amber">Sieger</span>
        )}
      </header>

      <ul className="divide-y divide-line">
        {roster.map((p) => {
          const row = rows.get(p.playerId) ?? EMPTY_ROW;
          return (
            <li key={p.playerId} className="px-3 py-4 sm:px-5">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center bg-rubber font-display text-amber">
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
                <StatControl
                  label="Würfe"
                  value={row.throws}
                  onInc={() => onChange(p.playerId, "throws", 1)}
                  onDec={() => onChange(p.playerId, "throws", -1)}
                />
                <StatControl
                  label="Treffer"
                  value={row.hits}
                  highlight
                  onInc={() => onChange(p.playerId, "hits", 1)}
                  onDec={() => onChange(p.playerId, "hits", -1)}
                />
                <StatControl
                  label="Bonusbier"
                  value={row.bonusBeer}
                  onInc={() => onChange(p.playerId, "bonusBeer", 1)}
                  onDec={() => onChange(p.playerId, "bonusBeer", -1)}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
