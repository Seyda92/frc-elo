-- Loescht alle Spiel- und Spielerdaten. Owner und Schiris (app_user),
-- Vereine (club) und die Modell-Referenzdaten (rating_model, team_factor)
-- bleiben erhalten.
--
-- Reihenfolge folgt den Fremdschluesseln von innen nach aussen. Die
-- CASCADE-Beziehungen auf match wuerden einiges davon mit abraeumen; die
-- Tabellen stehen trotzdem einzeln da, weil player_rating_current und
-- player_referee_stats an player haengen und von keinem Cascade erfasst
-- werden.
--
-- BEWUSST kein TRUNCATE ... CASCADE: weil app_user.player_id auf player
-- zeigt, wuerde ein TRUNCATE player CASCADE app_user mitleeren - samt
-- Owner. Nur einzelne DELETE FROM.
--
-- Diese Datei ist die dokumentierte Referenz. scripts/reset-data.ts fuehrt
-- dieselben Schritte kontrolliert aus (Vorschau, Sicherheitsabfrage,
-- Transaktion, Kontrollzaehlung) - bei einer Aenderung hier auch dort
-- nachziehen.
BEGIN;

-- app_user.player_id ist der einzige FK, der von einem Benutzerkonto auf
-- einen Spieler zeigt. Er hat kein ON DELETE SET NULL - ohne dieses UPDATE
-- schlaegt das DELETE auf player fehl. Die Konten selbst (Owner, Schiris)
-- bleiben unberuehrt: Passwort-Hash, Rolle und is_active aendern sich nicht.
UPDATE app_user SET player_id = NULL WHERE player_id IS NOT NULL;

-- Match-Domaene
DELETE FROM rating_history;
DELETE FROM match_participation;
DELETE FROM match_team;
DELETE FROM match_referee;
DELETE FROM match_planned_roster;
DELETE FROM match;

-- Spieler-Domaene (Caches zuerst, beide referenzieren player)
DELETE FROM player_rating_current;
DELETE FROM player_referee_stats;
DELETE FROM player;

-- Events waren Testturniere. Vereine bleiben bewusst stehen.
DELETE FROM event;

-- IDs wieder ab 1. Bewusst OHNE app_user - dessen user_id bleibt stabil,
-- damit bestehende Sessions (Cookie enthaelt uid) nicht auf einmal auf ein
-- anderes Konto zeigen. club ebenfalls nicht, die Zeilen bleiben ja.
ALTER TABLE player          ALTER COLUMN player_id    RESTART WITH 1;
ALTER TABLE match           ALTER COLUMN match_id     RESTART WITH 1;
ALTER TABLE match_team      ALTER COLUMN match_team_id RESTART WITH 1;
ALTER TABLE event           ALTER COLUMN event_id     RESTART WITH 1;
ALTER TABLE rating_history  ALTER COLUMN history_id   RESTART WITH 1;

COMMIT;
