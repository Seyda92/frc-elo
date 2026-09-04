-- Zwischenstand fuer die Live-Anzeige waehrend der Erfassung: Wuerfe/
-- Treffer/Bonusbier werden hier laufend aktualisiert, waehrend jemand auf
-- der Bewerten-Seite tippt (siehe saveLiveStats in actions.ts), und von
-- /live per Polling gelesen. Reiner Zwischenstand ohne Einfluss auf die
-- Elo-Berechnung - beim finalen Bewerten zaehlt weiterhin das uebermittelte
-- Formular-Payload, und die ganze Zeile verschwindet ohnehin (DELETE FROM
-- match_planned_roster), sobald match_participation befuellt ist.
ALTER TABLE match_planned_roster ADD COLUMN throws INTEGER NOT NULL DEFAULT 0;
ALTER TABLE match_planned_roster ADD COLUMN hits INTEGER NOT NULL DEFAULT 0;
ALTER TABLE match_planned_roster ADD COLUMN bonus_beer INTEGER NOT NULL DEFAULT 0;
ALTER TABLE match_planned_roster ADD CONSTRAINT match_planned_roster_hits_check CHECK (hits <= throws);
ALTER TABLE match_planned_roster ADD CONSTRAINT match_planned_roster_bonus_beer_check CHECK (bonus_beer BETWEEN 0 AND 10);
