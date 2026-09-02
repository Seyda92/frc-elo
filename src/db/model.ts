/** Einziges Rating-Modell (rating_model.code = 'v3', per CHECK festgenagelt). */
export const V3_MODEL_ID = 1;

/**
 * Notnagel-Startwertung, falls zu einem Spieler die player_rating_current-Zeile
 * fehlt (z. B. per Hand-SQL angelegt) oder die rating_model-Zeile nicht
 * gelesen werden kann.
 *
 * Maßgeblich ist immer rating_model.start_rating aus der DB — diese Konstante
 * ist nur der Fallback für die synchronen Anzeige-Pfade in queries.ts, die
 * kein await pro Zeile machen können. Beide Werte müssen übereinstimmen:
 * seit 09/2026 sind das 1000 (davor 200).
 */
export const FALLBACK_RATING = 1000;
