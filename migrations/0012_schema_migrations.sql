-- Migrations-Tracking: bisher gab es keine Tabelle, die festhaelt, welche
-- Dateien aus migrations/ auf einer gegebenen DB schon eingespielt wurden -
-- das war reines Operator-Gedaechtnis. Ab dieser Migration traegt sich jede
-- neue Migration am Ende selbst mit einem INSERT INTO schema_migrations ein.
--
-- Hinweis fuer alle, die kuenftig auf die Nummerierung schauen: 0005 hat nie
-- existiert (keine verlorene Datei, die Luecke ist beabsichtigt offen
-- geblieben) - siehe DATENBANK.md, Abschnitt "Backup und Restore".
--
-- Bewusst nur version + applied_at, kein Runner, der diese Tabelle selbst
-- pflegt: Migrationen werden weiterhin von Hand per psql eingespielt (siehe
-- DATENBANK.md), diese Tabelle macht das nur nachtraeglich nachvollziehbar
-- statt es zu automatisieren.
CREATE TABLE schema_migrations (
    version     TEXT        NOT NULL PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations (version) VALUES ('0012_schema_migrations');
