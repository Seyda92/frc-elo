-- Zwei-Schritt-Match-Erfassung: Anlegen (Kader ohne Ergebnis) -> Bewerten.
--
-- match_team.score ist NOT NULL (CHECK score IN (0,1)) - eine Team-Zeile kann
-- also nicht ohne Ergebnis existieren. Diese Tabelle haelt deshalb nur den
-- geplanten Kader (wer spielt auf Seite A/B), bis das Match bewertet wird.
-- Beim Bewerten entstehen match_team/match_participation wie bisher, und die
-- Zeilen hier werden in derselben Transaktion geloescht - "geplant" ist damit
-- eine aus der DB ableitbare Tatsache (Roster-Zeilen ohne match_team-Zeilen),
-- keine eigene Statusspalte.
--
-- Bewusst ohne Bonusbier/Wuerfe/Treffer - die entstehen erst beim Bewerten
-- direkt in match_participation.
--
-- Bekannte Luecke: die Trigger check_referee_not_participant/
-- check_participant_not_referee pruefen nur match_participation, nicht diese
-- Tabelle. Ein Schiri-Konflikt beim Anlegen wird deshalb nur in der
-- TypeScript-Validierung abgefangen, nicht auf DB-Ebene - fuer den
-- Einzel-Admin-Betrieb dieser App vertretbar.
CREATE TABLE match_planned_roster (
    match_id  INTEGER NOT NULL REFERENCES match(match_id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES player(player_id),
    side      TEXT    NOT NULL,
    PRIMARY KEY (match_id, player_id),
    CHECK (side IN ('A','B'))
);

CREATE INDEX idx_planned_roster_match ON match_planned_roster(match_id);
