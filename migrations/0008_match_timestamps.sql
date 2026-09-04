-- Zusaetzliche Zeitstempel, rein additiv: started_at wird beim Anlegen aus
-- played_at uebernommen (der geplante Zeitpunkt), ended_at beim Bewerten auf
-- den Speicherzeitpunkt gesetzt. Der Status "geplant vs. bewertet" bleibt
-- weiterhin ueber match_team-Zeilen abgeleitet (siehe migrations/0001),
-- nicht ueber diese Felder - sie dienen nur der Anzeige/Sortierung nach
-- tatsaechlichem Abschluss statt nach dem urspruenglich geplanten played_at.
ALTER TABLE match ADD COLUMN started_at TIMESTAMPTZ;
ALTER TABLE match ADD COLUMN ended_at TIMESTAMPTZ;
