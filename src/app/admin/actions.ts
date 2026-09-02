"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import {
  appUser,
  club,
  event,
  match,
  matchParticipation,
  matchPlannedRoster,
  matchReferee,
  matchTeam,
  player,
  playerRatingCurrent,
  ratingHistory,
} from "@/db/generated/schema";
import {
  getEloParams,
  getPlayersForMatchEntry,
  getStartRating,
  type MatchEntryPlayer,
} from "@/db/queries";
import { V3_MODEL_ID } from "@/db/model";
import { getAdminSession, getOwnerSession } from "@/lib/auth";
import { computeMatchDeltas, type EloParams } from "@/lib/elo";
import {
  deriveRatingUpdates,
  deriveTeamScores,
  validatePlannedMatchInput,
  validateScoringInput,
  type NormalizedRow,
} from "@/lib/match-input";
import type { ActionResult } from "@/lib/action-result";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";
import {
  isCheckViolation,
  isForeignKeyViolation,
  isTriggerException,
  isUniqueViolation,
} from "@/lib/pg-errors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle-Transaktionstyp ist generisch über Schema/Query-Client, hier reicht "irgendeine tx".
type Tx = PgTransaction<any, any, any>;

/**
 * Das Admin-Layout schützt nur das ANSEHEN — eine Server Action ist ein
 * eigenständig adressierbarer POST-Endpunkt und wird über ihre Action-ID
 * angesprochen, ohne dass das Layout dabei je gerendert wird. Jede Action
 * muss die Session deshalb selbst prüfen.
 */
const NOT_AUTHENTICATED: ActionResult = {
  ok: false,
  error: "Nicht angemeldet. Bitte neu einloggen.",
};

const NOT_OWNER: ActionResult = {
  ok: false,
  error: "Nur der Hauptverantwortliche darf Schiris verwalten.",
};

function requiredText(formData: FormData, field: string): string | null {
  const value = formData.get(field);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalText(formData: FormData, field: string): string | null {
  return requiredText(formData, field);
}

/** Ganzzahl ≥ 0 oder null; `undefined` signalisiert eine ungültige Eingabe. */
function optionalNonNegativeInt(
  formData: FormData,
  field: string,
): number | null | undefined {
  const raw = requiredText(formData, field);
  if (raw === null) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) return undefined;
  return parsed;
}

function requiredId(formData: FormData, field: string): number | null {
  const raw = requiredText(formData, field);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function createClub(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await getAdminSession())) return NOT_AUTHENTICATED;

  const name = requiredText(formData, "name");
  if (!name) return { ok: false, error: "Name ist ein Pflichtfeld." };

  const city = optionalText(formData, "city");

  try {
    await db.insert(club).values({ name, city });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, error: "Diesen Verein gibt es bereits." };
    }
    console.error("createClub", err);
    return { ok: false, error: "Verein konnte nicht angelegt werden." };
  }

  revalidatePath("/admin/vereine");
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true, message: `Verein „${name}" angelegt.` };
}

/**
 * Gemeinsamer Insert-Kern für `createPlayer` und `createPlayerForMatch`.
 * Enthält die Transaktion unverändert — ohne die player_rating_current-Zeile
 * taucht der Spieler zwar in Listen auf, hätte aber keinen Rating-Datensatz.
 * Wirft bei doppelter Rückennummer (isUniqueViolation) — der Aufrufer fängt.
 */
async function insertPlayer(input: {
  displayName: string;
  clubId: number;
  jerseyNumber: number | null;
}): Promise<MatchEntryPlayer> {
  const startRating = await getStartRating();

  const [row] = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(player)
      .values(input)
      .returning({ playerId: player.playerId });

    await tx.insert(playerRatingCurrent).values({
      playerId: inserted.playerId,
      modelId: V3_MODEL_ID,
      rating: String(startRating),
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    });

    return tx
      .select({
        playerId: player.playerId,
        name: player.displayName,
        jerseyNumber: player.jerseyNumber,
        clubName: club.name,
      })
      .from(player)
      .leftJoin(club, eq(club.clubId, player.clubId))
      .where(eq(player.playerId, inserted.playerId));
  });

  return {
    playerId: row.playerId,
    name: row.name,
    jerseyNumber: row.jerseyNumber,
    clubName: row.clubName ?? "—",
    rating: startRating,
    gamesPlayed: 0,
  };
}

