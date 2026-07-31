"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { appUser } from "@/db/generated/schema";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth";
import { getDummyHash, verifyPassword } from "@/lib/password";
import type { ActionResult } from "@/lib/action-result";

const GENERIC_ERROR: ActionResult = {
  ok: false,
  error: "Benutzername oder Passwort ist falsch.",
};

export async function login(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const username = (formData.get("username") ?? "").toString().trim().toLowerCase();
  const password = (formData.get("password") ?? "").toString();
  if (!username || !password) {
    return { ok: false, error: "Benutzername und Passwort sind Pflichtfelder." };
  }

  let user: { userId: number; role: string; passwordHash: string } | undefined;
  try {
    [user] = await db
      .select({
        userId: appUser.userId,
        role: appUser.role,
        passwordHash: appUser.passwordHash,
      })
      .from(appUser)
      .where(eq(appUser.username, username))
      .limit(1);
  } catch (err) {
    console.error("login", err); // niemals das Passwort loggen
    return { ok: false, error: "Anmeldung derzeit nicht möglich." };
  }

  // Bei unbekanntem Benutzernamen trotzdem gegen einen festen Hash
  // verifizieren, damit die Antwortzeit die Existenz nicht verrät
  // (sonst wären 2ms vs. ~100ms ein Seitenkanal).
  const passwordOk = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, await getDummyHash());

  if (!user || !passwordOk || (user.role !== "admin" && user.role !== "user")) {
    return GENERIC_ERROR;
  }

  await setSessionCookie({ userId: user.userId, username, role: user.role });

  // redirect() wirft intern (NEXT_REDIRECT) und muss außerhalb jedes
  // try/catch stehen, sonst verschluckt der Catch die Weiterleitung.
  // Nur admin-Konten haben in /admin ein Ziel — ein user-Konto würde sonst
  // in einer Schleife /admin -> requireAdmin -> /login landen.
  redirect(user.role === "admin" ? "/admin" : "/");
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/");
}
