import type { EloMatchResult } from "./elo.ts";

/**
 * Reine Validierung/Ableitung für die Match-Erfassung — kein DB-, kein
 * Next-Zugriff, damit sich das Herzstück ohne Datenbank testen lässt. Die
 * Server Action (src/app/admin/actions.ts) verdrahtet nur noch, was hier
 * bewiesen ist.
 */

export const ALLOWED_K_FACTORS = [50, 40, 30, 20] as const;
export type KFactor = (typeof ALLOWED_K_FACTORS)[number];

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

/** Wire-Format, das MatchForm als JSON in das versteckte Feld schreibt. */
export type MatchFormPayload = {
  /** ISO-8601 MIT Offset — new Date(lokalerWert).toISOString() im Browser. */
  playedAt: string;
  eventId: string | null;
  kFactor: string;
  canDiff: string;
  note: string | null;
  refereePlayerId: string | null;
  winner: "A" | "B" | null;
  teamA: PayloadRow[];
  teamB: PayloadRow[];
};

export type NormalizedRow = {
  playerId: number;
  bonusBeer: number;
  throws: number;
  hits: number;
};

export type NormalizedMatchInput = {
  playedAt: Date;
  eventId: number | null;
  kFactor: KFactor;
  canDiff: number;
  note: string | null;
  refereePlayerId: number | null;
  winner: "A" | "B";
  teamA: NormalizedRow[];
  teamB: NormalizedRow[];
};

export type ValidationResult =
  | { ok: true; value: NormalizedMatchInput }
  | { ok: false; error: string };

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

export function validateMatchInput(
  raw: unknown,
  knownPlayers: Map<number, string>,
  now: Date,
): ValidationResult {
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

  if (teamA.length + teamB.length > MAX_TOTAL_PLAYERS) {
    return { ok: false, error: "Zu viele Spieler in diesem Match." };
  }

  const teamAIds = new Set(teamA.map((r) => r.playerId));
  for (const row of teamB) {
    if (teamAIds.has(row.playerId)) {
      const name = knownPlayers.get(row.playerId) ?? `Spieler ${row.playerId}`;
      return { ok: false, error: `${name} steht in beiden Teams.` };
    }
  }

  let refereePlayerId: number | null = null;
  if (raw.refereePlayerId !== null && raw.refereePlayerId !== undefined && raw.refereePlayerId !== "") {
    const parsed = parsePositiveInt(raw.refereePlayerId);
    if (parsed === null) {
      return { ok: false, error: "Formulardaten sind unvollständig." };
    }
    if (teamAIds.has(parsed) || teamB.some((r) => r.playerId === parsed)) {
      return { ok: false, error: "Der Schiedsrichter kann nicht selbst mitspielen." };
    }
    refereePlayerId = parsed;
  }

  const kFactorNum = Number(raw.kFactor);
  if (!ALLOWED_K_FACTORS.includes(kFactorNum as KFactor)) {
    return { ok: false, error: "K-Faktor muss 50, 40, 30 oder 20 sein." };
  }
  const kFactor = kFactorNum as KFactor;

  if (typeof raw.canDiff !== "string") {
    return { ok: false, error: "Dosenunterschied muss eine ganze Zahl ab 0 sein." };
  }
  const canDiffNum = Number(raw.canDiff);
  if (!Number.isInteger(canDiffNum) || canDiffNum < 0) {
    return { ok: false, error: "Dosenunterschied muss eine ganze Zahl ab 0 sein." };
  }

  if (typeof raw.playedAt !== "string") {
    return { ok: false, error: "Zeitpunkt ist ungültig." };
  }
  const playedAt = new Date(raw.playedAt);
  if (Number.isNaN(playedAt.getTime())) {
    return { ok: false, error: "Zeitpunkt ist ungültig." };
  }
  if (playedAt.getTime() > now.getTime() + FUTURE_GRACE_MS) {
    return { ok: false, error: "Der Zeitpunkt darf nicht in der Zukunft liegen." };
  }

  let eventId: number | null = null;
  if (raw.eventId !== null && raw.eventId !== undefined && raw.eventId !== "") {
    const parsed = parsePositiveInt(raw.eventId);
    if (parsed === null) return { ok: false, error: "Formulardaten sind unvollständig." };
    eventId = parsed;
  }

  const note =
    typeof raw.note === "string" && raw.note.trim().length > 0 ? raw.note.trim() : null;

  for (const row of [...teamA, ...teamB]) {
    if (!knownPlayers.has(row.playerId)) {
      return { ok: false, error: "Unbekannter Spieler ausgewählt." };
    }
  }

  return {
    ok: true,
    value: { playedAt, eventId, kFactor, canDiff: canDiffNum, note, refereePlayerId, winner, teamA, teamB },
  };
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
 * bei 10 Bonusbieren ist das Delta exakt 0, der Spieler kann trotzdem
 * gewonnen haben.
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
