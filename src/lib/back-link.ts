/**
 * Herkunfts-Codes für die "Zurück"-Leiste auf /spiel/[id] und /spieler/[id].
 * Bewusst eine feste Liste statt eines rohen Pfads im from-Query-Param —
 * das hält die URL kurz, macht sie unmanipulierbar (kein Open-Redirect-
 * Risiko durch beliebige Ziel-URLs) und lässt sich einfach um Detail-IDs
 * erweitern (z. B. "spieler:12" für "zurück zu diesem Spielerprofil").
 */
const STATIC_ORIGINS = {
  board: { label: "Rangliste", href: "/" },
  spiele: { label: "Spiele", href: "/spiele" },
  "admin-spieler": { label: "Spielerverwaltung", href: "/admin/spieler" },
  "admin-spiele": { label: "Spiele-Verwaltung", href: "/admin/spiele" },
} as const;

export type BackOrigin = keyof typeof STATIC_ORIGINS | `spieler:${string}` | `spiel:${string}`;

export function backLinkParam(origin: BackOrigin): string {
  return `?from=${encodeURIComponent(origin)}`;
}

/** Löst den from-Query-Wert zu Label+Ziel auf. Unbekannte/fehlende Werte
 *  fallen auf den übergebenen Default zurück. */
export function resolveBackLink(
  raw: string | undefined,
  fallback: { label: string; href: string },
): { label: string; href: string } {
  if (!raw) return fallback;

  if (raw in STATIC_ORIGINS) {
    return STATIC_ORIGINS[raw as keyof typeof STATIC_ORIGINS];
  }

  const [kind, id] = raw.split(":");
  if (kind === "spieler" && id) {
    return { label: "Spielerprofil", href: `/spieler/${id}` };
  }
  if (kind === "spiel" && id) {
    return { label: "Spielbericht", href: `/spiel/${id}` };
  }

  return fallback;
}
