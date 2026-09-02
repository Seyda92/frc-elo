import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { signSession, verifySession } from "./session.ts";

const SECRET_A = "test-secret-a-mindestens-16-zeichen";
const SECRET_B = "test-secret-b-mindestens-16-zeichen";

function withSecret<T>(secret: string, fn: () => T): T {
  const prev = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = secret;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = prev;
  }
}

test("sign -> verify Rundreise erhält userId/username/role", () => {
  withSecret(SECRET_A, () => {
    const token = signSession({ userId: 42, username: "torben", role: "admin" });
    const session = verifySession(token);
    assert.ok(session);
    assert.equal(session.userId, 42);
    assert.equal(session.username, "torben");
    assert.equal(session.role, "admin");
  });
});

test("manipulierte Nutzlast wird abgelehnt", () => {
  withSecret(SECRET_A, () => {
    const token = signSession({ userId: 1, username: "a", role: "user" });
    const [payloadB64, signature] = token.split(".");
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    payload.role = "admin"; // Rolle heraufstufen versuchen
    const tampered =
      Buffer.from(JSON.stringify(payload), "utf8").toString("base64url") + "." + signature;
    assert.equal(verifySession(tampered), null);
  });
});

test("manipulierte Signatur wird abgelehnt", () => {
  withSecret(SECRET_A, () => {
    const token = signSession({ userId: 1, username: "a", role: "user" });
    const [payloadB64] = token.split(".");
    const tampered = `${payloadB64}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    assert.equal(verifySession(tampered), null);
  });
});

test("abgelaufenes Token wird abgelehnt", () => {
  withSecret(SECRET_A, () => {
    const token = signSession({ userId: 1, username: "a", role: "user" }, -1);
    assert.equal(verifySession(token), null);
  });
});

test("mit anderem Secret signiert wird abgelehnt", () => {
  const token = withSecret(SECRET_A, () =>
    signSession({ userId: 1, username: "a", role: "user" }),
  );
  withSecret(SECRET_B, () => {
    assert.equal(verifySession(token), null);
  });
});

test("fehlerhafte Tokenformen werden abgelehnt", () => {
  withSecret(SECRET_A, () => {
    for (const bad of [undefined, null, "", "abc", "a.b.c", "a.", ".b"]) {
      assert.equal(verifySession(bad), null, `sollte null sein für: ${JSON.stringify(bad)}`);
    }
  });
});

test("sign -> verify Rundreise erhält die Rolle owner", () => {
  withSecret(SECRET_A, () => {
    const token = signSession({ userId: 1, username: "chef", role: "owner" });
    const session = verifySession(token);
    assert.ok(session);
    assert.equal(session.role, "owner");
  });
});

test("korrekt signiertes Token mit Rolle superadmin wird abgelehnt", () => {
  withSecret(SECRET_A, () => {
    const payload = { v: 1, uid: 1, usr: "a", role: "superadmin", exp: Math.floor(Date.now() / 1000) + 60 };
    const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const signature = createHmac("sha256", SECRET_A).update(payloadB64).digest("base64url");
    assert.equal(verifySession(`${payloadB64}.${signature}`), null);
  });
});

test("korrekt signiertes Token mit ungültiger Rolle wird trotzdem abgelehnt", () => {
  withSecret(SECRET_A, () => {
    // Direkt eine Payload mit unzulässiger Rolle bauen und selbst signieren,
    // um die Form-Validierung zu testen statt nur die HMAC-Prüfung.
    const payload = { v: 1, uid: 1, usr: "a", role: "superadmin", exp: Math.floor(Date.now() / 1000) + 60 };
    const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const signature = createHmac("sha256", SECRET_A).update(payloadB64).digest("base64url");
    assert.equal(verifySession(`${payloadB64}.${signature}`), null);
  });
});

test("signSession wirft ohne AUTH_SECRET", () => {
  withSecret("", () => {
    delete process.env.AUTH_SECRET;
    assert.throws(() => signSession({ userId: 1, username: "a", role: "user" }));
  });
});