export async function createPlayer(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await getAdminSession())) return NOT_AUTHENTICATED;

  const displayName = requiredText(formData, "display_name");
  if (!displayName) return { ok: false, error: "Name ist ein Pflichtfeld." };

  const clubId = requiredId(formData, "club_id");
  if (clubId === null) return { ok: false, error: "Bitte einen Verein auswählen." };

  const jerseyNumber = optionalNonNegativeInt(formData, "jersey_number");
  if (jerseyNumber === undefined) {
    return { ok: false, error: "Rückennummer muss eine ganze Zahl ab 0 sein." };
  }

  try {
    await insertPlayer({ displayName, clubId, jerseyNumber });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return {
        ok: false,
        error: "Diese Rückennummer ist im gewählten Verein schon vergeben.",
      };
    }
    console.error("createPlayer", err);
    return { ok: false, error: "Spieler konnte nicht angelegt werden." };
  }

  revalidatePath("/admin/spieler");
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true, message: `Spieler „${displayName}" angelegt.` };
}

export type CreatePlayerForMatchResult =
  | { ok: true; message: string; player: MatchEntryPlayer }
  | { ok: false; error: string };

/**
 * Wie createPlayer, aber für den TeamBuilder: gibt den angelegten Spieler
 * zurück, statt nur ok/message, damit die aufrufende Komponente ihn ohne
 * Neuladen an die lokale Kaderliste anhängen kann.
 *
 * Kein revalidatePath("/admin/spiele/anlegen") — das würde die Seite neu
 * rendern und den gerade eingeteilten Kader zerstören, genau den State, den
 * dieser Umbau retten soll.
 */
export async function createPlayerForMatch(input: {
  displayName: string;
  clubId: number;
  jerseyNumber: number | null;
}): Promise<CreatePlayerForMatchResult> {
  if (!(await getAdminSession())) {
    return { ok: false, error: "Nicht angemeldet. Bitte neu einloggen." };
  }

  const displayName = input.displayName.trim();
  if (!displayName) return { ok: false, error: "Name ist ein Pflichtfeld." };

  if (!Number.isInteger(input.clubId) || input.clubId <= 0) {
    return { ok: false, error: "Bitte einen Verein auswählen." };
  }

  if (
    input.jerseyNumber !== null &&
    (!Number.isInteger(input.jerseyNumber) || input.jerseyNumber < 0)
  ) {
    return { ok: false, error: "Rückennummer muss eine ganze Zahl ab 0 sein." };
  }

  let created: MatchEntryPlayer;
  try {
    created = await insertPlayer({
      displayName,
      clubId: input.clubId,
      jerseyNumber: input.jerseyNumber,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return {
        ok: false,
        error: "Diese Rückennummer ist im gewählten Verein schon vergeben.",
      };
    }
    console.error("createPlayerForMatch", err);
    return { ok: false, error: "Spieler konnte nicht angelegt werden." };
  }

  revalidatePath("/admin/spieler");
  revalidatePath("/");
  return { ok: true, message: `Spieler „${displayName}" angelegt.`, player: created };
}

export async function createEvent(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await getAdminSession())) return NOT_AUTHENTICATED;

  const name = requiredText(formData, "name");
  if (!name) return { ok: false, error: "Name ist ein Pflichtfeld." };

  const clubId = requiredId(formData, "club_id");
  if (clubId === null) return { ok: false, error: "Bitte einen Verein auswählen." };

  const startsOn = optionalText(formData, "starts_on");
  const endsOn = optionalText(formData, "ends_on");
  // ISO-Datumsstrings (YYYY-MM-DD) sind lexikografisch vergleichbar.
  if (startsOn && endsOn && endsOn < startsOn) {
    return { ok: false, error: "Das Ende darf nicht vor dem Beginn liegen." };
  }

  try {
    await db.insert(event).values({ name, clubId, startsOn, endsOn });
  } catch (err) {
    console.error("createEvent", err);
    return { ok: false, error: "Event konnte nicht angelegt werden." };
  }

  revalidatePath("/admin/events");
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true, message: `Event „${name}" angelegt.` };
}

/**
 * Elo-kritischer Kern, gemeinsam für "sofort erfassen" (historisch) und
 * "geplantes Match bewerten": sperrt die Ausgangswertungen, legt match_team +
 * match_participation an, berechnet die v3-Wertung und schreibt
 * rating_history/player_rating_current fort. matchId muss bereits existieren
 * (die match-Zeile selbst legt der jeweilige Aufrufer an, je nachdem ob das
 * beim Anlegen oder erst beim Bewerten passiert).
 */
