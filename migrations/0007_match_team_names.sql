-- Optionale Teamnamen (z.B. "Die Dosenkoenige"), getrennt vom Anzeigename
-- des Matches (match.name). Haengen an match statt an match_team: ein
-- geplantes, noch nicht bewertetes Match hat noch keine match_team-Zeilen
-- (siehe migrations/0001), der Name muss also schon beim Anlegen speicherbar
-- sein. Nullable, UI faellt ohne gesetzten Namen auf "Team A"/"Team B" zurueck.
ALTER TABLE match ADD COLUMN team_a_name TEXT;
ALTER TABLE match ADD COLUMN team_b_name TEXT;
