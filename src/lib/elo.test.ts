import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeMatchDeltas,
  expectedScore,
  provisionalMultiplier,
  sizeFactor,
  teamFactor,
  type EloParams,
  type EloPlayerInput,
} from "./elo.ts";

/** Entspricht dem geseedeten Stand: 1..5 steigend, 6..19 gedeckelt auf 1.15. */
const teamFactors = new Map<number, number>(
  Array.from({ length: 19 }, (_, i) => {
    const diff = i + 1;
    return [diff, 1 + 0.03 * Math.min(diff, 5)] as const;
  }),
);

const params: EloParams = {
  sizeFactorOffset: 7,
  provisionalGames: 15,
  provisionalKBoost: 3,
  teamFactors,
};

/** Spieler bereits aus der Provisional-Phase heraus. */
function player(playerId: number, rating: number, overrides: Partial<EloPlayerInput> = {}) {
  return { playerId, rating, gamesPlayed: 20, ...overrides };
}

const CLOSE = 1e-9;

test("expectedScore: gleiche Ratings ergeben 0,5", () => {
  assert.equal(expectedScore(600, 600), 0.5);
});

test("expectedScore: 400 Punkte Vorsprung ergeben 10/11", () => {
  assert.ok(Math.abs(expectedScore(600, 200) - 10 / 11) < CLOSE);
});

test("expectedScore: extreme Differenz bleibt endlich (Clamp greift)", () => {
  const low = expectedScore(0, 100_000);
  const high = expectedScore(100_000, 0);
  assert.ok(Number.isFinite(low) && Number.isFinite(high));
  assert.ok(low >= 0 && low < CLOSE);
  assert.ok(high > 1 - CLOSE && high <= 1);
});

test("teamFactor: gleich große Teams ergeben 1,0", () => {
  assert.equal(teamFactor(4, 4, teamFactors), 1);
});

test("teamFactor: Differenz 3 ergeben 1,09", () => {
  assert.ok(Math.abs(teamFactor(7, 4, teamFactors) - 1.09) < CLOSE);
});

test("teamFactor: Differenz 12 wird auf 1,15 gedeckelt (Referenz deckelt ab 5)", () => {
  assert.ok(Math.abs(teamFactor(14, 2, teamFactors) - 1.15) < CLOSE);
});

test("teamFactor: leere Tabelle wirft statt still falsch zu rechnen", () => {
  assert.throws(() => teamFactor(3, 5, new Map()), /team_factor/);
});

test("sizeFactor: (n+D)/(n+7), kein Pol bei kleinen Teams", () => {
  assert.ok(Math.abs(sizeFactor(1, 0, 7) - 1 / 8) < CLOSE);
  assert.ok(Math.abs(sizeFactor(4, 2, 7) - 6 / 11) < CLOSE);
});

test("provisionalMultiplier: 3,0 bei 0 Spielen, 2,0 bei der Hälfte, 1,0 ab 15", () => {
  assert.equal(provisionalMultiplier(0, 15, 3), 3);
  assert.equal(provisionalMultiplier(7.5, 15, 3), 2);
  assert.equal(provisionalMultiplier(15, 15, 3), 1);
  assert.equal(provisionalMultiplier(40, 15, 3), 1);
});

test("gleich starke, gleich große Teams: symmetrische Deltas, Sieger gewinnt", () => {
  const a = [player(1, 200), player(2, 200), player(3, 200)];
  const b = [player(4, 200), player(5, 200), player(6, 200)];
  const { players, info } = computeMatchDeltas(a, b, 30, 0, 1, params);

  assert.equal(info.expectedA, 0.5);
  assert.equal(info.expectedB, 0.5);
  assert.equal(info.teamFactor, 1);

  const winners = players.slice(0, 3);
  const losers = players.slice(3);
  for (const w of winners) assert.ok(w.delta > 0, "Sieger muss gewinnen");
  for (const l of losers) assert.ok(l.delta < 0, "Verlierer muss verlieren");
  // Alle Sieger identisch (Gleichverteilung P/n), Verlierer spiegelbildlich.
  assert.ok(Math.abs(winners[0].delta - winners[2].delta) < CLOSE);
  assert.ok(Math.abs(winners[0].delta + losers[0].delta) < CLOSE);
});

test("Nullsumme: teamDeltaA + teamDeltaB === 0, auch bei ungleichen Teams", () => {
  const a = [player(1, 350), player(2, 120)];
  const b = [player(3, 200), player(4, 190), player(5, 240), player(6, 205)];
  const { info } = computeMatchDeltas(a, b, 40, 3, 1, params);
  assert.ok(Math.abs(info.teamDeltaA + info.teamDeltaB) < 1e-12);
});

