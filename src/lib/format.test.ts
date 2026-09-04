import { test } from "node:test";
import assert from "node:assert/strict";
import { localDateTimeValue, sortLeaderboard } from "./format.ts";

const PLAYERS = [
  { id: "a", elo: 1010, throws: 10, hits: 5, games: 3, bonusBeers: 2, wins: 2 },
  { id: "b", elo: 990, throws: 10, hits: 8, games: 5, bonusBeers: 0, wins: 1 },
  { id: "c", elo: 1000, throws: 4, hits: 4, games: 1, bonusBeers: 5, wins: 0 },
];

test("localDateTimeValue formatiert mit lokalen Komponenten und Nullen aufgefuellt", () => {
  const d = new Date(2026, 0, 5, 9, 3); // 5. Januar 2026, 09:03 lokal
  assert.equal(localDateTimeValue(d), "2026-01-05T09:03");
});

test("localDateTimeValue: zweistellige Werte bleiben unveraendert", () => {
  const d = new Date(2026, 11, 31, 23, 59);
  assert.equal(localDateTimeValue(d), "2026-12-31T23:59");
});

test("sortLeaderboard: elo absteigend ist der Default-Fall", () => {
  const sorted = sortLeaderboard(PLAYERS, "elo", "desc");
  assert.deepEqual(sorted.map((p) => p.id), ["a", "c", "b"]);
});

test("sortLeaderboard: elo aufsteigend kehrt die Reihenfolge um", () => {
  const sorted = sortLeaderboard(PLAYERS, "elo", "asc");
  assert.deepEqual(sorted.map((p) => p.id), ["b", "c", "a"]);
});

test("sortLeaderboard: quote wird aus throws/hits berechnet, nicht gespeichert", () => {
  // a: 50%, b: 80%, c: 100%
  const sorted = sortLeaderboard(PLAYERS, "quote", "desc");
  assert.deepEqual(sorted.map((p) => p.id), ["c", "b", "a"]);
});

test("sortLeaderboard: bonusBeers absteigend", () => {
  const sorted = sortLeaderboard(PLAYERS, "bonusBeers", "desc");
  assert.deepEqual(sorted.map((p) => p.id), ["c", "a", "b"]);
});

test("sortLeaderboard: gibt eine neue Liste zurueck, mutiert das Original nicht", () => {
  const original = [...PLAYERS];
  sortLeaderboard(PLAYERS, "wins", "asc");
  assert.deepEqual(PLAYERS, original);
});
