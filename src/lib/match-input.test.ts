import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveRatingUpdates,
  deriveTeamScores,
  validatePlannedMatchInput,
  validateScoringInput,
  type PlannedMatchFormPayload,
  type ScoringPayload,
} from "./match-input.ts";
import type { EloMatchResult } from "./elo.ts";

const NOW = new Date("2026-07-31T20:00:00.000Z");

const KNOWN = new Map<number, string>([
  [1, "Torben Reifen"],
  [2, "Mila Flunky"],
  [3, "Jonas Asphalt"],
  [4, "Saskia Dose"],
]);

// Alle KNOWN-Spieler gelten in diesen Tests als verlinkte Schiris, außer wo
// gezielt eine engere/leere Menge übergeben wird.
const ALL_REFEREES = new Set(KNOWN.keys());

// --- validatePlannedMatchInput ---

function plannedBasePayload(overrides: Partial<PlannedMatchFormPayload> = {}): unknown {
  return {
    playedAt: NOW.toISOString(),
    eventId: null,
    name: null,
    refereePlayerId: null,
    teamA: [{ playerId: "1" }],
    teamB: [{ playerId: "2" }],
    ...overrides,
  };
}

test("geplant: gueltige minimale Nutzlast wird akzeptiert, kein winner noetig", () => {
  const result = validatePlannedMatchInput(plannedBasePayload(), KNOWN, NOW, ALL_REFEREES);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value.teamA, [1]);
    assert.deepEqual(result.value.teamB, [2]);
  }
});

test("geplant: leeres Team A wird abgelehnt", () => {
  const result = validatePlannedMatchInput(plannedBasePayload({ teamA: [] }), KNOWN, NOW, ALL_REFEREES);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Team A/);
});

test("geplant: leeres Team B wird abgelehnt", () => {
  const result = validatePlannedMatchInput(plannedBasePayload({ teamB: [] }), KNOWN, NOW, ALL_REFEREES);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Team B/);
});

test("geplant: 21 Spieler in einem Team werden abgelehnt", () => {
  const teamA = Array.from({ length: 21 }, (_, i) => ({ playerId: String(i + 100) }));
  const result = validatePlannedMatchInput(plannedBasePayload({ teamA }), KNOWN, NOW, ALL_REFEREES);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /höchstens 20/);
});

test("geplant: Spieler in beiden Teams wird mit Namen abgelehnt", () => {
  const result = validatePlannedMatchInput(
    plannedBasePayload({ teamA: [{ playerId: "1" }], teamB: [{ playerId: "1" }] }),
    KNOWN,
    NOW,
    ALL_REFEREES,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Torben Reifen/);
});

test("geplant: Spieler doppelt innerhalb eines Teams wird abgelehnt", () => {
  const result = validatePlannedMatchInput(
    plannedBasePayload({ teamA: [{ playerId: "1" }, { playerId: "1" }] }),
    KNOWN,
    NOW,
    ALL_REFEREES,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /mehrfach/);
});

test("geplant: Schiedsrichter im eigenen Kader wird abgelehnt", () => {
  const result = validatePlannedMatchInput(
    plannedBasePayload({ refereePlayerId: "1" }),
    KNOWN,
    NOW,
    ALL_REFEREES,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Schiedsrichter/);
});

test("geplant: gueltiger Schiedsrichter wird akzeptiert", () => {
  const result = validatePlannedMatchInput(
    plannedBasePayload({ refereePlayerId: "3" }),
    KNOWN,
    NOW,
    ALL_REFEREES,
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.refereePlayerId, 3);
});

test("geplant: Schiedsrichter ohne Schiri-Verknuepfung wird abgelehnt", () => {
  const result = validatePlannedMatchInput(
    plannedBasePayload({ refereePlayerId: "3" }),
    KNOWN,
    NOW,
    new Set([1, 2]), // Spieler 3 ist nicht verlinkt
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /nicht als Schiri verknüpft/);
});

test("geplant: K-Faktor ist immer fest 40, unabhaengig vom Payload", () => {
  // Das Formular hat kein k_factor-Feld mehr; selbst wenn ein Aufrufer eines
  // mitschickt, darf es keine Wirkung haben.
  const withStrayField = plannedBasePayload() as Record<string, unknown>;
  withStrayField.kFactor = "20";
  const result = validatePlannedMatchInput(withStrayField, KNOWN, NOW, ALL_REFEREES);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.kFactor, 40);
});

test("geplant: ungueltiges Datum wird abgelehnt", () => {
  const result = validatePlannedMatchInput(
    plannedBasePayload({ playedAt: "kein-datum" }),
    KNOWN,
    NOW,
    ALL_REFEREES,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Zeitpunkt/);
});

test("geplant: Zeitpunkt in der Zukunft wird akzeptiert (ein geplantes Match liegt per Definition voraus)", () => {
  const future = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const result = validatePlannedMatchInput(
    plannedBasePayload({ playedAt: future }),
    KNOWN,
    NOW,
    ALL_REFEREES,
  );
  assert.equal(result.ok, true);
});