test("ohne Provisional-Effekt ist auch die Summe der Spieler-Deltas 0", () => {
  const a = [player(1, 260), player(2, 180), player(3, 210)];
  const b = [player(4, 190), player(5, 240), player(6, 205)];
  const { players } = computeMatchDeltas(a, b, 50, 1, 0, params);
  const sum = players.reduce((acc, p) => acc + p.delta, 0);
  assert.ok(Math.abs(sum) < 1e-12);
});

// Bonusbiere werden weiterhin erfasst und angezeigt, wirken seit 09/2026 aber
// nicht mehr auf die Wertung. Der Test haelt die Entscheidung fest: Fiele der
// Daempfungsfaktor versehentlich zurueck in distribute(), schlaegt er an.
test("Bonusbier beeinflusst das Delta nicht mehr", () => {
  const a = [player(1, 1000), player(2, 1000)];
  const b = [player(3, 1000), player(4, 1000)];
  const { players } = computeMatchDeltas(a, b, 40, 0, 1, params);
  assert.ok(Math.abs(players[0].delta - players[1].delta) < CLOSE);
  assert.ok(players[0].delta > 0, "Sieger bekommt ein positives Delta");
});

test("Provisional-Faktor verstärkt das Delta neuer Spieler dreifach", () => {
  const a = [player(1, 200, { gamesPlayed: 0 }), player(2, 200)];
  const b = [player(3, 200), player(4, 200)];
  const { players } = computeMatchDeltas(a, b, 30, 0, 1, params);
  assert.ok(Math.abs(players[0].delta - players[1].delta * 3) < CLOSE);
});

test("ratingBefore + delta === ratingAfter für jede Zeile", () => {
  const a = [player(1, 233.5, { gamesPlayed: 3 }), player(2, 198)];
  const b = [player(3, 205), player(4, 187.25)];
  const { players } = computeMatchDeltas(a, b, 20, 2, 0, params);
  for (const p of players) {
    assert.ok(Math.abs(p.ratingBefore + p.delta - p.ratingAfter) < CLOSE);
    assert.ok(Number.isFinite(p.delta), "kein NaN/Infinity");
  }
});

test("handgerechneter Fall: 2 gegen 2, gleiche Ratings, K=30, D=0, Sieg A", () => {
  // E = 0,5; T = 1; sf = (2+0)/(2+7) = 2/9
  // P_A = 30 · 2/9 · 1 · (1 − 0,5) = 10/3
  // dR_i = (10/3)/2 = 5/3
  const a = [player(1, 200), player(2, 200)];
  const b = [player(3, 200), player(4, 200)];
  const { players, info } = computeMatchDeltas(a, b, 30, 0, 1, params);
  assert.ok(Math.abs(info.sizeFactor - 2 / 9) < CLOSE);
  assert.ok(Math.abs(info.teamDeltaA - 10 / 3) < CLOSE);
  assert.ok(Math.abs(players[0].delta - 5 / 3) < CLOSE);
  assert.ok(Math.abs(players[2].delta + 5 / 3) < CLOSE);
});

test("handgerechneter Fall: Dosenunterschied und Teamfaktor wirken multiplikativ", () => {
  // n_a = 1, n_b = 3 -> avg = 2, diff = 2 -> T = 1,06
  // sf = (2 + 4)/(2 + 7) = 6/9 = 2/3
  // E_A: R_A = 200, R_B = 600 -> Exponent (600−200)/400 = 1 -> E_A = 1/11
  // P_A = 20 · (2/3) · 1,06 · (1 − 1/11)
  const a = [player(1, 200)];
  const b = [player(2, 200), player(3, 200), player(4, 200)];
  const { info } = computeMatchDeltas(a, b, 20, 4, 1, params);
  assert.ok(Math.abs(info.teamFactor - 1.06) < CLOSE);
  assert.ok(Math.abs(info.sizeFactor - 2 / 3) < CLOSE);
  assert.ok(Math.abs(info.expectedA - 1 / 11) < CLOSE);
  const expectedP = 20 * (2 / 3) * 1.06 * (1 - 1 / 11);
  assert.ok(Math.abs(info.teamDeltaA - expectedP) < CLOSE);
});

test("leeres Team wird abgefangen statt durch 0 zu teilen", () => {
  assert.throws(
    () => computeMatchDeltas([], [player(1, 200)], 30, 0, 1, params),
    /mindestens einen Spieler/,
  );
});
