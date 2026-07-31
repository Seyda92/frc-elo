/** Postgres-Fehler tragen den SQLSTATE in `code`. */
function sqlState(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err &&
    typeof (err as { code: unknown }).code === "string"
    ? (err as { code: string }).code
    : undefined;
}

export function isUniqueViolation(err: unknown): boolean {
  return sqlState(err) === "23505";
}

/** CHECK-Constraint verletzt (z. B. bonus_beer, team_size, score). */
export function isCheckViolation(err: unknown): boolean {
  return sqlState(err) === "23514";
}

/**
 * RAISE EXCEPTION aus einer plpgsql-Triggerfunktion. Aktuell gibt es in
 * schema_postgres.sql genau zwei solcher RAISE EXCEPTION-Stellen, beide für
 * die Schiedsrichter/Teilnehmer-Exklusivität — die Zuordnung ist also heute
 * exakt, würde aber bei einem künftigen dritten Trigger zu grob.
 */
export function isTriggerException(err: unknown): boolean {
  return sqlState(err) === "P0001";
}

/** Fremdschlüssel verletzt — z. B. Event/Spieler zwischen Laden und Absenden gelöscht. */
export function isForeignKeyViolation(err: unknown): boolean {
  return sqlState(err) === "23503";
}
