"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { appUser } from "@/db/generated/schema";
import { getAdminSession } from "@/lib/auth";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/password";
import type { ActionResult } from "@/lib/action-result";

export async function changePassword(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getAdminSession();
  if (!session) return { ok: false, error: "Nicht angemeldet. Bitte neu einloggen." };

  const oldPassword = (formData.get("old_password") ?? "").toString();
  const newPassword = (formData.get("new_password") ?? "").toString();
  const newPasswordConfirm = (formData.get("new_password_confirm") ?? "").toString();

  if (!oldPassword) {
    return { ok: false, error: "Bitte das aktuelle Passwort eingeben." };
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Neues Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.`,
    };
  }
  if (newPassword !== newPasswordConfirm) {
    return { ok: false, error: "Die beiden neuen Passwort-Eingaben stimmen nicht überein." };
  }

  const [user] = await db
    .select({ passwordHash: appUser.passwordHash })
    .from(appUser)
    .where(eq(appUser.userId, session.userId));

  if (!user || !(await verifyPassword(oldPassword, user.passwordHash))) {
    return { ok: false, error: "Aktuelles Passwort ist falsch." };
  }

  try {
    const passwordHash = await hashPassword(newPassword);
    await db.update(appUser).set({ passwordHash }).where(eq(appUser.userId, session.userId));
  } catch (err) {
    console.error("changePassword", err); // niemals Passwoerter loggen
    return { ok: false, error: "Passwort konnte nicht geändert werden." };
  }

  return { ok: true, message: "Passwort geändert." };
}
