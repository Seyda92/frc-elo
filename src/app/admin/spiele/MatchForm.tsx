"use client";

import { useActionState, useEffect, useState } from "react";
import { recordMatch } from "@/app/admin/actions";
import { Field, FormStatus, SelectField, SubmitButton } from "@/components/form";
import { StatControl } from "@/components/StatControl";
import { WinnerButton } from "@/components/WinnerButton";
import { localDateTimeValue } from "@/lib/format";
import type { MatchFormPayload } from "@/lib/match-input";
import { ALLOWED_K_FACTORS } from "@/lib/match-input";
import type { ActionResult } from "@/lib/action-result";
import type { MatchEntryPlayer } from "@/db/queries";

type Side = "A" | "B" | null;
type RowState = { side: Side; bonusBeer: number; throws: number; hits: number };

const EMPTY_ROW: RowState = { side: null, bonusBeer: 0, throws: 0, hits: 0 };

export function MatchForm({
  players,
  events,
}: {
  players: MatchEntryPlayer[];
  events: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    recordMatch,
    null,
  );

  const [rows, setRows] = useState<Map<number, RowState>>(
    () => new Map(players.map((p) => [p.playerId, { ...EMPTY_ROW }])),
  );
  const [winner, setWinner] = useState<"A" | "B" | null>(null);
  const [refereeId, setRefereeId] = useState("");
  // Erst nach dem Mount mit der lokalen Zeit belegen (nicht beim ersten
  // Render, sonst SSR/Client-Hydration-Konflikt, falls der Server in einer
  // anderen Zeitzone liegt als der Browser).
  const [playedAt, setPlayedAt] = useState("");
  useEffect(() => {
    setPlayedAt(localDateTimeValue(new Date()));
  }, []);

  function setSide(playerId: number, side: Side) {
    setRows((prev) => {
      const next = new Map(prev);
      const row = next.get(playerId) ?? { ...EMPTY_ROW };
      next.set(playerId, { ...row, side });
      return next;
    });
    // Wird der gewählte Schiedsrichter nachträglich einem Team zugewiesen,
    // muss die Auswahl sofort geleert werden — sonst wird sie unbemerkt
    // ungültig (der Schiri stünde dann in seinem eigenen Match).
    if (side !== null && refereeId === String(playerId)) {
      setRefereeId("");
    }
  }

  function updateStat(playerId: number, field: "bonusBeer" | "throws" | "hits", delta: number) {
    setRows((prev) => {
      const row = prev.get(playerId);
      if (!row) return prev;
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

  const teamA = players.filter((p) => rows.get(p.playerId)?.side === "A");
  const teamB = players.filter((p) => rows.get(p.playerId)?.side === "B");
  const assignedIds = new Set([...teamA, ...teamB].map((p) => p.playerId));
  const refereeOptions = players
    .filter((p) => !assignedIds.has(p.playerId))
    .map((p) => ({ value: String(p.playerId), label: p.name }));

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

    const payload: MatchFormPayload = {
      playedAt: (() => {
        const raw = formData.get("played_at") as string;
        const parsed = raw ? new Date(raw) : new Date();
        return parsed.toISOString();
      })(),
      eventId: (formData.get("event_id") as string) || null,
      kFactor: (formData.get("k_factor") as string) ?? "",
      canDiff: (formData.get("can_diff") as string) ?? "0",
      note: (formData.get("note") as string) || null,
      refereePlayerId: refereeId || null,
      winner,
      teamA: teamA.map(rowPayload),
      teamB: teamB.map(rowPayload),
    };

    formData.set("payload", JSON.stringify(payload));
    formAction(formData);
  }

  return (
    <form action={handleSubmit} className="space-y-6 p-4 sm:p-5">
      <FormStatus state={state} />

      <div className="flex flex-wrap items-center justify-center gap-4">
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

      <p className="text-sm text-foam-muted">
        Team A · {teamA.length} Spieler &nbsp;·&nbsp; Team B · {teamB.length} Spieler
      </p>

      <div className="border border-line">
        <ul className="divide-y divide-line">
          {players.map((p) => {
            const row = rows.get(p.playerId) ?? EMPTY_ROW;
            return (
              <li key={p.playerId} className="px-3 py-3 sm:px-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-rubber font-display text-amber">
                      {p.jerseyNumber ?? "–"}
                    </span>
                    <div>
                      <p className="font-display text-lg text-foam">{p.name}</p>
                      <p className="text-xs text-foam-muted">
                        {p.clubName} · ELO {p.rating}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {(["A", null, "B"] as Side[]).map((side) => (
                      <button
                        key={side ?? "none"}
                        type="button"
                        onClick={() => setSide(p.playerId, side)}
                        className={`min-h-10 min-w-10 px-3 text-xs uppercase tracking-[0.14em] transition ${
                          row.side === side
                            ? "bg-amber text-asphalt"
                            : "border border-line text-foam-muted hover:border-amber hover:text-amber"
                        }`}
                      >
                        {side ?? "–"}
                      </button>
                    ))}
                  </div>
                </div>

                {row.side ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <StatControl
                      label="Bonusbier"
                      value={row.bonusBeer}
                      onInc={() => updateStat(p.playerId, "bonusBeer", 1)}
                      onDec={() => updateStat(p.playerId, "bonusBeer", -1)}
                    />
                    <StatControl
                      label="Würfe"
                      value={row.throws}
                      onInc={() => updateStat(p.playerId, "throws", 1)}
                      onDec={() => updateStat(p.playerId, "throws", -1)}
                    />
                    <StatControl
                      label="Treffer"
                      value={row.hits}
                      highlight
                      onInc={() => updateStat(p.playerId, "hits", 1)}
                      onDec={() => updateStat(p.playerId, "hits", -1)}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="block text-[0.65rem] uppercase tracking-[0.14em] text-foam-muted">
            Zeitpunkt *
          </span>
          <input
            className="mt-1 w-full min-h-11 border border-line bg-asphalt/60 px-3 py-2 text-foam outline-none transition focus:border-amber"
            name="played_at"
            type="datetime-local"
            required
            value={playedAt}
            onChange={(e) => setPlayedAt(e.target.value)}
          />
        </label>

        <SelectField
          label="Event"
          name="event_id"
          options={events.map((e) => ({ value: e.id, label: e.name }))}
        />

        <SelectField
          label="K-Faktor"
          name="k_factor"
          required
          options={ALLOWED_K_FACTORS.map((k) => ({ value: String(k), label: String(k) }))}
        />

        <Field label="Dosenunterschied" name="can_diff" type="number" min={0} defaultValue="0" />

        <label className="block">
          <span className="block text-[0.65rem] uppercase tracking-[0.14em] text-foam-muted">
            Schiedsrichter
          </span>
          <select
            className="mt-1 w-full min-h-11 border border-line bg-asphalt/60 px-3 py-2 text-foam outline-none transition focus:border-amber"
            value={refereeId}
            onChange={(e) => setRefereeId(e.target.value)}
          >
            <option value="">– keiner –</option>
            {refereeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <Field label="Notiz" name="note" placeholder="optional" />
      </div>

      <SubmitButton pending={pending}>Match speichern</SubmitButton>
    </form>
  );
}
