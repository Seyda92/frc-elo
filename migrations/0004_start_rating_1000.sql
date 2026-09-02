-- Grundelo 1000 statt 200 und fester K-Faktor 40.
--
-- start_rating: Bei 200 und ELO_DIVISOR = 400 landen schwache Spieler im
-- negativen Bereich. "Du hast -47 Elo" ist demotivierend, 953 nicht. Die
-- Verschiebung des Startwerts aendert die Formel nicht: in expectedScore
-- gehen nur Rating-DIFFERENZEN ein, keine absoluten Niveaus.
--
-- Das UPDATE ist der eigentlich wirksame Teil. Es gibt kein INSERT INTO
-- rating_model im Repo -- die v3-Zeile wurde von Hand angelegt und hat den
-- alten Spalten-Default 200 mitgenommen. Ein geaenderter DEFAULT wirkt nur
-- auf kuenftige INSERTs und wuerde die bestehende Zeile nicht anfassen.
ALTER TABLE rating_model ALTER COLUMN start_rating SET DEFAULT 1000;
UPDATE rating_model SET start_rating = 1000 WHERE code = 'v3';

-- k_factor: Der "Spieltyp" war nie eine eigene Spalte, sondern genau dieser
-- K-Faktor. Die Auswahl faellt aus dem Formular; die Spalte bleibt NOT NULL
-- und behaelt historische Werte (50/30/20), bekommt aber einen Default,
-- damit Hand-SQL nicht mehr an der fehlenden Angabe scheitert.
ALTER TABLE match ALTER COLUMN k_factor SET DEFAULT 40;
