import type { EloMatchResult } from "./elo.ts";

/**
 * Reine Validierung/Ableitung für die Match-Erfassung — kein DB-, kein
 * Next-Zugriff, damit sich das Herzstück ohne Datenbank testen lässt. Die
 * Server Actions (src/app/admin/actions.ts) verdrahten nur noch, was hier
 * bewiesen ist.
 *
 * Zwei-Schritt-Ablauf: Anlegen (Kader + Metadaten, kein Ergebnis) und
 * Bewerten (Statistik + Sieger zu einem bereits feststehenden Kader). Beide
 * Schritte teilen sich die Metadaten-Prüfungen unten (Zeitpunkt, Event,
 * Schiedsrichter) — nur Kader-Form und Ergebnis-Pflicht unterscheiden sich.
 */

/**
 * Seit 09/2026 wird für jedes Spiel fest K = 40 verwendet: der "Spieltyp" war
 * nie eine eigene Spalte, sondern genau dieser K-Faktor, und die Auswahl im
 * Formular hat am Turniertag mehr Fehler als Nutzen gebracht.
 *
 * ALLOWED_K_FACTORS und K_FACTOR_LABELS bleiben bewusst stehen: ältere Spiele
 * in der DB tragen noch 50/30/20, und die Staffelung soll wiederbelebbar sein,
 * ohne sie neu herzuleiten.
 */
export const ALLOWED_K_FACTORS = [50, 40, 30, 20] as const;
export type KFactor = (typeof ALLOWED_K_FACTORS)[number];

/** K-Faktor für neu angelegte Spiele — nicht mehr im Formular wählbar. */
export const DEFAULT_K_FACTOR: KFactor = 40;

/** Spieltyp-Beschriftung für den K-Faktor. Aktuell ungenutzt, siehe oben. */
export const K_FACTOR_LABELS: Record<KFactor, string> = {
  50: "Turnier",
  40: "Liga",
  30: "Freundschaftsspiel",
  20: "Training",
};

/** Toleranz gegen Uhrenversatz zwischen Browser und Server. */
const FUTURE_GRACE_MS = 60_000;
const MAX_TEAM_SIZE = 20;
const MAX_TOTAL_PLAYERS = 40;

export type PayloadRow = {
  playerId: string;
  bonusBeer: number;
  throws: number;
  hits: number;
};

export type NormalizedRow = {
  playerId: number;
  bonusBeer: number;
  throws: number;
  hits: number;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseNonNegativeInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return null;
  return value;
}

function validateRows(
  rows: unknown,
  sideLabel: string,
): { ok: true; value: NormalizedRow[] } | { ok: false; error: string } {
  if (!Array.isArray(rows)) {
    return { ok: false, error: "Formulardaten sind unvollständig." };
  }
  if (rows.length < 1) {
    return { ok: false, error: `Team ${sideLabel} braucht mindestens einen Spieler.` };
  }
  if (rows.length > MAX_TEAM_SIZE) {
    return { ok: false, error: "Ein Team darf höchstens 20 Spieler haben." };
  }

  const normalized: NormalizedRow[] = [];
  const seen = new Set<number>();

  for (const row of rows) {
    if (!isPlainObject(row)) {
      return { ok: false, error: "Formulardaten sind unvollständig." };
    }
    const playerId = parsePositiveInt(row.playerId);
    if (playerId === null) {
      return { ok: false, error: "Formulardaten sind unvollständig." };
    }
    if (seen.has(playerId)) {
      return { ok: false, error: `Ein Spieler steht mehrfach in Team ${sideLabel}.` };
    }
    seen.add(playerId);

    const bonusBeer = parseNonNegativeInt(row.bonusBeer);
    if (bonusBeer === null || bonusBeer > 10) {
      return { ok: false, error: "Bonusbier muss zwischen 0 und 10 liegen." };
    }
    const throwsValue = parseNonNegativeInt(row.throws);
    const hitsValue = parseNonNegativeInt(row.hits);
    if (throwsValue === null || hitsValue === null) {
      return { ok: false, error: "Würfe und Treffer müssen ganze Zahlen ab 0 sein." };
    }
    if (hitsValue > throwsValue) {
      return { ok: false, error: "Treffer dürfen die Würfe nicht übersteigen." };
    }

    normalized.push({ playerId, bonusBeer, throws: throwsValue, hits: hitsValue });
  }

  return { ok: true, value: normalized };
}