test("geplant: unbekannte Spieler-ID wird abgelehnt", () => {
  const result = validatePlannedMatchInput(
    plannedBasePayload({ teamA: [{ playerId: "999" }] }),
    KNOWN,
    NOW,
    ALL_REFEREES,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Unbekannter Spieler/);
});

test("geplant: kaputte Nutzlast wirft nicht, sondern liefert ok:false", () => {
  for (const bad of [null, undefined, "text", 42, [], { teamA: "x", teamB: "y" }]) {
    assert.doesNotThrow(() => {
      const result = validatePlannedMatchInput(bad, KNOWN, NOW, ALL_REFEREES);
      assert.equal(result.ok, false);
    });
  }
});

// --- validateScoringInput ---

function scoringPayload(overrides: Partial<ScoringPayload> = {}): unknown {
  return {
    winner: "A",
    note: null,
    teamA: [{ playerId: "1", bonusBeer: 0, throws: 8, hits: 5 }],
    teamB: [{ playerId: "2", bonusBeer: 0, throws: 8, hits: 4 }],
    ...overrides,
  };
}

test("bewerten: vollstaendige Statistik zum Kader wird akzeptiert", () => {
  const result = validateScoringInput(scoringPayload(), [1], [2]);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.winner, "A");
    assert.equal(result.value.teamA[0].playerId, 1);
  }
});

test("bewerten: fehlender Kaderspieler wird abgelehnt", () => {
  // Kader hat Spieler 1 und 5, aber nur Statistik zu Spieler 1 wird geschickt
  const result = validateScoringInput(scoringPayload(), [1, 5], [2]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Kader/);
});

test("bewerten: zusaetzlicher, nicht im Kader stehender Spieler wird abgelehnt", () => {
  // Statistik enthaelt Spieler 1, aber der geplante Kader ist leer geblieben
  const result = validateScoringInput(scoringPayload(), [], [2]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Kader/);
});

test("bewerten: Bonusbier ueber 10 wird abgelehnt", () => {
  const result = validateScoringInput(
    scoringPayload({ teamA: [{ playerId: "1", bonusBeer: 11, throws: 1, hits: 1 }] }),
    [1],
    [2],
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Bonusbier/);
});

test("bewerten: negatives Bonusbier wird abgelehnt", () => {
  const result = validateScoringInput(
    scoringPayload({ teamA: [{ playerId: "1", bonusBeer: -1, throws: 1, hits: 1 }] }),
    [1],
    [2],
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Bonusbier/);
});

test("bewerten: nicht-ganzzahlige Wuerfe werden abgelehnt", () => {
  const result = validateScoringInput(
    scoringPayload({ teamA: [{ playerId: "1", bonusBeer: 0, throws: 1.5, hits: 1 }] }),
    [1],
    [2],
  );
  assert.equal(result.ok, false);
});

test("bewerten: Treffer ueber Wuerfe wird abgelehnt", () => {
  const result = validateScoringInput(
    scoringPayload({ teamA: [{ playerId: "1", bonusBeer: 0, throws: 3, hits: 5 }] }),
    [1],
    [2],
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Treffer/);
});

test("bewerten: Spiel ohne jeden Wurf wird abgelehnt", () => {
  const result = validateScoringInput(
    scoringPayload({
      teamA: [{ playerId: "1", bonusBeer: 0, throws: 0, hits: 0 }],
      teamB: [{ playerId: "2", bonusBeer: 0, throws: 0, hits: 0 }],
    }),
    [1],
    [2],
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Wurf/);
});

test("bewerten: ein Spieler ohne Wurf blockiert nicht, solange im Match geworfen wurde", () => {
  const result = validateScoringInput(
    scoringPayload({
      teamA: [{ playerId: "1", bonusBeer: 0, throws: 0, hits: 0 }],
      teamB: [{ playerId: "2", bonusBeer: 0, throws: 8, hits: 4 }],
    }),
    [1],
    [2],
  );
  assert.equal(result.ok, true);
});

test("bewerten: fehlender Sieger wird abgelehnt", () => {
  const result = validateScoringInput(scoringPayload({ winner: null }), [1], [2]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Sieger/);
});

test("bewerten: kaputte Nutzlast wirft nicht, sondern liefert ok:false", () => {
  for (const bad of [null, undefined, "text", 42, [], { teamA: "x", teamB: "y" }]) {
    assert.doesNotThrow(() => {
      const result = validateScoringInput(bad, [1], [2]);
      assert.equal(result.ok, false);
    });
  }
});

// --- deriveTeamScores ---

test("deriveTeamScores: A gewinnt -> 1/0", () => {
  assert.deepEqual(deriveTeamScores("A"), { scoreA: "1", scoreB: "0" });
});

test("deriveTeamScores: B gewinnt -> 0/1", () => {
  assert.deepEqual(deriveTeamScores("B"), { scoreA: "0", scoreB: "1" });
});

// --- deriveRatingUpdates ---

