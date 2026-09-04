"use client";

import { useActionState, useEffect, useState } from "react";
import { createPlannedMatch, createPlayerForMatch } from "@/app/admin/actions";
import { Field, FormStatus, SelectField, SubmitButton } from "@/components/form";
import { localDateTimeValue } from "@/lib/format";
import type { PlannedMatchFormPayload } from "@/lib/match-input";
import type { ActionResult } from "@/lib/action-result";
import type { MatchEntryPlayer } from "@/db/queries";

type Side = "A" | "B" | null;

export function TeamBuilderForm({
  players,
  events,
  clubs,
  refereePlayerIds,
}: {
  players: MatchEntryPlayer[];
  events: { id: string; name: string }[];
  clubs: { id: string; name: string }[];
  refereePlayerIds: number[];
}) {
  // Bei Erfolg leitet createPlannedMatch serverseitig direkt zum Bewerten
  // weiter (redirect() in der Action) — kein Client-Redirect hier nötig.
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createPlannedMatch,
    null,
  );

  // Roster als State statt reines Prop: ein im Anlege-Block neu erfasster
  // Spieler wird angehängt, ohne die Seite neu zu laden — sonst ginge die
  // bereits eingeteilte Aufstellung verloren.
  const [roster, setRoster] = useState<MatchEntryPlayer[]>(players);
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
  // Filtert nur den "Noch nicht zugeordnet"-Pool, nicht Team A/B — die
  // Aufstellung soll beim Tippen immer vollständig sichtbar bleiben.
  const [poolFilter, setPoolFilter] = useState("");

  function setSide(playerId: number, side: Side) {
    setSides((prev) => {
      const next = new Map(prev);
      next.set(playerId, side);
      return next;
    });
    if (side !== null && refereeId === String(playerId)) {
      setRefereeId("");
    }
    // Nach einer Zuweisung zurücksetzen, sonst zeigt der Pool weiter nur
    // den alten, schmalen Ausschnitt, obwohl der nächste Spieler gesucht wird.
    if (side !== null) {
      setPoolFilter("");
    }
  }

  function handlePlayerCreated(newPlayer: MatchEntryPlayer) {
    setRoster((prev) => [...prev, newPlayer]);
    setSides((prev) => {
      const next = new Map(prev);
      next.set(newPlayer.playerId, null);
      return next;
    });
  }

  const pool = roster.filter((p) => sides.get(p.playerId) === null);
  const teamA = roster.filter((p) => sides.get(p.playerId) === "A");
  const teamB = roster.filter((p) => sides.get(p.playerId) === "B");
  const assignedIds = new Set([...teamA, ...teamB].map((p) => p.playerId));

  const trimmedFilter = poolFilter.trim().toLowerCase();
  const visiblePool =
    trimmedFilter === ""
      ? pool
      : pool.filter(
          (p) =>
            p.name.toLowerCase().includes(trimmedFilter) ||
            String(p.jerseyNumber ?? "").startsWith(trimmedFilter),
        );

  const refereeCandidates = roster.filter((p) => !assignedIds.has(p.playerId));
  const refereeSet = new Set(refereePlayerIds);
  const linkedReferees = refereeCandidates.filter((p) => refereeSet.has(p.playerId));
  const otherPlayers = refereeCandidates.filter((p) => !refereeSet.has(p.playerId));
  // Solange niemand verlinkt ist, sieht die Liste unverändert flach aus
  // (kein Gruppen-Label) — bewusster Rückfall, damit die Schiri-Auswahl nie
  // leerläuft, nur weil die Verlinkung noch fehlt.
  const hasLinkedReferees = linkedReferees.length > 0;

  function handleSubmit(formData: FormData) {
    const payload: PlannedMatchFormPayload = {
      playedAt: (() => {
        const raw = formData.get("played_at") as string;
        const parsed = raw ? new Date(raw) : new Date();
        return parsed.toISOString();
      })(),
      eventId: (formData.get("event_id") as string) || null,
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
            {hasLinkedReferees ? (
              <>
                <optgroup label="Schiris">
                  {linkedReferees.map((p) => (
                    <option key={p.playerId} value={String(p.playerId)}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
                {otherPlayers.length > 0 && (
                  <optgroup label="Alle Spieler">
                    {otherPlayers.map((p) => (
                      <option key={p.playerId} value={String(p.playerId)}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </>
            ) : (
              refereeCandidates.map((p) => (
                <option key={p.playerId} value={String(p.playerId)}>
                  {p.name}
                </option>
              ))
            )}
          </select>
        </label>

        <Field label="Name" name="name" placeholder="optional, z. B. „Finale“" />
      </div>

      <p className="text-sm text-foam-muted">
        Team A · {teamA.length} Spieler &nbsp;·&nbsp; Team B · {teamB.length} Spieler
      </p>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <TeamColumn title="Team A" accent="amber" side="A" roster={teamA} onSetSide={setSide} />
        <TeamColumn title="Team B" accent="foam" side="B" roster={teamB} onSetSide={setSide} />
      </div>

      {clubs.length > 0 && <NewPlayerBlock clubs={clubs} onCreated={handlePlayerCreated} />}

      <div className="border border-line">
        <header className="border-b border-line px-4 py-3">
          <h3 className="font-display text-lg text-foam-muted">
            Noch nicht zugeordnet (
            {trimmedFilter ? `${visiblePool.length} von ${pool.length}` : pool.length})
          </h3>
        </header>
        <div className="border-b border-line px-3 py-2 sm:px-4">
          <input
            className="w-full min-h-11 border border-line bg-asphalt/60 px-3 py-2 text-foam outline-none transition focus:border-amber"
            type="text"
            value={poolFilter}
            onChange={(e) => setPoolFilter(e.target.value)}
            onKeyDown={(e) => {
              // Ein <input> in diesem <form> würde bei Enter sonst das
              // ganze Match absenden — hier soll Enter nur filtern.
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder="Filtern: Name oder Rückennummer"
          />
        </div>
        <ul className="divide-y divide-line">
          {visiblePool.map((p) => (
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
          {pool.length > 0 && visiblePool.length === 0 && (
            <li className="px-3 py-4 text-sm text-foam-muted sm:px-4">Kein Spieler passt zum Filter.</li>
          )}
        </ul>
      </div>

      <SubmitButton pending={pending}>Match anlegen</SubmitButton>
    </form>
  );
}

/**
 * Eigenständiger Block außerhalb des Match-Formulars — HTML erlaubt keine
 * verschachtelten <form>-Elemente. Ruft die Action direkt mit einem Objekt
 * auf (kein FormData/useActionState), damit kein zweites <form> nötig ist.
 * Fehler werden lokal angezeigt, nicht im globalen Status des Match-Formulars.
 */
function NewPlayerBlock({
  clubs,
  onCreated,
}: {
  clubs: { id: string; name: string }[];
  onCreated: (player: MatchEntryPlayer) => void;
}) {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [clubId, setClubId] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function handleCreate() {
    const name = displayName.trim();
    if (!name || !clubId) {
      setResult({ ok: false, error: "Name und Verein sind Pflichtfelder." });
      return;
    }
    const parsedClubId = Number(clubId);
    const parsedJerseyNumber = jerseyNumber.trim() === "" ? null : Number(jerseyNumber);
    if (parsedJerseyNumber !== null && (!Number.isInteger(parsedJerseyNumber) || parsedJerseyNumber < 0)) {
      setResult({ ok: false, error: "Rückennummer muss eine ganze Zahl ab 0 sein." });
      return;
    }

    setPending(true);
    setResult(null);
    try {
      const res = await createPlayerForMatch({
        displayName: name,
        clubId: parsedClubId,
        jerseyNumber: parsedJerseyNumber,
      });
      setResult(res);
      if (res.ok) {
        onCreated(res.player);
        setDisplayName("");
        setClubId("");
        setJerseyNumber("");
      }
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-10 border border-line px-3 text-xs uppercase tracking-[0.14em] text-foam-muted transition hover:border-amber hover:text-amber"
      >
        + Spieler anlegen
      </button>
    );
  }

  return (
    <div className="border border-line bg-asphalt-raised/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg text-foam-muted">Spieler anlegen</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs uppercase tracking-[0.14em] text-foam-muted hover:text-amber"
        >
          Schließen
        </button>
      </div>

      <div className="mt-3 space-y-3">
        <FormStatus state={result} />
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="block text-[0.65rem] uppercase tracking-[0.14em] text-foam-muted">
              Name *
            </span>
            <input
              className="mt-1 w-full min-h-11 border border-line bg-asphalt/60 px-3 py-2 text-foam outline-none transition focus:border-amber"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Torben Reifen"
            />
          </label>

          <label className="block">
            <span className="block text-[0.65rem] uppercase tracking-[0.14em] text-foam-muted">
              Verein *
            </span>
            <select
              className="mt-1 w-full min-h-11 border border-line bg-asphalt/60 px-3 py-2 text-foam outline-none transition focus:border-amber"
              value={clubId}
              onChange={(e) => setClubId(e.target.value)}
            >
              <option value="">– bitte wählen –</option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-[0.65rem] uppercase tracking-[0.14em] text-foam-muted">
              Rückennummer
            </span>
            <input
              className="mt-1 w-full min-h-11 border border-line bg-asphalt/60 px-3 py-2 text-foam outline-none transition focus:border-amber"
              type="number"
              min={0}
              value={jerseyNumber}
              onChange={(e) => setJerseyNumber(e.target.value)}
            />
          </label>
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={handleCreate}
          className="min-h-12 bg-amber px-5 py-3 font-display uppercase tracking-wide text-asphalt transition hover:bg-amber-hot disabled:opacity-50"
        >
          {pending ? "Speichert…" : "Spieler anlegen"}
        </button>
      </div>
    </div>
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