async function applyEloAndPersist(
  tx: Tx,
  matchId: number,
  input: {
    teamA: NormalizedRow[];
    teamB: NormalizedRow[];
    kFactor: 50 | 40 | 30 | 20;
    canDiff: number;
    winner: "A" | "B";
  },
  params: EloParams,
): Promise<{ eloResult: ReturnType<typeof computeMatchDeltas>; teamAIds: number[] }> {
  const teamAIds = input.teamA.map((r) => r.playerId);
  const teamBIds = input.teamB.map((r) => r.playerId);
  const allPlayerIds = [...teamAIds, ...teamBIds].sort((a, b) => a - b);

  // 0. Wertungen sperren (Ausgangspunkt für computeMatchDeltas), sortiert
  //    nach player_id gegen Deadlocks bei überlappenden Kadern. Kein
  //    Join: FOR UPDATE auf der nullable Seite eines LEFT JOIN lehnt
  //    Postgres ab, und ein Join würde zusätzlich player sperren.
  const lockedRows = await tx
    .select({
      playerId: playerRatingCurrent.playerId,
      rating: playerRatingCurrent.rating,
      gamesPlayed: playerRatingCurrent.gamesPlayed,
      wins: playerRatingCurrent.wins,
      losses: playerRatingCurrent.losses,
    })
    .from(playerRatingCurrent)
    .where(
      and(
        inArray(playerRatingCurrent.playerId, allPlayerIds),
        eq(playerRatingCurrent.modelId, V3_MODEL_ID),
      ),
    )
    .orderBy(asc(playerRatingCurrent.playerId))
    .for("update");

  const ratingByPlayer = new Map(lockedRows.map((r) => [r.playerId, r]));

  // Selbstheilung: Spieler ohne player_rating_current-Zeile (z. B. per
  // Hand-SQL angelegt) bekommen sie jetzt mit Startwertung, statt das
  // Match abzulehnen oder eine NaN in die Berechnung zu schleusen.
  const missingIds = allPlayerIds.filter((id) => !ratingByPlayer.has(id));
  if (missingIds.length > 0) {
    const startRating = await getStartRating();
    const inserted = await tx
      .insert(playerRatingCurrent)
      .values(
        missingIds.map((playerId) => ({
          playerId,
          modelId: V3_MODEL_ID,
          rating: startRating.toFixed(4),
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          draws: 0,
        })),
      )
      .returning({
        playerId: playerRatingCurrent.playerId,
        rating: playerRatingCurrent.rating,
        gamesPlayed: playerRatingCurrent.gamesPlayed,
        wins: playerRatingCurrent.wins,
        losses: playerRatingCurrent.losses,
      });
    for (const row of inserted) ratingByPlayer.set(row.playerId, row);
  }

  const buildEloInput = (playerId: number, bonusBeer: number) => {
    const row = ratingByPlayer.get(playerId)!;
    return {
      playerId,
      rating: Number(row.rating),
      bonusBeer,
      gamesPlayed: row.gamesPlayed,
    };
  };
  const eloTeamA = input.teamA.map((r) => buildEloInput(r.playerId, r.bonusBeer));
  const eloTeamB = input.teamB.map((r) => buildEloInput(r.playerId, r.bonusBeer));

  // 1. Match-Team-Zeilen — team_size kommt aus der Kaderlänge, nie aus
  //    einem Formularfeld, damit die Spalte nie davon abweichen kann.
  const { scoreA, scoreB } = deriveTeamScores(input.winner);
  const [teamARow] = await tx
    .insert(matchTeam)
    .values({ matchId, side: "A", teamSize: input.teamA.length, score: scoreA })
    .returning({ matchTeamId: matchTeam.matchTeamId });
  const [teamBRow] = await tx
    .insert(matchTeam)
    .values({ matchId, side: "B", teamSize: input.teamB.length, score: scoreB })
    .returning({ matchTeamId: matchTeam.matchTeamId });

  // 2. Teilnahmen
  await tx.insert(matchParticipation).values([
    ...input.teamA.map((r) => ({
      matchTeamId: teamARow.matchTeamId,
      playerId: r.playerId,
      bonusBeer: r.bonusBeer,
      throws: r.throws,
      hits: r.hits,
    })),
    ...input.teamB.map((r) => ({
      matchTeamId: teamBRow.matchTeamId,
      playerId: r.playerId,
      bonusBeer: r.bonusBeer,
      throws: r.throws,
      hits: r.hits,
    })),
  ]);

  // 3. v3-Berechnung — rein, kein DB-Zugriff.
  const eloResult = computeMatchDeltas(
    eloTeamA,
    eloTeamB,
    input.kFactor,
    input.canDiff,
    input.winner === "A" ? 1 : 0,
    params,
  );

  // 4. rating_history (append-only Wahrheit)
  await tx.insert(ratingHistory).values(
    eloResult.players.map((p) => ({
      matchId,
      playerId: p.playerId,
      modelId: V3_MODEL_ID,
      ratingBefore: p.ratingBefore.toFixed(4),
      delta: p.delta.toFixed(4),
      ratingAfter: p.ratingAfter.toFixed(4),
      gamesPlayed: p.gamesPlayed,
    })),
  );

  // 5. player_rating_current fortschreiben — updated_at hat nur bei
  //    INSERT einen Default, bei UPDATE muss es explizit gesetzt werden.
  const before = new Map(
    Array.from(ratingByPlayer.entries()).map(([id, r]) => [
      id,
      { gamesPlayed: r.gamesPlayed, wins: r.wins, losses: r.losses },
    ]),
  );
  const updates = deriveRatingUpdates(eloResult, before, input.winner, teamAIds);
  for (const u of updates) {
    await tx
      .update(playerRatingCurrent)
      .set({
        rating: u.rating,
        gamesPlayed: u.gamesPlayed,
        wins: u.wins,
        losses: u.losses,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(playerRatingCurrent.playerId, u.playerId),
          eq(playerRatingCurrent.modelId, V3_MODEL_ID),
        ),
      );
  }

  return { eloResult, teamAIds };
}

