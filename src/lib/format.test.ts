import { test } from "node:test";
import assert from "node:assert/strict";
import { localDateTimeValue } from "./format.ts";

test("localDateTimeValue formatiert mit lokalen Komponenten und Nullen aufgefuellt", () => {
  const d = new Date(2026, 0, 5, 9, 3); // 5. Januar 2026, 09:03 lokal
  assert.equal(localDateTimeValue(d), "2026-01-05T09:03");
});

test("localDateTimeValue: zweistellige Werte bleiben unveraendert", () => {
  const d = new Date(2026, 11, 31, 23, 59);
  assert.equal(localDateTimeValue(d), "2026-12-31T23:59");
});
