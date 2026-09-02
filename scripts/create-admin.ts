/**
 * Legt einen Benutzer in app_user an (idR. den ersten Admin — die Tabelle
 * ist sonst leer). Läuft als eigenständiges Node-Skript, NICHT über Next —
 * deshalb relative Importe mit Endung statt des @/-Alias, und nichts aus
 * src/app/ oder src/db/queries.ts (die nutzen @/ bzw. next/cache).
 *
 * Aufruf: npm run create-admin (SSH-Tunnel zur DB muss laufen)
 */
import * as readline from "node:readline/promises";
import { db, pool } from "../src/db/client.ts";
import { appUser } from "../src/db/generated/schema.ts";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../src/lib/password.ts";
import { isUniqueViolation } from "../src/lib/pg-errors.ts";

// Als Zeichencodes statt Literalen, damit Steuerzeichen im Quelltext nicht
// von Editor/Tooling verschluckt oder verstümmelt werden.
const ENTER_CR = String.fromCharCode(13);
const ENTER_LF = String.fromCharCode(10);
const CTRL_C = String.fromCharCode(3);
const BACKSPACE_DEL = String.fromCharCode(127);
const BACKSPACE_BS = String.fromCharCode(8);

/**
 * Eine einzige readline-Instanz für alle Text-Fragen. Bei gepipetem stdin
 * (kein TTY) liest eine neue Instanz pro Frage die restlichen, bereits
 * gepufferten Zeilen nicht mehr zuverlässig — deshalb wird die Instanz vom
 * Aufrufer übergeben und erst nach der letzten Textfrage geschlossen.
 */
async function ask(rl: readline.Interface, question: string): Promise<string> {
  return (await rl.question(question)).trim();
}

/**
 * Maskierte Passworteingabe über stdin-Rawmode (kein Echo, nicht einmal
 * Sternchen — ein Mitleser sieht nicht einmal die Länge). Braucht ein TTY;
 * ohne TTY wird sichtbar gewarnt und auf normales readline zurückgefallen.
 */
async function askPassword(rl: readline.Interface, question: string): Promise<string> {
  process.stdout.write(question);

  if (!process.stdin.isTTY) {
    process.stdout.write("\n(kein TTY erkannt - Eingabe ist sichtbar)\n");
    return ask(rl, "");
  }

  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    let value = "";

    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
    };

    function onData(chunk: Buffer) {
      const char = chunk.toString("utf8");
      if (char === ENTER_CR || char === ENTER_LF) {
        cleanup();
        process.stdout.write("\n");
        resolve(value);
        return;
      }
      if (char === CTRL_C) {
        cleanup();
        process.stdout.write("\n");
        process.exit(130);
      }
      if (char === BACKSPACE_DEL || char === BACKSPACE_BS) {
        value = value.slice(0, -1);
        return;
      }
      value += char;
    }

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.on("data", onData);
    stdin.once("error", (err) => {
      cleanup();
      reject(err);
    });
  });
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  let username: string;
  let role: string;
  let password: string;
  try {
    const usernameRaw = await ask(rl, "Benutzername: ");
    username = usernameRaw.trim().toLowerCase();
    if (!username) {
      console.error("Benutzername darf nicht leer sein.");
      process.exitCode = 1;
      return;
    }

    const roleRaw = (await ask(rl, "Rolle [owner/admin/user] (Enter = admin): "))
      .trim()
      .toLowerCase();
    role = roleRaw === "" ? "admin" : roleRaw;
    if (role !== "owner" && role !== "admin" && role !== "user") {
      console.error('Rolle muss "owner", "admin" oder "user" sein.');
      process.exitCode = 1;
      return;
    }

    password = await askPassword(rl, "Passwort: ");
    if (password.length < MIN_PASSWORD_LENGTH) {
      console.error(`Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.`);
      process.exitCode = 1;
      return;
    }
    const confirm = await askPassword(rl, "Passwort (Wiederholung): ");
    if (password !== confirm) {
      console.error("Die beiden Eingaben stimmen nicht überein.");
      process.exitCode = 1;
      return;
    }
  } finally {
    rl.close();
  }

  try {
    const passwordHash = await hashPassword(password);
    const [inserted] = await db
      .insert(appUser)
      .values({ username, passwordHash, role })
      .returning({ userId: appUser.userId });

    console.log(`Benutzer "${username}" (Rolle: ${role}, id ${inserted.userId}) angelegt.`);
  } catch (err) {
    if (isUniqueViolation(err)) {
      console.error(`Benutzername "${username}" existiert bereits.`);
    } else {
      console.error("Anlegen fehlgeschlagen:", err);
    }
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