function fakeEloResult(teamAIds: number[], teamBIds: number[], deltas: Record<number, number>): EloMatchResult {
  const players = [...teamAIds, ...teamBIds].map((playerId) => ({
    playerId,
    ratingBefore: 200,
    delta: deltas[playerId] ?? 0,
    ratingAfter: 200 + (deltas[playerId] ?? 0),
    gamesPlayed: 0,
  }));
  return {
    players,
    info: { expectedA: 0.5, expectedB: 0.5, teamDeltaA: 0, teamDeltaB: 0, teamFactor: 1, sizeFactor: 1 },
  };
}

test("deriveRatingUpdates zaehlt Siege/Niederlagen seitenrichtig (A gewinnt)", () => {
  const eloResult = fakeEloResult([1, 2], [3, 4], { 1: 5, 2: 5, 3: -5, 4: -5 });
  const before = new Map([
    [1, { gamesPlayed: 10, wins: 5, losses: 5 }],
    [2, { gamesPlayed: 10, wins: 5, losses: 5 }],
    [3, { gamesPlayed: 10, wins: 5, losses: 5 }],
    [4, { gamesPlayed: 10, wins: 5, losses: 5 }],
  ]);
  const updates = deriveRatingUpdates(eloResult, before, "A", [1, 2]);
  const byId = new Map(updates.map((u) => [u.playerId, u]));
  assert.equal(byId.get(1)!.wins, 6);
  assert.equal(byId.get(1)!.losses, 5);
  assert.equal(byId.get(3)!.wins, 5);
  assert.equal(byId.get(3)!.losses, 6);
  for (const u of updates) assert.equal(u.gamesPlayed, 11);
});

test("deriveRatingUpdates: B gewinnt ist das Spiegelbild", () => {
  const eloResult = fakeEloResult([1, 2], [3, 4], { 1: -5, 2: -5, 3: 5, 4: 5 });
  const before = new Map([
    [1, { gamesPlayed: 0, wins: 0, losses: 0 }],
    [2, { gamesPlayed: 0, wins: 0, losses: 0 }],
    [3, { gamesPlayed: 0, wins: 0, losses: 0 }],
    [4, { gamesPlayed: 0, wins: 0, losses: 0 }],
  ]);
  const updates = deriveRatingUpdates(eloResult, before, "B", [1, 2]);
  const byId = new Map(updates.map((u) => [u.playerId, u]));
  assert.equal(byId.get(3)!.wins, 1);
  assert.equal(byId.get(1)!.losses, 1);
});

test("rating wird auf 4 Nachkommastellen formatiert", () => {
  const eloResult = fakeEloResult([1], [2], { 1: 7.333333, 2: -7.333333 });
  const before = new Map([
    [1, { gamesPlayed: 0, wins: 0, losses: 0 }],
    [2, { gamesPlayed: 0, wins: 0, losses: 0 }],
  ]);
  const updates = deriveRatingUpdates(eloResult, before, "A", [1]);
  const byId = new Map(updates.map((u) => [u.playerId, u]));
  assert.equal(byId.get(1)!.rating, "207.3333");
});

test("Delta 0 zaehlt trotzdem als Sieg", () => {
  const eloResult = fakeEloResult([1], [2], { 1: 0, 2: -5 });
  const before = new Map([
    [1, { gamesPlayed: 0, wins: 0, losses: 0 }],
    [2, { gamesPlayed: 0, wins: 0, losses: 0 }],
  ]);
  const updates = deriveRatingUpdates(eloResult, before, "A", [1]);
  const byId = new Map(updates.map((u) => [u.playerId, u]));
  assert.equal(byId.get(1)!.wins, 1);
  assert.equal(byId.get(1)!.rating, "200.0000");
});

test("Zuordnung erfolgt ueber playerId, nicht ueber den Index (elo.ts liefert eine flache Liste)", () => {
  // eloResult.players in einer anderen Reihenfolge als teamAIds
  const eloResult: EloMatchResult = {
    players: [
      { playerId: 4, ratingBefore: 200, delta: -5, ratingAfter: 195, gamesPlayed: 0 },
      { playerId: 3, ratingBefore: 200, delta: -5, ratingAfter: 195, gamesPlayed: 0 },
      { playerId: 1, ratingBefore: 200, delta: 5, ratingAfter: 205, gamesPlayed: 0 },
      { playerId: 2, ratingBefore: 200, delta: 5, ratingAfter: 205, gamesPlayed: 0 },
    ],
    info: { expectedA: 0.5, expectedB: 0.5, teamDeltaA: 0, teamDeltaB: 0, teamFactor: 1, sizeFactor: 1 },
  };
  const before = new Map([
    [1, { gamesPlayed: 0, wins: 0, losses: 0 }],
    [2, { gamesPlayed: 0, wins: 0, losses: 0 }],
    [3, { gamesPlayed: 0, wins: 0, losses: 0 }],
    [4, { gamesPlayed: 0, wins: 0, losses: 0 }],
  ]);
  const updates = deriveRatingUpdates(eloResult, before, "A", [1, 2]);
  const byId = new Map(updates.map((u) => [u.playerId, u]));
  assert.equal(byId.get(1)!.wins, 1, "Spieler 1 ist in teamAIds und A gewinnt -> Sieg");
  assert.equal(byId.get(3)!.losses, 1, "Spieler 3 ist nicht in teamAIds -> Niederlage");
});