/**
 * Schritt 1 des Zwei-Schritt-Ablaufs: Teams zusammenstellen und als
 * "geplant" speichern — noch kein Ergebnis, keine Elo-Berechnung. Ein
 * geplantes Match ist eine match-Zeile ohne match_team-Zeilen, mit dem
 * Kader stattdessen in match_planned_roster (siehe migrations/0001).
 */
export async function createPlannedMatch(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await getAdminSession())) return NOT_AUTHENTICATED;

  const raw = formData.get("payload");
  if (typeof raw !== "string") return { ok: false, error: "Formulardaten fehlen." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Formulardaten sind beschädigt." };
  }

  const players = await getPlayersForMatchEntry();
  const knownPlayers = new Map(players.map((p) => [p.playerId, p.name]));

  const validated = validatePlannedMatchInput(parsed, knownPlayers, new Date());
  if (!validated.ok) return { ok: false, error: validated.error };
  const input = validated.value;

  let matchId: number;

  try {
    matchId = await db.transaction(async (tx) => {
      const [insertedMatch] = await tx
        .insert(match)
        .values({
          eventId: input.eventId,
          playedAt: input.playedAt.toISOString(),
          kFactor: input.kFactor,
          // Dosenunterschied wird beim Anlegen nicht erfasst (siehe
          // validatePlannedMatchInput), bleibt beim Schema-Default 0. note
          // wird erst beim Bewerten gesetzt (siehe scoreMatch), wenn das
          // Spiel beendet ist.
          name: input.name,
        })
        .returning({ matchId: match.matchId });
      const newMatchId = insertedMatch.matchId;

      await tx.insert(matchPlannedRoster).values([
        ...input.teamA.map((playerId) => ({ matchId: newMatchId, playerId, side: "A" })),
        ...input.teamB.map((playerId) => ({ matchId: newMatchId, playerId, side: "B" })),
      ]);

      if (input.refereePlayerId !== null) {
        await tx.insert(matchReferee).values({
          matchId: newMatchId,
          playerId: input.refereePlayerId,
        });
      }

      return newMatchId;
    });
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return {
        ok: false,
        error: "Event oder Spieler existiert nicht mehr. Bitte Seite neu laden.",
      };
    }
    if (isCheckViolation(err)) {
      return { ok: false, error: "Die Eingaben verletzen eine Regel (Teamgröße)." };
    }
    console.error("createPlannedMatch", err);
    return { ok: false, error: "Match konnte nicht angelegt werden." };
  }

  revalidatePath("/admin/spiele");
  revalidatePath("/admin");
  revalidatePath("/");
  // Serverseitiger Redirect direkt zum Bewerten — konsistent mit scoreMatch
  // unten, robuster als ein Client-Redirect nach einem ok:true-Return.
  redirect(`/admin/spiele/${matchId}/bewerten`);
}

