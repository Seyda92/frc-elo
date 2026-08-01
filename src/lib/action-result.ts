export type ActionResult =
  | { ok: true; message: string; matchId?: number }
  | { ok: false; error: string };
