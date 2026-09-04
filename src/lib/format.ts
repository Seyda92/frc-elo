export type EloPoint = { label: string; elo: number };

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function hitRate(stats: { throws: number; hits: number }): number {
  if (stats.throws === 0) return 0;
  return Math.round((stats.hits / stats.throws) * 100);
}

/** Ehrensteine (D22) pro Antritt zur Auslosung — nicht pro gespieltem Spiel,
 *  da nicht jedes Match eine Auslosung hat. */
export function ehrensteinePerAntritt(stats: { ehrensteine: number; antritte: number }): number {
  if (stats.antritte === 0) return 0;
  return Math.round((stats.ehrensteine / stats.antritte) * 100) / 100;
}

export const LEADERBOARD_SORT_KEYS = ["elo", "quote", "games", "bonusBeers", "wins"] as const;
export type LeaderboardSortKey = (typeof LEADERBOARD_SORT_KEYS)[number];
export const SORT_DIRECTIONS = ["asc", "desc"] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

type SortablePlayer = {
  elo: number;
  throws: number;
  hits: number;
  games: number;
  bonusBeers: number;
  wins: number;
};

function leaderboardSortValue(player: SortablePlayer, sortBy: LeaderboardSortKey): number {
  switch (sortBy) {
    case "elo":
      return player.elo;
    case "quote":
      return hitRate(player);
    case "games":
      return player.games;
    case "bonusBeers":
      return player.bonusBeers;
    case "wins":
      return player.wins;
  }
}

/** Sortiert eine Kopie der Liste nach dem gewählten Kriterium. Reine
 *  Funktion (kein DB-Zugriff), damit sie isoliert testbar ist - die
 *  eigentliche Query in getLeaderboard() liefert nur die Rohdaten. */
export function sortLeaderboard<T extends SortablePlayer>(
  players: T[],
  sortBy: LeaderboardSortKey,
  direction: SortDirection,
): T[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...players].sort(
    (a, b) => factor * (leaderboardSortValue(a, sortBy) - leaderboardSortValue(b, sortBy)),
  );
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * Formatiert ein Datum für <input type="datetime-local"> in LOKALER Zeit
 * (`YYYY-MM-DDTHH:mm`). `date.toISOString()` wäre UTC und in Deutschland
 * 1–2 Stunden daneben — genau der Fehler, den dieses Feld vermeiden soll.
 */
export function localDateTimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
