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