/** Wie validateRows, aber ohne Statistikfelder — für den Anlegen-Schritt, in
 *  dem nur der Kader feststeht und noch nichts gespielt wurde. */
function validatePlayerIdRows(
  rows: unknown,
  sideLabel: string,
): { ok: true; value: number[] } | { ok: false; error: string } {
  if (!Array.isArray(rows)) {
    return { ok: false, error: "Formulardaten sind unvollständig." };
  }
  if (rows.length < 1) {
    return { ok: false, error: `Team ${sideLabel} braucht mindestens einen Spieler.` };
  }
  if (rows.length > MAX_TEAM_SIZE) {
    return { ok: false, error: "Ein Team darf höchstens 20 Spieler haben." };
  }

  const normalized: number[] = [];
  const seen = new Set<number>();

  for (const row of rows) {
    if (!isPlainObject(row)) {
      return { ok: false, error: "Formulardaten sind unvollständig." };
    }
    const playerId = parsePositiveInt(row.playerId);
    if (playerId === null) {
      return { ok: false, error: "Formulardaten sind unvollständig." };
    }
    if (seen.has(playerId)) {
      return { ok: false, error: `Ein Spieler steht mehrfach in Team ${sideLabel}.` };
    }
    seen.add(playerId);
    normalized.push(playerId);
  }

  return { ok: true, value: normalized };
}

/**
 * `allowFuture`: beim Anlegen eines geplanten Matches ist ein Zeitpunkt in
 * der Zukunft der Normalfall (das Spiel hat ja noch nicht stattgefunden).
 * Beim Bewerten bleibt die alte Regel bestehen — dort wird ein tatsächlich
 * gespieltes Match protokolliert, ein Zukunftsdatum ist dann ein Fehler
 * (abgesehen vom Uhrenversatz-Toleranzfenster).
 */
function validatePlayedAt(
  raw: Record<string, unknown>,
  now: Date,
  allowFuture: boolean,
): { ok: true; value: Date } | { ok: false; error: string } {
  if (typeof raw.playedAt !== "string") {
    return { ok: false, error: "Zeitpunkt ist ungültig." };
  }
  const playedAt = new Date(raw.playedAt);
  if (Number.isNaN(playedAt.getTime())) {
    return { ok: false, error: "Zeitpunkt ist ungültig." };
  }
  if (!allowFuture && playedAt.getTime() > now.getTime() + FUTURE_GRACE_MS) {
    return { ok: false, error: "Der Zeitpunkt darf nicht in der Zukunft liegen." };
  }
  return { ok: true, value: playedAt };
}

function validateEventId(
  raw: Record<string, unknown>,
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw.eventId === null || raw.eventId === undefined || raw.eventId === "") {
    return { ok: true, value: null };
  }
  const parsed = parsePositiveInt(raw.eventId);
  if (parsed === null) return { ok: false, error: "Formulardaten sind unvollständig." };
  return { ok: true, value: parsed };
}

function validateReferee(
  raw: Record<string, unknown>,
  teamAIds: Set<number>,
  teamBIds: Set<number>,
  refereePlayerIds: Set<number>,
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw.refereePlayerId === null || raw.refereePlayerId === undefined || raw.refereePlayerId === "") {
    return { ok: true, value: null };
  }
  const parsed = parsePositiveInt(raw.refereePlayerId);
  if (parsed === null) {
    return { ok: false, error: "Formulardaten sind unvollständig." };
  }
  if (teamAIds.has(parsed) || teamBIds.has(parsed)) {
    return { ok: false, error: "Der Schiedsrichter kann nicht selbst mitspielen." };
  }
  if (!refereePlayerIds.has(parsed)) {
    return { ok: false, error: "Dieser Spieler ist nicht als Schiri verknüpft." };
  }
  return { ok: true, value: parsed };
}

/** Wire-Format für den Anlegen-Schritt: nur Kader + Metadaten, kein Ergebnis. */
export type PlannedPayloadRow = { playerId: string };

