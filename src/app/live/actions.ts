"use server";

import { getLiveMatch, type PlannedMatchDetail } from "@/db/queries";

/** Für das Polling auf /live (LiveMatchView.tsx) — bewusst öffentlich, wie
 *  /live selbst: kein Login nötig, das Match ist ohnehin öffentlich auf
 *  der Seite sichtbar. */
export async function fetchLiveMatch(): Promise<PlannedMatchDetail | undefined> {
  return getLiveMatch();
}
