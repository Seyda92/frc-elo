import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveRatingUpdates, validateMatchInput, type MatchFormPayload } from "./match-input.ts";
import type { EloMatchResult } from "./elo.ts";

const NOW = new Date("2026-07-31T20:00:00.000Z");

const KNOWN = new Map<number, string>([
  [1, "Torben Reifen"],
  [2, "Mila Flunky"],
  [3, "Jonas Asphalt"],
  [4, "Saskia Dose"],
]);

function basePayload(overrides: Partial<MatchFormPayload> = {}): unknown {
  return {
    playedAt: NOW.toISOString(),
    eventId: null,
    kFactor: "40",
    canDiff: "0",
    note: null,
    refereePlayerId: null,
    winner: "A",
    teamA: [{ playerId: "1", bonusBeer: 0, throws: 8, hits: 5 }],
    teamB: [{ playerId: "2", bonusBeer: 0, throws: 8, hits: 4 }],
    ...overrides,
  };
}

test("gueltige minimale Nutzlast wird akzeptiert, IDs werden zu number", () => {
  const result = validateMatchInput(basePayload(), KNOWN, NOW);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.teamA[0].playerId, 1);
    assert.equal(typeof result.value.teamA[0].playerId, "number");
    assert.equal(result.value.kFactor, 40);
  }
});

test("leeres Team A wird abgelehnt", () => {
  const result = validateMatchInput(basePayload({ teamA: [] }), KNOWN, NOW);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Team A/);
});

test("leeres Team B wird abgelehnt", () => {
  const result = validateMatchInput(basePayload({ teamB: [] }), KNOWN, NOW);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Team B/);
});

test("Spieler in beiden Teams wird mit Namen abgelehnt", () => {
  const result = validateMatchInput(
    basePayload({
      teamA: [{ playerId: "1", bonusBeer: 0, throws: 1, hits: 1 }],
      teamB: [{ playerId: "1", bonusBeer: 0, throws: 1, hits: 1 }],
    }),
    KNOWN,
    NOW,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Torben Reifen/);
});

test("Spieler doppelt innerhalb eines Teams wird abgelehnt", () => {
  const result = validateMatchInput(
    basePayload({
      teamA: [
        { playerId: "1", bonusBeer: 0, throws: 1, hits: 1 },
        { playerId: "1", bonusBeer: 0, throws: 1, hits: 1 },
      ],
    }),
    KNOWN,
    NOW,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /mehrfach/);
});

test("Schiedsrichter im eigenen Team wird abgelehnt", () => {
  const result = validateMatchInput(basePayload({ refereePlayerId: "1" }), KNOWN, NOW);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Schiedsrichter/);
});

test("gueltiger Schiedsrichter wird akzeptiert", () => {
  const result = validateMatchInput(basePayload({ refereePlayerId: "3" }), KNOWN, NOW);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.refereePlayerId, 3);
});

test("Bonusbier ueber 10 wird abgelehnt", () => {
  const result = validateMatchInput(
    basePayload({ teamA: [{ playerId: "1", bonusBeer: 11, throws: 1, hits: 1 }] }),
    KNOWN,
    NOW,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Bonusbier/);
});

test("Bonusbier negativ wird abgelehnt", () => {
  const result = validateMatchInput(
    basePayload({ teamA: [{ playerId: "1", bonusBeer: -1, throws: 1, hits: 1 }] }),
    KNOWN,
    NOW,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Bonusbier/);
});

test("Treffer ueber Wuerfe wird abgelehnt", () => {
  const result = validateMatchInput(
    basePayload({ teamA: [{ playerId: "1", bonusBeer: 0, throws: 3, hits: 5 }] }),
    KNOWN,
    NOW,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Treffer/);
});

test("nicht erlaubter K-Faktor wird abgelehnt", () => {
  const result = validateMatchInput(basePayload({ kFactor: "35" }), KNOWN, NOW);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /K-Faktor/);
});

test("negativer Dosenunterschied wird abgelehnt", () => {
  const result = validateMatchInput(basePayload({ canDiff: "-1" }), KNOWN, NOW);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Dosenunterschied/);
});

test("fehlender Sieger wird abgelehnt", () => {
  const result = validateMatchInput(basePayload({ winner: null }), KNOWN, NOW);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Sieger/);
});

test("ungueltiges Datum wird abgelehnt", () => {
  const result = validateMatchInput(basePayload({ playedAt: "kein-datum" }), KNOWN, NOW);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Zeitpunkt/);
});

test("Zeitpunkt eine Stunde in der Zukunft wird abgelehnt", () => {
  const future = new Date(NOW.getTime() + 60 * 60 * 1000).toISOString();
  const result = validateMatchInput(basePayload({ playedAt: future }), KNOWN, NOW);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Zukunft/);
});

test("Zeitpunkt 30 Sekunden in der Zukunft wird toleriert (Uhrenversatz)", () => {
  const nearFuture = new Date(NOW.getTime() + 30 * 1000).toISOString();
  const result = validateMatchInput(basePayload({ playedAt: nearFuture }), KNOWN, NOW);
  assert.equal(result.ok, true);
});

test("unbekannte Spieler-ID wird abgelehnt", () => {
  const result = validateMatchInput(
    basePayload({ teamA: [{ playerId: "999", bonusBeer: 0, throws: 1, hits: 1 }] }),
    KNOWN,
    NOW,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Unbekannter Spieler/);
});

test("21 Spieler in einem Team werden abgelehnt", () => {
  const teamA = Array.from({ length: 21 }, (_, i) => ({
    playerId: String(i + 100),
    bonusBeer: 0,
    throws: 1,
    hits: 1,
  }));
  const result = validateMatchInput(basePayload({ teamA }), KNOWN, NOW);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /höchstens 20/);
});

test("nicht-ganzzahlige Wuerfe werden abgelehnt", () => {
  const result = validateMatchInput(
    basePayload({ teamA: [{ playerId: "1", bonusBeer: 0, throws: 1.5, hits: 1 }] }),
    KNOWN,
    NOW,
  );
  assert.equal(result.ok, false);
});

test("kaputte Nutzlast wirft nicht, sondern liefert ok:false", () => {
  for (const bad of [null, undefined, "text", 42, [], { teamA: "x", teamB: "y" }]) {
    assert.doesNotThrow(() => {
      const result = validateMatchInput(bad, KNOWN, NOW);
      assert.equal(result.ok, false);
    });
  }
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

test("Delta 0 (z.B. 10 Bonusbiere) zaehlt trotzdem als Sieg", () => {
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