/**
 * Schritt 2 des Zwei-Schritt-Ablaufs: ein zuvor angelegtes, geplantes Match
 * bewerten. Der Kader kommt aus match_planned_roster (FOR UPDATE gesperrt,
 * damit zwei gleichzeitige Bewertungsversuche desselben Matches nicht beide
 * durchgehen) — der Client übermittelt nur noch Statistik und Sieger.
 */
export async function scoreMatch(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await getAdminSession())) return NOT_AUTHENTICATED;

  const matchIdRaw = formData.get("match_id");
  const matchId = typeof matchIdRaw === "string" ? Number(matchIdRaw) : NaN;
  if (!Number.isInteger(matchId) || matchId <= 0) {
    return { ok: false, error: "Ungültiges Match." };
  }

  const raw = formData.get("payload");
  if (typeof raw !== "string") return { ok: false, error: "Formulardaten fehlen." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Formulardaten sind beschädigt." };
  }

  const params = await getEloParams();

  try {
    await db.transaction(async (tx) => {
      // Match-Metadaten (k_factor/can_diff wurden beim Anlegen festgelegt)
      // und Kader gemeinsam sperren — verhindert, dass dasselbe geplante
      // Match zweimal gleichzeitig bewertet wird (zweiter Versuch findet
      // keine Roster-Zeilen mehr, siehe unten).
      const [matchRow] = await tx
        .select({ kFactor: match.kFactor, canDiff: match.canDiff })
        .from(match)
        .where(eq(match.matchId, matchId))
        .for("update");

      if (!matchRow) {
        throw new PlannedMatchNotFoundError();
      }

      const rosterRows = await tx
        .select({ playerId: matchPlannedRoster.playerId, side: matchPlannedRoster.side })
        .from(matchPlannedRoster)
        .where(eq(matchPlannedRoster.matchId, matchId))
        .for("update");

      if (rosterRows.length === 0) {
        throw new PlannedMatchNotFoundError();
      }

      const rosterTeamA = rosterRows.filter((r) => r.side === "A").map((r) => r.playerId);
      const rosterTeamB = rosterRows.filter((r) => r.side === "B").map((r) => r.playerId);

      const validated = validateScoringInput(parsed, rosterTeamA, rosterTeamB);
      if (!validated.ok) {
        throw new ScoringValidationError(validated.error);
      }
      const input = validated.value;

      const kFactor = matchRow.kFactor as 50 | 40 | 30 | 20;

      await applyEloAndPersist(
        tx,
        matchId,
        { teamA: input.teamA, teamB: input.teamB, kFactor, canDiff: matchRow.canDiff, winner: input.winner },
        params,
      );

      // Notiz wird erst hier gesetzt, wenn das Spiel beendet ist.
      if (input.note !== null) {
        await tx.update(match).set({ note: input.note }).where(eq(match.matchId, matchId));
      }

      // Kader-Platzhalter löschen — ab hier ist das Match "bewertet"
      // (match_team-Zeilen existieren), nicht mehr "geplant".
      await tx.delete(matchPlannedRoster).where(eq(matchPlannedRoster.matchId, matchId));
    });
  } catch (err) {
    if (err instanceof PlannedMatchNotFoundError) {
      return {
        ok: false,
        error: "Dieses Match ist nicht mehr geplant oder wurde bereits bewertet.",
      };
    }
    if (err instanceof ScoringValidationError) {
      return { ok: false, error: err.message };
    }
    if (isTriggerException(err)) {
      return {
        ok: false,
        error: "Der Schiedsrichter darf im selben Match nicht mitspielen.",
      };
    }
    if (isCheckViolation(err)) {
      return {
        ok: false,
        error: "Die Eingaben verletzen eine Regel (Teamgröße, Bonusbier oder Ergebnis).",
      };
    }
    if (isForeignKeyViolation(err)) {
      return {
        ok: false,
        error: "Event oder Spieler existiert nicht mehr. Bitte Seite neu laden.",
      };
    }
    if (isUniqueViolation(err)) {
      return { ok: false, error: "Dieses Match wurde bereits bewertet." };
    }
    console.error("scoreMatch", err);
    return { ok: false, error: "Match konnte nicht gespeichert werden." };
  }

  revalidatePath("/admin/spiele");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/spiel/${matchId}`);
  // Serverseitiger Redirect statt eines ok:true-Returns: die Bewerten-Seite
  // selbst wird durch das Bewerten ungültig (match_planned_roster ist jetzt
  // leer, notFound() würde greifen) — ein clientseitiger router.push() nach
  // dem Return verliert das Rennen gegen Next.js' automatische Revalidierung
  // der aktuellen Route und zeigt kurz einen 404, bevor der Redirect greift.
  // redirect() wirft eine Next-interne Exception und muss daher außerhalb
  // des try/catch oben passieren.
  redirect(`/spiel/${matchId}`);
}

class PlannedMatchNotFoundError extends Error {}
class ScoringValidationError extends Error {}

const REFEREE_ROLES = ["admin", "user"] as const;
type AssignableRefereeRole = (typeof REFEREE_ROLES)[number];
function isAssignableRefereeRole(value: string): value is AssignableRefereeRole {
  return (REFEREE_ROLES as readonly string[]).includes(value);
}

export async function createReferee(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await getOwnerSession())) return NOT_OWNER;

  // wie beim Login normalisieren, sonst entsteht ein Konto, mit dem der
  // Login nie matcht.
  const username = requiredText(formData, "username")?.toLowerCase() ?? null;
  if (!username) return { ok: false, error: "Benutzername ist ein Pflichtfeld." };

  const password = (formData.get("password") ?? "").toString();
  const passwordConfirm = (formData.get("password_confirm") ?? "").toString();
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.`,
    };
  }
  if (password !== passwordConfirm) {
    return { ok: false, error: "Die beiden Passwort-Eingaben stimmen nicht überein." };
  }

  const roleRaw = requiredText(formData, "role");
  // owner ist hier nicht wählbar — der Owner-Status wird nicht über dieses
  // Formular vergeben.
  if (!roleRaw || !isAssignableRefereeRole(roleRaw)) {
    return { ok: false, error: "Bitte eine gültige Rolle auswählen." };
  }
  const role = roleRaw;

  try {
    const passwordHash = await hashPassword(password);
    await db.insert(appUser).values({ username, passwordHash, role });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, error: "Diesen Benutzernamen gibt es bereits." };
    }
    console.error("createReferee", err); // niemals formData/Passwort loggen
    return { ok: false, error: "Schiri konnte nicht angelegt werden." };
  }

  revalidatePath("/admin/schiris");
  revalidatePath("/admin");
  return { ok: true, message: `Schiri „${username}" angelegt.` };
}

