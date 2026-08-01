"use client";

import { useActionState, useEffect, useState } from "react";
import { createPlannedMatch } from "@/app/admin/actions";
import { Field, FormStatus, SelectField, SubmitButton } from "@/components/form";
import { localDateTimeValue } from "@/lib/format";
import type { PlannedMatchFormPayload } from "@/lib/match-input";
import { ALLOWED_K_FACTORS, K_FACTOR_LABELS } from "@/lib/match-input";
import type { ActionResult } from "@/lib/action-result";
import type { MatchEntryPlayer } from "@/db/queries";

type Side = "A" | "B" | null;

export function TeamBuilderForm({
  players,
  events,
}: {
  players: MatchEntryPlayer[];
  events: { id: string; name: string }[];
}) {
  // Bei Erfolg leitet createPlannedMatch serverseitig direkt zum Bewerten
  // weiter (redirect() in der Action) — kein Client-Redirect hier nötig.
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createPlannedMatch,
    null,
  );

  const [sides, setSides] = useState<Map<number, Side>>(
    () => new Map(players.map((p) => [p.playerId, null])),
  );
  const [refereeId, setRefereeId] = useState("");
  // Erst nach dem Mount mit der lokalen Zeit belegen (nicht beim ersten
  // Render, sonst SSR/Client-Hydration-Konflikt, falls der Server in einer
  // anderen Zeitzone liegt als der Browser).
  const [playedAt, setPlayedAt] = useState("");
  useEffect(() => {
    setPlayedAt(localDateTimeValue(new Date()));
  }, []);

  function setSide(playerId: number, side: Side) {
    setSides((prev) => {
      const next = new Map(prev);
      next.set(playerId, side);
      return next;
    });
    if (side !== null && refereeId === String(playerId)) {
      setRefereeId("");
    }
  }

  const pool = players.filter((p) => sides.get(p.playerId) === null);
  const teamA = players.filter((p) => sides.get(p.playerId) === "A");
  const teamB = players.filter((p) => sides.get(p.playerId) === "B");
  const assignedIds = new Set([...teamA, ...teamB].map((p) => p.playerId));
  const refereeOptions = players
    .filter((p) => !assignedIds.has(p.playerId))
    .map((p) => ({ value: String(p.playerId), label: p.name }));

  function handleSubmit(formData: FormData) {
    const payload: PlannedMatchFormPayload = {
      playedAt: (() => {
        const raw = formData.get("played_at") as string;
        const parsed = raw ? new Date(raw) : new Date();
        return parsed.toISOString();
      })(),
      eventId: (formData.get("event_id") as string) || null,
      kFactor: (formData.get("k_factor") as string) ?? "",
      name: (formData.get("name") as string) || null,
      refereePlayerId: refereeId || null,
      teamA: teamA.map((p) => ({ playerId: String(p.playerId) })),
      teamB: teamB.map((p) => ({ playerId: String(p.playerId) })),
    };

    formData.set("payload", JSON.stringify(payload));
    formAction(formData);
  }

  return (
    <form action={handleSubmit} className="space-y-6 p-4 sm:p-5">
      <FormStatus state={state} />

      <p className="text-sm text-foam-muted">
        Team A · {teamA.length} Spieler &nbsp;·&nbsp; Team B · {teamB.length} Spieler
      </p>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <TeamColumn title="Team A" accent="amber" side="A" roster={teamA} onSetSide={setSide} />
        <TeamColumn title="Team B" accent="foam" side="B" roster={teamB} onSetSide={setSide} />
      </div>

      <div className="border border-line">
        <header className="border-b border-line px-4 py-3">
          <h3 className="font-display text-lg text-foam-muted">
            Noch nicht zugeordnet ({pool.length})
          </h3>
        </header>
        <ul className="divide-y divide-line">
          {pool.map((p) => (
            <li key={p.playerId} className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-rubber font-display text-amber">
                  {p.jerseyNumber ?? "–"}
                </span>
                <div>
                  <p className="font-display text-lg text-foam">{p.name}</p>
                  <p className="text-xs text-foam-muted">{p.clubName}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <SideButton label="A" active={false} onClick={() => setSide(p.playerId, "A")} />
                <SideButton label="B" active={false} onClick={() => setSide(p.playerId, "B")} />
              </div>
            </li>
          ))}
          {pool.length === 0 && (
            <li className="px-3 py-4 text-sm text-foam-muted sm:px-4">Alle Spieler zugeordnet.</li>
          )}
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
          label="Spieltyp"
          name="k_factor"
          required
          options={ALLOWED_K_FACTORS.map((k) => ({ value: String(k), label: K_FACTOR_LABELS[k] }))}
        />

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

        <Field label="Name" name="name" placeholder="optional, z. B. „Finale“" />
      </div>

      <SubmitButton pending={pending}>Match anlegen</SubmitButton>
    </form>
  );
}

function TeamColumn({
  title,
  accent,
  side,
  roster,
  onSetSide,
}: {
  title: string;
  accent: "amber" | "foam";
  side: Side;
  roster: MatchEntryPlayer[];
  onSetSide: (playerId: number, side: Side) => void;
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
          <li key={p.playerId} className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-rubber font-display text-amber">
                {p.jerseyNumber ?? "–"}
              </span>
              <div>
                <p className="font-display text-lg text-foam">{p.name}</p>
                <p className="text-xs text-foam-muted">{p.clubName}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSetSide(p.playerId, null)}
              className="min-h-10 px-3 text-xs uppercase tracking-[0.14em] text-foam-muted transition hover:border-amber hover:text-amber border border-line"
            >
              Entfernen
            </button>
          </li>
        ))}
        {roster.length === 0 && (
          <li className="px-3 py-4 text-sm text-foam-muted sm:px-4">
            Noch keine Spieler in Team {side}.
          </li>
        )}
      </ul>
    </section>
  );
}

function SideButton({
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
      className={`min-h-10 min-w-10 px-3 text-xs uppercase tracking-[0.14em] transition ${
        active
          ? "bg-amber text-asphalt"
          : "border border-line text-foam-muted hover:border-amber hover:text-amber"
      }`}
    >
      {label}
    </button>
  );
}
