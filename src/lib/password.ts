import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

/**
 * Passwort-Hashing mit `crypto.scrypt` (Node-Bordmittel, keine neue
 * Abhängigkeit). Gespeichertes Format ist selbstbeschreibend:
 *
 *   scrypt$<N>$<r>$<p>$<saltBase64url>$<hashBase64url>
 *
 * Dadurch verifizieren alte Hashes weiter, auch wenn die Kostenparameter
 * später erhöht werden — es muss nichts migriert werden.
 */

const ALGORITHM = "scrypt";

/** Gemeinsame Mindestlänge für alle Passwort-Eingabewege (Login-Anlage, Schiri-Verwaltung). */
export const MIN_PASSWORD_LENGTH = 6;

/**
 * N=2^15 statt der OWASP-Empfehlung 2^17: bei N=2^17 wären das 128 MiB
 * Speicher pro Login-Versuch. Ohne Rate-Limiting (siehe Plan: das gehört in
 * nginx beim Deployment, nicht in die App) wäre das ein Überlastungshebel
 * gegen /login. 2^15 (~32 MiB, ~60-120ms) ist eine bewusste Stufe darunter.
 */
const DEFAULT_N = 32768;
const DEFAULT_R = 8;
const DEFAULT_P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
/** Node scryptet' Default-maxmem (32 MiB) liegt genau auf 128*N*r — explizit erhöhen. */
const MAX_MEM = 64 * 1024 * 1024;

/** Schutz gegen absurde/kaputte Kostenparameter aus einer manipulierten Spalte. */
const MAX_N = 2 ** 20;
const MAX_R = 32;
const MAX_P = 16;

export type ScryptParams = { N: number; r: number; p: number };

function scryptAsync(password: string, salt: Buffer, keylen: number, params: ScryptParams) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      keylen,
      { N: params.N, r: params.r, p: params.p, maxmem: MAX_MEM },
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      },
    );
  });
}

function toBase64Url(buf: Buffer): string {
  return buf.toString("base64url");
}

export async function hashPassword(
  plain: string,
  params: ScryptParams = { N: DEFAULT_N, r: DEFAULT_R, p: DEFAULT_P },
): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptAsync(plain, salt, KEY_LENGTH, params);
  return [
    ALGORITHM,
    params.N,
    params.r,
    params.p,
    toBase64Url(salt),
    toBase64Url(derived),
  ].join("$");
}

/**
 * Verifiziert nie werfend — jeder Formatfehler in `stored` liefert `false`,
 * niemals eine Exception. `stored` kann aus einer kompromittierten oder
 * fehlerhaft importierten Spalte kommen.
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 6) return false;
    const [algorithm, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
    if (algorithm !== ALGORITHM) return false;

    const N = Number(nRaw);
    const r = Number(rRaw);
    const p = Number(pRaw);
    if (
      !Number.isInteger(N) ||
      !Number.isInteger(r) ||
      !Number.isInteger(p) ||
      N < 2 ||
      N > MAX_N ||
      r < 1 ||
      r > MAX_R ||
      p < 1 ||
      p > MAX_P
    ) {
      return false;
    }
    // N muss eine Zweierpotenz sein (scrypt-Anforderung).
    if ((N & (N - 1)) !== 0) return false;

    const salt = Buffer.from(saltB64, "base64url");
    const storedHash = Buffer.from(hashB64, "base64url");
    if (salt.length === 0 || storedHash.length === 0) return false;

    // keylen = storedHash.length garantiert gleich lange Puffer für
    // timingSafeEqual, ohne vorher die Länge separat prüfen zu müssen.
    const derived = await scryptAsync(plain, salt, storedHash.length, { N, r, p });
    return timingSafeEqual(derived, storedHash);
  } catch {
    return false;
  }
}

/**
 * Fester Hash eines beliebigen, nie echten Passworts. Wird beim Login für
 * unbekannte Benutzernamen verifiziert, damit die Antwortzeit nicht verrät,
 * ob der Benutzername existiert (siehe src/app/login/actions.ts).
 */
let dummyHashPromise: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(randomBytes(24).toString("base64url"));
  }
  return dummyHashPromise;
}

/**
 * Erzeugt ein zufälliges Klartext-Passwort für den Owner-Reset (siehe
 * resetRefereePassword in actions.ts) — exakt MIN_PASSWORD_LENGTH Zeichen,
 * kurz genug zum mündlichen Weitergeben/Abtippen am Turniertag. base64url
 * enthält keine Zeichen, die dabei verwechselt werden (kein +/=, kein
 * Leerzeichen). randomBytes(5) liefert 7 base64url-Zeichen, auf 6 gekürzt.
 */
export function generateRandomPassword(): string {
  return randomBytes(5).toString("base64url").slice(0, MIN_PASSWORD_LENGTH);
}
