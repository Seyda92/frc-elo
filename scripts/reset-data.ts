/**
 * Loescht alle Spiel- und Spielerdaten (Testdaten aus der Entwicklung) aus
 * der Datenbank. Owner und Schiris (app_user), Vereine (club) und die
 * Modell-Referenzdaten (rating_model, team_factor) bleiben unangetastet.
 *
 * Laeuft als eigenstaendiges Node-Skript, NICHT ueber Next — deshalb
 * relative Importe mit Endung statt des @/-Alias, und nichts aus
 * src/app/ oder src/db/queries.ts (die nutzen @/ bzw. next/cache). Siehe
 * scripts/create-admin.ts fuer dasselbe Muster.
 *
 * Die eigentlichen SQL-Schritte spiegeln scripts/reset-data.sql — das ist
 * die dokumentierte, per psql einspielbare Referenz. Aenderung an den
 * Schritten hier auch dort nachziehen (und umgekehrt).
 *
 * Aufruf: npm run reset-data (SSH-Tunnel zur DB muss laufen)
 */
import * as readline from "node:readline/promises";
import type { PoolClient } from "pg";
import { pool } from "../src/db/client.ts";

// Reihenfolge der zu leerenden Tabellen (siehe reset-data.sql fuer die
// Fremdschluessel-Begruendung). app_user und club stehen bewusst NICHT hier.
const TABLES_TO_CLEAR = [
  "rating_history",
  "match_participation",
  "match_team",
  "match_referee",
  "match_planned_roster",
  "match",
  "player_rating_current",
  "player_referee_stats",
  "player",
  "event",
] as const;

// Sequenzen, die nach dem Leeren wieder bei 1 starten. app_user.user_id und
// club.club_id bleiben bewusst stabil (siehe Kopfkommentar in
// reset-data.sql: signierte Session-Cookies enthalten die user_id).
const SEQUENCES_TO_RESTART = [
  { table: "player", column: "player_id" },
  { table: "match", column: "match_id" },
  { table: "match_team", column: "match_team_id" },
  { table: "event", column: "event_id" },
  { table: "rating_history", column: "history_id" },
] as const;

const CONFIRM_WORD = "LOESCHEN";

async function ask(rl: readline.Interface, question: string): Promise<string> {
  return (await rl.question(question)).trim();
}

type Counts = Record<(typeof TABLES_TO_CLEAR)[number], number>;

async function countRows(client: PoolClient): Promise<Counts> {
  const counts = {} as Counts;
  for (const table of TABLES_TO_CLEAR) {
    const { rows } = await client.query<{ count: string }>(`SELECT count(*) FROM ${table}`);
    counts[table] = Number(rows[0].count);
  }
  return counts;
}

function printCounts(label: string, counts: Counts): void {
  console.log(label);
  for (const table of TABLES_TO_CLEAR) {
    console.log(`  ${table.padEnd(24)} ${counts[table]}`);
  }
}

type AppUserRow = { userId: number; username: string; role: string; isActive: number };

async function printAppUsers(client: PoolClient, label: string): Promise<AppUserRow[]> {
  const { rows } = await client.query<{
    user_id: number;
    username: string;
    role: string;
    is_active: number;
  }>("SELECT user_id, username, role, is_active FROM app_user ORDER BY user_id");
  const users = rows.map((r) => ({
    userId: r.user_id,
    username: r.username,
    role: r.role,
    isActive: r.is_active,
  }));

  console.log(label);
  for (const u of users) {
    console.log(`  #${u.userId} ${u.username} (${u.role}${u.isActive ? "" : ", deaktiviert"})`);
  }
  return users;
}

async function countClubs(client: PoolClient): Promise<number> {
  const { rows } = await client.query<{ count: string }>("SELECT count(*) FROM club");
  return Number(rows[0].count);
}

async function main() {
  const client = await pool.connect();
  try {
    const beforeUsers = await printAppUsers(client, "Bleibt erhalten — app_user:");
    if (!beforeUsers.some((u) => u.role === "owner")) {
      console.error(
        "Kein Konto mit Rolle 'owner' gefunden. Abbruch — das sollte bei " +
          "einer korrekt aufgesetzten Datenbank nicht vorkommen.",
      );
      process.exitCode = 1;
      return;
    }

    const clubCount = await countClubs(client);
    console.log(`Bleibt erhalten — club: ${clubCount} Verein(e)\n`);

    const before = await countRows(client);
    printCounts("Wird geloescht:", before);

    const totalToDelete = Object.values(before).reduce((a, b) => a + b, 0);
    if (totalToDelete === 0) {
      console.log("\nNichts zu loeschen — alle betroffenen Tabellen sind bereits leer.");
      return;
    }

    console.log(
      `\nDieser Vorgang ist NICHT rueckgaengig zu machen. app_user und club ` +
        `bleiben unberuehrt, alles oben Gelistete wird endgueltig geloescht.`,
    );

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let confirmation: string;
    try {
      confirmation = await ask(rl, `Zum Bestaetigen "${CONFIRM_WORD}" eingeben: `);
    } finally {
      rl.close();
    }

    if (confirmation !== CONFIRM_WORD) {
      console.log("Abgebrochen — nichts wurde geloescht.");
      return;
    }

    await client.query("BEGIN");
    try {
      // Der einzige FK, der von einem Benutzerkonto auf einen Spieler zeigt.
      // Kein ON DELETE SET NULL — ohne dieses UPDATE schlaegt das DELETE auf
      // player fehl. Die Konten selbst bleiben unveraendert.
      await client.query("UPDATE app_user SET player_id = NULL WHERE player_id IS NOT NULL");

      for (const table of TABLES_TO_CLEAR) {
        await client.query(`DELETE FROM ${table}`);
      }

      for (const { table, column } of SEQUENCES_TO_RESTART) {
        await client.query(`ALTER TABLE ${table} ALTER COLUMN ${column} RESTART WITH 1`);
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }

    console.log("\nGeloescht. Kontrolle:");
    const after = await countRows(client);
    printCounts("", after);
    await printAppUsers(client, "\napp_user unveraendert:");
    console.log(`club unveraendert: ${await countClubs(client)} Verein(e)`);
  } finally {
    client.release();
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
