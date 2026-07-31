import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Zustandslose, signierte Session — keine Session-Tabelle, keine
 * Schema-Migration. Token-Format:
 *
 *   base64url(JSON) + "." + base64url(HMAC_SHA256(secret, JSON))
 *
 * Die Signatur deckt `exp` mit ab, die Gültigkeit ist also nicht
 * clientseitig verlängerbar. Kennt keine Cookies — nur src/lib/auth.ts
 * (Server-only) verbindet dies mit `next/headers`.
 */

export type Role = "admin" | "user";

export type Session = {
  userId: number;
  username: string;
  role: Role;
  /** Ablaufzeitpunkt, Unix-Sekunden. */
  exp: number;
};

type Payload = {
  v: 1;
  uid: number;
  usr: string;
  role: Role;
  exp: number;
};

export const SESSION_COOKIE = "frc_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 Tage

/**
 * Absichtlich lazy statt auf Modulebene gelesen: ein Modul-Level-`throw`
 * würde jeden Import dieser Datei (auch transitiv über die Root-Layout-Kette)
 * beim Fehlen der Variable zum Absturz bringen — u.a. `next build` ohne
 * gesetzte Env-Var. Die Tests müssen das Secret außerdem zwischen Aufrufen
 * umschalten können.
 */
function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET fehlt oder ist zu kurz (min. 16 Zeichen). Siehe .env.example.",
    );
  }
  return secret;
}

function sign(payloadB64: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payloadB64).digest();
}

export function signSession(
  session: Omit<Session, "exp">,
  ttlSeconds: number = SESSION_TTL_SECONDS,
): string {
  const secret = getSecret();
  const payload: Payload = {
    v: 1,
    uid: session.userId,
    usr: session.username,
    role: session.role,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(payloadB64, secret).toString("base64url");
  return `${payloadB64}.${signature}`;
}

/** Gibt bei jedem Fehler `null` zurück, wirft nie. */
export function verifySession(token: string | undefined | null): Session | null {
  if (!token) return null;

  const dotIndex = token.indexOf(".");
  if (dotIndex < 0 || token.indexOf(".", dotIndex + 1) !== -1) return null; // genau ein Punkt
  const payloadB64 = token.slice(0, dotIndex);
  const signatureB64 = token.slice(dotIndex + 1);
  if (!payloadB64 || !signatureB64) return null;

  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return null;
  }

  let receivedSignature: Buffer;
  try {
    receivedSignature = Buffer.from(signatureB64, "base64url");
  } catch {
    return null;
  }
  const expectedSignature = sign(payloadB64, secret);
  if (receivedSignature.length !== expectedSignature.length) return null;
  if (!timingSafeEqual(receivedSignature, expectedSignature)) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload !== "object" || payload === null) return null;

  const p = payload as Record<string, unknown>;
  if (p.v !== 1) return null;
  if (typeof p.uid !== "number" || !Number.isInteger(p.uid) || p.uid <= 0) return null;
  if (typeof p.usr !== "string" || p.usr.length === 0) return null;
  // Rolle wird unabhängig von der DB-CHECK-Constraint noch einmal geprüft —
  // ein Rollen-String darf nie ungeprüft in eine Berechtigungsentscheidung
  // fließen.
  if (p.role !== "admin" && p.role !== "user") return null;
  if (typeof p.exp !== "number" || !Number.isFinite(p.exp)) return null;

  if (p.exp <= Math.floor(Date.now() / 1000)) return null;

  return { userId: p.uid, username: p.usr, role: p.role, exp: p.exp };
}

export function sessionCookieOptions(ttlSeconds: number = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    // Unbedingt bedingt: die App läuft lokal auf http://localhost, ein
    // unconditional `secure: true` würde das Cookie dort still verwerfen.
    secure: process.env.NODE_ENV === "production",
    path: "/" as const,
    maxAge: ttlSeconds,
  };
}
