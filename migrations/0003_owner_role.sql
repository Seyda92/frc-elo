-- Dritte Rolle 'owner': darf zusaetzlich zu allem, was ein 'admin' (=Schiri)
-- darf, weitere Schiris anlegen und Rollen aendern. Fachlich schliesst owner
-- admin ein -- Berechtigungspruefungen fragen daher auf "admin ODER owner".
ALTER TABLE app_user DROP CONSTRAINT app_user_role_check;
ALTER TABLE app_user ADD CONSTRAINT app_user_role_check
    CHECK (role IN ('owner','admin','user'));

-- Genau ein owner. Partieller UNIQUE-Index statt CHECK, weil CHECK nicht
-- ueber Zeilen hinweg pruefen kann.
CREATE UNIQUE INDEX app_user_single_owner ON app_user ((role)) WHERE role = 'owner';

-- Deaktivierung ohne Loeschen: ein geloeschter app_user wuerde ggf. an
-- player_id haengende Verknuepfungen mitreissen.
ALTER TABLE app_user ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
