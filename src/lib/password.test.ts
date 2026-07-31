import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./password.ts";

// Billige Parameter, damit die Suite schnell bleibt.
const CHEAP = { N: 1024, r: 1, p: 1 };

test("hash -> verify Rundreise liefert true", async () => {
  const hash = await hashPassword("korrektes-passwort", CHEAP);
  assert.equal(await verifyPassword("korrektes-passwort", hash), true);
});

test("falsches Passwort liefert false", async () => {
  const hash = await hashPassword("korrektes-passwort", CHEAP);
  assert.equal(await verifyPassword("falsches-passwort", hash), false);
});

test("zwei Hashes desselben Passworts unterscheiden sich (Zufalls-Salt), beide verifizieren", async () => {
  const hashA = await hashPassword("dasselbe-passwort", CHEAP);
  const hashB = await hashPassword("dasselbe-passwort", CHEAP);
  assert.notEqual(hashA, hashB);
  assert.equal(await verifyPassword("dasselbe-passwort", hashA), true);
  assert.equal(await verifyPassword("dasselbe-passwort", hashB), true);
});

test("gespeichertes Format entspricht scrypt$N$r$p$salt$hash", async () => {
  const hash = await hashPassword("x", CHEAP);
  assert.match(hash, /^scrypt\$\d+\$\d+\$\d+\$[\w-]+\$[\w-]+$/);
});

test("kaputte gespeicherte Werte liefern false, ohne zu werfen", async () => {
  const malformed = [
    "",
    "x",
    "scrypt$$$$",
    "bcrypt$1024$1$1$abc$def",
    "scrypt$1024$1$1$nicht_base64!!$zzz",
    "scrypt$1024$1$1$abc$def$extra",
    "scrypt$1024$1$1$" + Buffer.from("").toString("base64url") + "$" + Buffer.from("x").toString("base64url"),
  ];
  for (const value of malformed) {
    await assert.doesNotReject(async () => {
      const result = await verifyPassword("irgendein-passwort", value);
      assert.equal(result, false);
    });
  }
});

test("absurd hohe Kostenparameter liefern schnell false statt zu allokieren", async () => {
  const start = Date.now();
  const result = await verifyPassword("x", "scrypt$99999999$8$1$AAAA$AAAA");
  assert.equal(result, false);
  assert.ok(Date.now() - start < 1000, "sollte sofort ablehnen, nicht versuchen zu allokieren");
});

test("ein mit expliziten Nicht-Standard-Parametern gehashtes Passwort verifiziert weiterhin", async () => {
  const hash = await hashPassword("altes-passwort", { N: 1024, r: 4, p: 2 });
  assert.equal(await verifyPassword("altes-passwort", hash), true);
});

test("N muss eine Zweierpotenz sein, sonst false", async () => {
  const result = await verifyPassword("x", "scrypt$1000$1$1$AAAA$AAAA");
  assert.equal(result, false);
});
