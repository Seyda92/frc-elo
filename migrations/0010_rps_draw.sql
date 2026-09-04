-- Schnick-Schnack-Schnuck-Auslosung (D22): wer beginnt, wird vor dem Match
-- ausgelost. Je Match hoechstens eine Zeile pro Seite (der Spieler, der fuer
-- diese Seite ausgelost hat) mit einem simplen Zaehler, wie oft er dabei
-- "Ehrenstein" (Stein) gespielt hat. Bewusst kein Rundenlog (wer wann was
-- geworfen hat) - das passiert am Turniertag nicht oft genug, um den
-- Erfassungsaufwand zu rechtfertigen. Erfasst auf der Bewerten-Seite
-- zusammen mit dem restlichen Ergebnis (siehe scoreMatch in actions.ts),
-- kein eigener Live-Zwischenstand noetig. Optional: ein Match kann auch
-- ganz ohne Auslosung bewertet werden.
CREATE TABLE match_rps_draw (
    match_id          INTEGER NOT NULL REFERENCES match(match_id) ON DELETE CASCADE,
    side              TEXT    NOT NULL,
    player_id         INTEGER NOT NULL REFERENCES player(player_id),
    ehrenstein_count  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (match_id, side),
    CHECK (side IN ('A','B')),
    CHECK (ehrenstein_count >= 0)
);

CREATE INDEX idx_rps_draw_player ON match_rps_draw(player_id);
