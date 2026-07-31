"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { club, event, player, playerRatingCurrent } from "@/db/generated/schema";
import { getStartRating } from "@/db/queries";

/**
 * ACHTUNG: Diese Actions schreiben ohne jede Zugriffsprüfung. Das ist nur
 * vertretbar, solange die App ausschließlich lokal läuft. Vor einem
 * Deployment muss Login/Auth davor — sonst kann jeder Besucher Daten anlegen.
 */

const V3_MODEL_ID = 1;

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/** Postgres-Fehler tragen den SQLSTATE in `code`. */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "23505";
}

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