export type PlannedMatchFormPayload = {
  playedAt: string;
  eventId: string | null;
  name: string | null;
  refereePlayerId: string | null;
  teamA: PlannedPayloadRow[];
  teamB: PlannedPayloadRow[];
};

export type NormalizedPlannedInput = {
  playedAt: Date;
  eventId: number | null;
  kFactor: KFactor;
  name: string | null;
  refereePlayerId: number | null;
  teamA: number[];
  teamB: number[];
};

export type PlannedValidationResult =
  | { ok: true; value: NormalizedPlannedInput }
  | { ok: false; error: string };

/**
 * Validiert das Anlegen eines geplanten Matches: Kader + Metadaten, aber
 * kein Sieger und keine Statistik — die kommen erst beim Bewerten dazu. Ein
 * Zeitpunkt in der Zukunft ist hier ausdrücklich erlaubt.
 */
export function validatePlannedMatchInput(
  raw: unknown,
  knownPlayers: Map<number, string>,
  now: Date,
  refereePlayerIds: Set<number>,
): PlannedValidationResult {
  if (!isPlainObject(raw)) {
    return { ok: false, error: "Formulardaten sind unvollständig." };
  }

  const teamAResult = validatePlayerIdRows(raw.teamA, "A");
  if (!teamAResult.ok) return teamAResult;
  const teamBResult = validatePlayerIdRows(raw.teamB, "B");
  if (!teamBResult.ok) return teamBResult;
  const teamA = teamAResult.value;
  const teamB = teamBResult.value;

  if (teamA.length + teamB.length > MAX_TOTAL_PLAYERS) {
    return { ok: false, error: "Zu viele Spieler in diesem Match." };
  }

  const teamAIds = new Set(teamA);
  for (const playerId of teamB) {
    if (teamAIds.has(playerId)) {
      const playerName = knownPlayers.get(playerId) ?? `Spieler ${playerId}`;
      return { ok: false, error: `${playerName} steht in beiden Teams.` };
    }
  }
  const teamBIds = new Set(teamB);

  const refereeResult = validateReferee(raw, teamAIds, teamBIds, refereePlayerIds);
  if (!refereeResult.ok) return refereeResult;
  const refereePlayerId = refereeResult.value;

  const playedAtResult = validatePlayedAt(raw, now, true);
  if (!playedAtResult.ok) return playedAtResult;
  const playedAt = playedAtResult.value;

  const eventIdResult = validateEventId(raw);
  if (!eventIdResult.ok) return eventIdResult;
  const eventId = eventIdResult.value;

  const name =
    typeof raw.name === "string" && raw.name.trim().length > 0 ? raw.name.trim() : null;

  for (const playerId of [...teamA, ...teamB]) {
    if (!knownPlayers.has(playerId)) {
      return { ok: false, error: "Unbekannter Spieler ausgewählt." };
    }
  }

  return {
    ok: true,
    // canDiff kommt beim Anlegen bewusst nicht aus dem Formular — der
    // Dosenunterschied wirkt zwar in der Elo-Formel (sizeFactor), wird aber
    // aktuell nirgends erfasst; fest 0, bis er automatisch (z. B. aus
    // markierten leeren Dosen je Spieler) hergeleitet werden kann. Der
    // K-Faktor ebenso: fest DEFAULT_K_FACTOR, siehe dort. note wird erst beim
    // Bewerten erfasst (siehe validateScoringInput), nicht hier.
    value: {
      playedAt,
      eventId,
      kFactor: DEFAULT_K_FACTOR,
      name,
      refereePlayerId,
      teamA,
      teamB,
    },
  };
}

/** Wire-Format für den Bewerten-Schritt: Statistik + Sieger zu einem
 *  bereits feststehenden Kader (kommt aus der DB, nicht vom Client). */
export type ScoringPayload = {
  winner: "A" | "B" | null;
  note: string | null;
  teamA: PayloadRow[];
  teamB: PayloadRow[];
};

export type NormalizedScoringInput = {
  winner: "A" | "B";
  note: string | null;
  teamA: NormalizedRow[];
  teamB: NormalizedRow[];
};

