"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { saveLiveStats, scoreMatch } from "@/app/admin/actions";
import { Field } from "@/components/form";
import { StatControl } from "@/components/StatControl";
import { WinnerButton } from "@/components/WinnerButton";
import type { ScoringPayload } from "@/lib/match-input";
import type { ActionResult } from "@/lib/action-result";
import type { MatchEntryPlayer } from "@/db/queries";

/** Wartezeit nach der letzten Änderung, bevor der Zwischenstand für /live
 *  gespeichert wird — vermeidet einen Request pro einzelnem +/--Klick. */
const LIVE_STATS_DEBOUNCE_MS = 800;
const MAX_HISTORY = 12;

type RowState = { bonusBeer: number; throws: number; hits: number };
const EMPTY_ROW: RowState = { bonusBeer: 0, throws: 0, hits: 0 };

/** Schnick-Schnack-Schnuck-Auslosung (D22): je Seite optional ein
 *  auslosender Spieler + Ehrenstein-Zähler, kein Rundenlog. */
type RpsState = { playerId: number | null; ehrensteinCount: number };
const EMPTY_RPS: RpsState = { playerId: null, ehrensteinCount: 0 };

const FIELD_LABELS: Record<keyof RowState, string> = {
  throws: "Würfe",
  hits: "Treffer",
  bonusBeer: "Bonusbier",
};

