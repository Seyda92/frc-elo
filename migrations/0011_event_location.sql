-- Eigener, optionaler Event-Ort (D23): bisher wurde der angezeigte Ort
-- immer aus dem verknuepften Verein abgeleitet (club.city/club.name), ein
-- Event hatte keine Moeglichkeit, einen abweichenden Ort zu haben. Nullable
-- mit Fallback auf den Vereinsort in der Anzeige, wenn leer - siehe
-- getAllEvents/getMatchDetail in src/db/queries.ts.
ALTER TABLE event ADD COLUMN location TEXT;