export type ScoringValidationResult =
  | { ok: true; value: NormalizedScoringInput }
  | { ok: false; error: string };

/**
 * Validiert das Bewerten eines geplanten Matches. Der Kader (rosterTeamA/B)
 * kommt aus der DB (match_planned_roster), nicht vom Client — validiert wird
 * nur, dass zu genau diesem Kader gültige Statistik plus ein Sieger
 * übermittelt wurde. Das verhindert nebenbei, dass eine manipulierte
 * Übermittlung einen anderen Kader unterschiebt.
 */
export function validateScoringInput(
  raw: unknown,
  rosterTeamA: number[],
  rosterTeamB: number[],
): ScoringValidationResult {
  if (!isPlainObject(raw)) {
    return { ok: false, error: "Formulardaten sind unvollständig." };
  }

  if (raw.winner !== "A" && raw.winner !== "B") {
    return { ok: false, error: "Bitte den Sieger auswählen." };
  }
  const winner = raw.winner;

  const teamAResult = validateRows(raw.teamA, "A");
  if (!teamAResult.ok) return teamAResult;
  const teamBResult = validateRows(raw.teamB, "B");
  if (!teamBResult.ok) return teamBResult;
  const teamA = teamAResult.value;
  const teamB = teamBResult.value;

  const rosterA = new Set(rosterTeamA);
  const rosterB = new Set(rosterTeamB);
  const submittedA = new Set(teamA.map((r) => r.playerId));
  const submittedB = new Set(teamB.map((r) => r.playerId));

  if (
    rosterA.size !== submittedA.size ||
    rosterB.size !== submittedB.size ||
    ![...rosterA].every((id) => submittedA.has(id)) ||
    ![...rosterB].every((id) => submittedB.has(id))
  ) {
    return {
      ok: false,
      error: "Die Statistik passt nicht zum geplanten Kader. Bitte Seite neu laden.",
    };
  }

  const totalThrows = [...teamA, ...teamB].reduce((sum, r) => sum + r.throws, 0);
  if (totalThrows === 0) {
    return { ok: false, error: "Mindestens ein Wurf muss erfasst sein." };
  }

  const note =
    typeof raw.note === "string" && raw.note.trim().length > 0 ? raw.note.trim() : null;

  return { ok: true, value: { winner, note, teamA, teamB } };
}

export type RatingBefore = { gamesPlayed: number; wins: number; losses: number };

export type RatingUpdate = {
  playerId: number;
  /** toFixed(4) — passend zu NUMERIC(10,4) in player_rating_current.rating */
  rating: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
};

/**
 * Leitet aus dem Elo-Ergebnis die neuen player_rating_current-Werte ab.
 * Sieg/Niederlage kommt aus der SEITE, nie aus dem Vorzeichen des Deltas —
 * ein Delta von 0 oder mit "falschem" Vorzeichen ist möglich (z. B. bei exakt
 * erwartetem Ausgang), der Spieler kann trotzdem gewonnen haben.
 */
export function deriveRatingUpdates(
  eloResult: EloMatchResult,
  before: Map<number, RatingBefore>,
  winnerSide: "A" | "B",
  teamAIds: number[],
): RatingUpdate[] {
  const teamASet = new Set(teamAIds);
  return eloResult.players.map((p) => {
    const prev = before.get(p.playerId);
    if (!prev) {
      throw new Error(`Kein bisheriger Rating-Stand für Spieler ${p.playerId} gefunden.`);
    }
    const onTeamA = teamASet.has(p.playerId);
    const won = (onTeamA && winnerSide === "A") || (!onTeamA && winnerSide === "B");
    return {
      playerId: p.playerId,
      rating: p.ratingAfter.toFixed(4),
      gamesPlayed: prev.gamesPlayed + 1,
      wins: prev.wins + (won ? 1 : 0),
      losses: prev.losses + (won ? 0 : 1),
    };
  });
}

/** Leitet aus dem Sieger die match_team.score-Werte ab (0/1, kein Remis). */
export function deriveTeamScores(winner: "A" | "B"): { scoreA: "0" | "1"; scoreB: "0" | "1" } {
  return winner === "A" ? { scoreA: "1", scoreB: "0" } : { scoreA: "0", scoreB: "1" };
}