type HistoryEntry = {
  playerId: number;
  playerName: string;
  field: keyof RowState;
  before: RowState;
  delta: number;
  ts: number;
};

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
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    scoreMatch,
    null,
  );
  const submitted = state?.ok === true;

  // Kader beim ersten Mount einfrieren, statt roster={teamA}/{teamB} direkt
  // aus den Props zu lesen: nach dem Speichern liefert die Server Component
  // (siehe page.tsx) ein leeres Roster (match_planned_roster ist dann
  // geleert), und ein erneuter Next.js-Refresh würde die Team-Panels sonst
  // leerlaufen lassen, obwohl das Formular selbst (rows/winner/history)
  // dank useState unverändert weiterlebt. Initializer läuft nur einmal.
  const [roster] = useState({ teamA, teamB, teamAName, teamBName });

  const rosterById = new Map([...roster.teamA, ...roster.teamB].map((p) => [p.playerId, p]));

  // Startet mit dem zuletzt gespeicherten Live-Zwischenstand (falls vorhanden)
  // statt immer bei 0 — sonst gingen bereits eingetragene Werte bei einem
  // Reload der Seite verloren, obwohl saveLiveStats sie schon gesichert hat.
  const [rows, setRows] = useState<Map<number, RowState>>(
    () =>
      new Map(
        [...roster.teamA, ...roster.teamB].map((p) => [
          p.playerId,
          {
            bonusBeer: p.liveBonusBeer ?? EMPTY_ROW.bonusBeer,
            throws: p.liveThrows ?? EMPTY_ROW.throws,
            hits: p.liveHits ?? EMPTY_ROW.hits,
          },
        ]),
      ),
  );
  const [winner, setWinner] = useState<"A" | "B" | null>(null);
  const [rpsA, setRpsA] = useState<RpsState>(EMPTY_RPS);
  const [rpsB, setRpsB] = useState<RpsState>(EMPTY_RPS);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  function updateStat(playerId: number, field: keyof RowState, delta: number) {
    setRows((prev) => {
      const row = prev.get(playerId) ?? { ...EMPTY_ROW };
      const next = new Map(prev);
      let nextRow: RowState;
      if (field === "bonusBeer") {
        nextRow = { ...row, bonusBeer: Math.min(10, Math.max(0, row.bonusBeer + delta)) };
      } else if (field === "throws") {
        const throwsValue = Math.max(0, row.throws + delta);
        const hitsValue = Math.min(row.hits, throwsValue);
        nextRow = { ...row, throws: throwsValue, hits: hitsValue };
      } else {
        const hitsValue = Math.max(0, Math.min(row.throws, row.hits + delta));
        nextRow = { ...row, hits: hitsValue };
      }
      if (nextRow[field] !== row[field]) {
        const player = rosterById.get(playerId);
        setHistory((h) => [
          { playerId, playerName: player?.name ?? "?", field, before: row, delta, ts: Date.now() },
          ...h,
        ].slice(0, MAX_HISTORY));
      }
      next.set(playerId, nextRow);
      return next;
    });
  }

  function undo() {
    const [last, ...rest] = history;
    if (!last) return;
    setRows((prev) => {
      const next = new Map(prev);
      next.set(last.playerId, last.before);
      return next;
    });
    setHistory(rest);
  }

  // Zwischenstand für /live speichern, debounced — vermeidet einen Request
  // pro einzelnem +/--Klick. Speicher-Status (savingLive/lastSavedAt) macht
  // das für den Schiri sichtbar statt es "still" im Hintergrund laufen zu
  // lassen (Handoff: "speichert…" / "gespeichert vor Xs").
  const [savingLive, setSavingLive] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const isFirstRun = useRef(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSavingLive(true);
    debounceRef.current = setTimeout(() => {
      const rowsPayload = [...roster.teamA, ...roster.teamB].map((p) => {
        const row = rows.get(p.playerId) ?? EMPTY_ROW;
        return {
          playerId: String(p.playerId),
          bonusBeer: row.bonusBeer,
          throws: row.throws,
          hits: row.hits,
        };
      });
      const formData = new FormData();
      formData.set("match_id", String(matchId));
      formData.set("rows", JSON.stringify(rowsPayload));
      saveLiveStats(null, formData)
        .then((result) => {
          setSaveFailed(!result.ok);
          setLastSavedAt(Date.now());
        })
        .catch(() => setSaveFailed(true))
        .finally(() => setSavingLive(false));
    }, LIVE_STATS_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roster ist eingefroren (useState), matchId aendert sich nie
  }, [rows]);

  // Sekündlich hochzählen für "gespeichert vor Xs" statt eines statischen
  // Zeitstempels.
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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

    const rpsRow = (rps: RpsState) =>
      rps.playerId !== null
        ? { playerId: String(rps.playerId), ehrensteinCount: rps.ehrensteinCount }
        : null;

    const payload: ScoringPayload = {
      winner,
      note: (formData.get("note") as string) || null,
      teamA: roster.teamA.map(rowPayload),
      teamB: roster.teamB.map(rowPayload),
      rpsDraw: { A: rpsRow(rpsA), B: rpsRow(rpsB) },
    };

    formData.set("match_id", String(matchId));
    formData.set("payload", JSON.stringify(payload));
    formAction(formData);
  }

  const lastEntry = history[0];
  const lastActionLabel = lastEntry
    ? `Letzte Eingabe: ${lastEntry.playerName} · ${FIELD_LABELS[lastEntry.field]} ${
        lastEntry.delta > 0 ? "+" : ""
      }${lastEntry.delta}`
    : "Noch keine Eingabe in dieser Sitzung";

  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-b border-line bg-[var(--color-header)] px-3 py-[8px] sm:px-[14px]">
        <Link
          href="/live"
          className="text-[11.5px] uppercase tracking-[0.1em] text-amber transition hover:text-amber-hot"
        >
          ‹ Live-Ansicht
        </Link>
        <SaveStatus saving={savingLive} savedAt={lastSavedAt} failed={saveFailed} now={nowTick} />
      </div>

      <form action={handleSubmit} className="space-y-6 p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-2">
          <WinnerButton
            label={`${roster.teamAName} gewinnt`}
            active={winner === "A"}
            onClick={() => setWinner("A")}
          />
          <WinnerButton
            label={`${roster.teamBName} gewinnt`}
            active={winner === "B"}
            onClick={() => setWinner("B")}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          <TeamPanel
            title={roster.teamAName}
            accent="amber"
            roster={roster.teamA}
            rows={rows}
            isWinner={winner === "A"}
            onChange={updateStat}
          />
          <TeamPanel
            title={roster.teamBName}
            accent="foam"
            roster={roster.teamB}
            rows={rows}
            isWinner={winner === "B"}
            onChange={updateStat}
          />
        </div>

        <div className="flex items-center justify-between gap-[10px] border-b border-line pb-4">
          <span className="min-w-0 truncate text-xs text-foam-muted">{lastActionLabel}</span>
          <button
            type="button"
            onClick={undo}
            disabled={history.length === 0}
            className={`min-h-11 shrink-0 border px-[14px] text-[11px] uppercase tracking-[0.14em] transition ${
              history.length === 0
                ? "border-line text-foam-faint"
                : "border-clay text-clay hover:bg-clay/10"
            }`}
          >
            Rückgängig
          </button>
        </div>

        <RpsDrawSection
          teamAName={roster.teamAName}
          teamBName={roster.teamBName}
          teamA={roster.teamA}
          teamB={roster.teamB}
          rpsA={rpsA}
          rpsB={rpsB}
          onChangeA={setRpsA}
          onChangeB={setRpsB}
        />

        <Field label="Notiz" name="note" placeholder="optional, z. B. Besonderheiten zum Spiel" />

        <div>
          <button
            type="submit"
            disabled={pending || winner === null}
            className={`min-h-14 w-full font-display text-sm uppercase tracking-[0.08em] transition ${
              winner === null
                ? "bg-rubber text-foam-faint"
                : "bg-amber text-asphalt hover:bg-amber-hot disabled:opacity-60"
            }`}
          >
            {pending ? "Speichert…" : "Ergebnis speichern"}
          </button>
          <p className="mt-2 text-center text-[11.5px] text-foam-muted">
            {winner === null
              ? "Sieger wählen, um zu speichern."
              : "ELO wird für 4 Spieler neu berechnet."}
          </p>
        </div>

        {state && !state.ok ? (
          <p role="status" className="border border-clay px-3 py-2 text-sm text-clay">
            {state.error}
          </p>
        ) : null}

        {submitted ? (
          <div className="border-t-[3px] border-transparent bg-[var(--color-success-bg)] p-[14px] [border-image:repeating-linear-gradient(-35deg,var(--color-clay)_0px,var(--color-clay)_8px,var(--color-signal-yellow)_8px,var(--color-signal-yellow)_16px)_1]">
            <p className="font-display text-[15px] text-moss">
              Ergebnis gespeichert · ELO aktualisiert
            </p>
            <div className="mt-[10px] grid grid-cols-2 gap-2">
              <Link
                href={`/spiel/${state.matchId}`}
                className="flex min-h-12 items-center justify-center border border-amber text-[11px] uppercase tracking-[0.12em] text-amber transition hover:bg-amber/10"
              >
                Zum Spielbericht
              </Link>
              <Link
                href="/admin/spiele/anlegen"
                className="flex min-h-12 items-center justify-center bg-amber text-[11px] uppercase tracking-[0.12em] text-asphalt transition hover:bg-amber-hot"
              >
                Nächstes Spiel anlegen
              </Link>
            </div>
          </div>
        ) : null}
      </form>
    </div>
  );
}

