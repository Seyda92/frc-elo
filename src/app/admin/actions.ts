"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  club,
  event,
  match,
  matchParticipation,
  matchReferee,
  matchTeam,
  player,
  playerRatingCurrent,
  ratingHistory,
} from "@/db/generated/schema";
import { getEloParams, getPlayersForMatchEntry, getStartRating } from "@/db/queries";
import { V3_MODEL_ID } from "@/db/model";
import { getAdminSession } from "@/lib/auth";
import { computeMatchDeltas } from "@/lib/elo";
import { deriveRatingUpdates, validateMatchInput } from "@/lib/match-input";
import type { ActionResult } from "@/lib/action-result";
import {
  isCheckViolation,
  isForeignKeyViolation,
  isTriggerException,
  isUniqueViolation,
} from "@/lib/pg-errors";

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
    const startRating = await getStartRating();
    // Transaktion: ohne die player_rating_current-Zeile taucht der Spieler
    // zwar in Listen auf, hätte aber keinen Rating-Datensatz.
    await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(player)
        .values({ displayName, clubId, jerseyNumber })
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
    });
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

export async function recordMatch(
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

  const validated = validateMatchInput(parsed, knownPlayers, new Date());
  if (!validated.ok) return { ok: false, error: validated.error };
  const input = validated.value;

  const params = await getEloParams();

  const teamAIds = input.teamA.map((r) => r.playerId);
  const teamBIds = input.teamB.map((r) => r.playerId);
  const allPlayerIds = [...teamAIds, ...teamBIds].sort((a, b) => a - b);

  let summaryMessage = "";

  try {
    await db.transaction(async (tx) => {
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

      // 1. Match
      const [insertedMatch] = await tx
        .insert(match)
        .values({
          eventId: input.eventId,
          playedAt: input.playedAt.toISOString(),
          kFactor: input.kFactor,
          canDiff: input.canDiff,
          note: input.note,
        })
        .returning({ matchId: match.matchId });
      const matchId = insertedMatch.matchId;

      // 2. Match-Team-Zeilen — team_size kommt aus der Kaderlänge, nie aus
      //    einem Formularfeld, damit die Spalte nie davon abweichen kann.
      const [teamARow] = await tx
        .insert(matchTeam)
        .values({
          matchId,
          side: "A",
          teamSize: input.teamA.length,
          score: input.winner === "A" ? "1" : "0",
        })
        .returning({ matchTeamId: matchTeam.matchTeamId });
      const [teamBRow] = await tx
        .insert(matchTeam)
        .values({
          matchId,
          side: "B",
          teamSize: input.teamB.length,
          score: input.winner === "B" ? "1" : "0",
        })
        .returning({ matchTeamId: matchTeam.matchTeamId });

      // 3. Teilnahmen
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

      // 4. Schiedsrichter (optional) — nach den Teilnahmen: falls die
      //    TS-Validierung doch etwas durchlässt, nennt der Trigger auf
      //    match_referee den Schiedsrichter in seiner Fehlermeldung.
      if (input.refereePlayerId !== null) {
        await tx.insert(matchReferee).values({
          matchId,
          playerId: input.refereePlayerId,
        });
      }

      // 5. v3-Berechnung — rein, kein DB-Zugriff.
      const eloResult = computeMatchDeltas(
        eloTeamA,
        eloTeamB,
        input.kFactor,
        input.canDiff,
        input.winner === "A" ? 1 : 0,
        params,
      );

      // 6. rating_history (append-only Wahrheit)
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

      // 7. player_rating_current fortschreiben — updated_at hat nur bei
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

      // Die Erfolgsmeldung trägt das Ergebnis — anders als eine
      // Live-Vorschau vor dem Absenden ist das garantiert korrekt, weil es
      // exakt der Wert ist, der gerade gespeichert wurde.
      const biggest = [...eloResult.players].sort(
        (a, b) => Math.abs(b.delta) - Math.abs(a.delta),
      )[0];
      const biggestName = knownPlayers.get(biggest.playerId) ?? `Spieler ${biggest.playerId}`;
      const sign = biggest.delta >= 0 ? "+" : "";
      summaryMessage = `Match gespeichert. Team ${input.winner} gewinnt. Größte Änderung: ${biggestName} ${sign}${biggest.delta.toFixed(1)}.`;
    });
  } catch (err) {
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
      return { ok: false, error: "Dieses Match wurde bereits erfasst." };
    }
    console.error("recordMatch", err);
    return { ok: false, error: "Match konnte nicht gespeichert werden." };
  }

  // Diese drei Aufrufe sind aktuell No-Ops: das Root-Layout liest die Session
  // per cookies() und macht dadurch bereits jede Route dynamisch, der Full
  // Route Cache ist app-weit aus. Trotzdem gesetzt, damit die Aufrufkonvention
  // konsistent bleibt, falls sich das einmal ändert.
  revalidatePath("/admin/spiele");
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true, message: summaryMessage };
}
