import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { appUser } from "@/db/generated/schema";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
  verifySession,
  type Session,
} from "@/lib/session";

/**
 * Einziges Modul, das next/headers anfasst — entsprechend dünn gehalten und
 * bewusst ohne eigene Tests (braucht einen Request-Kontext).
 */

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return verifySession(token);
}

/**
 * Liest die Rolle frisch aus app_user nach, statt sich allein auf das
 * Cookie zu verlassen. Das ist die einzige echte Schwäche einer
 * zustandslosen Session: ohne diesen Check behielte ein gelöschter oder
 * degradierter Benutzer bis zu SESSION_TTL_SECONDS Zugriff. Läuft nur auf
 * Admin-Seiten, kostet also nichts auf dem öffentlichen Leaderboard.
 */
export async function getAdminSession(): Promise<Session | null> {
  const session = await getSession();
  if (!session || session.role !== "admin") return null;

  const [row] = await db
    .select({ role: appUser.role })
    .from(appUser)
    .where(eq(appUser.userId, session.userId));

  if (!row || row.role !== "admin") return null;
  return session;
}

/** Für Server Components/Layouts: leitet auf /login um statt null zurückzugeben. */
export async function requireAdmin(): Promise<Session> {
  const session = await getAdminSession();
  if (!session) redirect("/login");
  return session;
}

export async function setSessionCookie(session: Omit<Session, "exp">): Promise<void> {
  const store = await cookies();
  const token = signSession(session);
  store.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
