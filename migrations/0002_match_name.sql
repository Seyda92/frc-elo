-- Optionaler Anzeigename fuer ein Match (z.B. "Finale Sommerturnier"),
-- getrennt von match.note (freier Kommentar, wird nicht in Uebersichten
-- gezeigt). name wird in den Match-Uebersichten angezeigt, wenn gesetzt.
ALTER TABLE match ADD COLUMN name TEXT;