function SaveStatus({
  saving,
  savedAt,
  failed,
  now,
}: {
  saving: boolean;
  savedAt: number | null;
  failed: boolean;
  now: number;
}) {
  if (saving) {
    return (
      <span className="flex items-center gap-[6px] text-[11px] text-signal-yellow">
        <span className="h-[7px] w-[7px] bg-signal-yellow" />
        speichert…
      </span>
    );
  }
  if (failed) {
    return (
      <span className="flex items-center gap-[6px] text-[11px] text-clay">
        <span className="h-[7px] w-[7px] bg-clay" />
        offline — wird nachgesendet
      </span>
    );
  }
  if (savedAt == null) return null;
  const seconds = Math.max(0, Math.round((now - savedAt) / 1000));
  return (
    <span className="flex items-center gap-[6px] text-[11px] text-moss">
      <span className="h-[7px] w-[7px] bg-moss" />
      gespeichert vor {seconds}s
    </span>
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
      className={
        isWinner ? "border border-amber bg-amber/5" : "border border-line bg-asphalt-raised/40"
      }
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

/** Schnick-Schnack-Schnuck-Auslosung (D22): je Seite optional ein
 *  Spieler-Dropdown + ein "+1 Ehrenstein"-Zähler. Passiert selten genug,
 *  dass ein eigener Live-Zwischenstand nicht lohnt — wird zusammen mit dem
 *  restlichen Ergebnis final gespeichert. */
function RpsDrawSection({
  teamAName,
  teamBName,
  teamA,
  teamB,
  rpsA,
  rpsB,
  onChangeA,
  onChangeB,
}: {
  teamAName: string;
  teamBName: string;
  teamA: MatchEntryPlayer[];
  teamB: MatchEntryPlayer[];
  rpsA: RpsState;
  rpsB: RpsState;
  onChangeA: (next: RpsState) => void;
  onChangeB: (next: RpsState) => void;
}) {
  return (
    <section className="border border-line bg-asphalt-raised/40 p-4 sm:p-5">
      <h2 className="font-display text-xl tracking-tight text-foam">Ehrenstein</h2>
      <p className="mt-1 text-sm text-foam-muted">
        Optional — wer hat für welche Seite ausgelost, und wie oft dabei Ehrenstein (Stein)
        gespielt?
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <RpsSidePicker label={teamAName} roster={teamA} state={rpsA} onChange={onChangeA} />
        <RpsSidePicker label={teamBName} roster={teamB} state={rpsB} onChange={onChangeB} />
      </div>
    </section>
  );
}

function RpsSidePicker({
  label,
  roster,
  state,
  onChange,
}: {
  label: string;
  roster: MatchEntryPlayer[];
  state: RpsState;
  onChange: (next: RpsState) => void;
}) {
  return (
    <div className="border border-line bg-asphalt/60 p-3">
      <label className="block text-xs uppercase tracking-[0.14em] text-foam-muted">{label}</label>
      <select
        value={state.playerId ?? ""}
        onChange={(e) => {
          const value = e.target.value;
          onChange(value === "" ? EMPTY_RPS : { ...state, playerId: Number(value) });
        }}
        className="mt-2 w-full border border-line bg-asphalt px-3 py-2 text-foam"
      >
        <option value="">— kein Auslos-Spieler —</option>
        {roster.map((p) => (
          <option key={p.playerId} value={p.playerId}>
            {p.name}
          </option>
        ))}
      </select>

      {state.playerId !== null ? (
        <div className="mt-3">
          <StatControl
            label="Ehrensteine"
            value={state.ehrensteinCount}
            highlight
            onInc={() => onChange({ ...state, ehrensteinCount: state.ehrensteinCount + 1 })}
            onDec={() =>
              onChange({ ...state, ehrensteinCount: Math.max(0, state.ehrensteinCount - 1) })
            }
          />
        </div>
      ) : null}
    </div>
  );
}