export async function setRefereeRole(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getOwnerSession();
  if (!session) return NOT_OWNER;

  const userId = requiredId(formData, "user_id");
  if (userId === null) return { ok: false, error: "Ungültiger Benutzer." };

  const roleRaw = requiredText(formData, "role");
  if (!roleRaw || !isAssignableRefereeRole(roleRaw)) {
    return { ok: false, error: "Bitte eine gültige Rolle auswählen." };
  }
  const role = roleRaw;

  if (userId === session.userId) {
    return { ok: false, error: "Die eigene Rolle kann nicht geändert werden." };
  }

  try {
    await db.update(appUser).set({ role }).where(eq(appUser.userId, userId));
  } catch (err) {
    console.error("setRefereeRole", err);
    return { ok: false, error: "Rolle konnte nicht geändert werden." };
  }

  revalidatePath("/admin/schiris");
  return { ok: true, message: "Rolle geändert." };
}

export async function setRefereeActive(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getOwnerSession();
  if (!session) return NOT_OWNER;

  const userId = requiredId(formData, "user_id");
  if (userId === null) return { ok: false, error: "Ungültiger Benutzer." };

  const isActive = formData.get("is_active") === "1" ? 1 : 0;

  if (userId === session.userId) {
    return { ok: false, error: "Das eigene Konto kann nicht deaktiviert werden." };
  }

  try {
    await db.update(appUser).set({ isActive }).where(eq(appUser.userId, userId));
  } catch (err) {
    console.error("setRefereeActive", err);
    return { ok: false, error: "Status konnte nicht geändert werden." };
  }

  revalidatePath("/admin/schiris");
  return { ok: true, message: isActive ? "Schiri aktiviert." : "Schiri deaktiviert." };
}
