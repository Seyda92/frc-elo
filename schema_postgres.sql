-- ===========================================================================
-- APP-DOMÄNE (aus elo-app.md: Verein, Event, Login)
-- ===========================================================================

CREATE TABLE club (
    club_id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name         TEXT NOT NULL,
    city         TEXT
);

CREATE TABLE player (
    player_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    club_id       INTEGER REFERENCES club(club_id),
    display_name  TEXT        NOT NULL,
    alias         TEXT,                              -- zusätzlich zum Namen, kein Ersatz
    jersey_number INTEGER,                          -- Rückennummer
    joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active     INTEGER     NOT NULL DEFAULT 1,
    UNIQUE (club_id, jersey_number)
);

CREATE TABLE app_user (
    user_id       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user',     -- 'owner' | 'admin' | 'user'
    player_id     INTEGER REFERENCES player(player_id),  -- optional verknüpft
    is_active     INTEGER NOT NULL DEFAULT 1,
    CHECK (role IN ('owner','admin','user'))
);

-- Genau ein owner. Partieller UNIQUE-Index statt CHECK, weil CHECK nicht
-- ueber Zeilen hinweg pruefen kann.
CREATE UNIQUE INDEX app_user_single_owner ON app_user ((role)) WHERE role = 'owner';

CREATE TABLE event (
    event_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name         TEXT NOT NULL,
    starts_on    DATE,                              -- Wochenende oder länger
    ends_on      DATE,
    club_id      INTEGER REFERENCES club(club_id)
);

-- ===========================================================================
-- ELO-/MATCH-DOMÄNE (aus flunkyreifen_test.py / FORMELN.md)
-- ===========================================================================

-- Modellparameter, fest auf v3 (Gleichverteilung P/n, nullsummen-neutral).
-- Eine einzige Zeile ('v3'); Tabelle bleibt bestehen, falls spaeter doch
-- eine zweite Variante noetig wird, erzwingt aber aktuell keine Auswahl.
CREATE TABLE rating_model (
    model_id            INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code                TEXT          NOT NULL UNIQUE DEFAULT 'v3',
    description         TEXT          NOT NULL DEFAULT 'v3: nullsummen-neutral, Gleichverteilung P/n',
    start_rating        NUMERIC(10,4) NOT NULL DEFAULT 1000,
    size_factor_offset  NUMERIC(10,4) NOT NULL DEFAULT 7.0,  -- c in (n+D)/(n+c)
    is_zero_sum         INTEGER       NOT NULL DEFAULT 1,
    distribution        TEXT          NOT NULL DEFAULT 'equal',  -- v3 = Gleichverteilung P/n
    provisional_games   INTEGER       NOT NULL DEFAULT 15,
    provisional_k_boost NUMERIC(10,4) NOT NULL DEFAULT 3.0,
    CHECK (code = 'v3')
);

-- Teamfaktor-Tabelle T (v3, gedaempft). Groessendifferenz bis 19 moeglich,
-- da Teams jetzt 1..20 Spieler gross sein duerfen (>19 wird auf 19 gedeckelt).
CREATE TABLE team_factor (
    model_id  INTEGER       NOT NULL REFERENCES rating_model(model_id),
    size_diff INTEGER       NOT NULL,                     -- 1..19 (>19 auf 19 gedeckelt)
    factor    NUMERIC(10,6) NOT NULL,
    PRIMARY KEY (model_id, size_diff)
);

-- Match: ein gespieltes Spiel; speichert alle Eingangsgrößen zur Nachrechnung
CREATE TABLE match (
    match_id   INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id   INTEGER     REFERENCES event(event_id),  -- Zuordnung Spieltag
    played_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    k_factor   INTEGER     NOT NULL DEFAULT 40,          -- fest 40; 50/30/20 nur in historischen Zeilen
    can_diff   INTEGER     NOT NULL DEFAULT 0,           -- D (Dosenunterschied, >=0)
    note       TEXT,
    name       TEXT,                                     -- optionaler Anzeigename (z.B. "Finale"), getrennt von note
    team_a_name TEXT,                                     -- optionaler Teamname Seite A, Fallback "Team A"
    team_b_name TEXT,                                     -- optionaler Teamname Seite B, Fallback "Team B"
    started_at TIMESTAMPTZ,                               -- Anlegen-Zeitpunkt (= played_at beim Anlegen)
    ended_at   TIMESTAMPTZ                                -- Speicherzeitpunkt beim Bewerten
);

-- Die zwei Seiten (Teams) eines Matches
CREATE TABLE match_team (
    match_team_id INTEGER      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    match_id      INTEGER      NOT NULL REFERENCES match(match_id) ON DELETE CASCADE,
    side          TEXT         NOT NULL,                  -- 'A' | 'B'
    team_size     INTEGER      NOT NULL,                  -- n, 1..20 Spieler
    score         NUMERIC(2,1) NOT NULL,                  -- S: 1 / 0 (kein Remis)
    UNIQUE (match_id, side),
    CHECK (side IN ('A','B')),
    CHECK (score IN (0, 1)),
    CHECK (team_size BETWEEN 1 AND 20)
);

-- Teilnahme: Spieler in Team, Bonusbier + Wurfstatistik (aus elo-app.md).
-- "Bonusbier" ist die App-Bezeichnung fuer B_i aus der Formel (mindernder
-- Faktor 1-0.1*B_i) - trotz des Namens dasselbe, mindernde Feld.
CREATE TABLE match_participation (
    match_team_id INTEGER NOT NULL REFERENCES match_team(match_team_id) ON DELETE CASCADE,
    player_id     INTEGER NOT NULL REFERENCES player(player_id),
    bonus_beer    INTEGER NOT NULL DEFAULT 0,        -- B_i, 0..10 (mindert dR_i)
    throws        INTEGER,                           -- Würfe (Trefferquote)
    hits          INTEGER,                           -- Treffer
    PRIMARY KEY (match_team_id, player_id),
    CHECK (bonus_beer BETWEEN 0 AND 10),
    CHECK (hits IS NULL OR throws IS NULL OR hits <= throws)
);

-- Schiedsrichter eines Matches: optional (ein Match funktioniert auch ohne),
-- hoechstens einer pro Match. Jeder Spieler kann Schiedsrichter sein, aber
-- nicht in einem Match, in dem er selbst mitspielt (siehe CHECK/Trigger unten).
CREATE TABLE match_referee (
    match_id  INTEGER PRIMARY KEY REFERENCES match(match_id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES player(player_id)
);

-- Erzwingt "nicht im eigenen Team": ein Spieler, der in match_participation
-- fuer dieses match_id auftaucht, darf nicht gleichzeitig dessen
-- match_referee.player_id sein. In Postgres als CHECK-Constraint nicht direkt
-- moeglich (kein Zugriff auf andere Tabellen) - daher als Trigger:
CREATE OR REPLACE FUNCTION check_referee_not_participant() RETURNS trigger AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM   match_participation mp
        JOIN   match_team mt ON mt.match_team_id = mp.match_team_id
        WHERE  mt.match_id  = NEW.match_id
        AND    mp.player_id = NEW.player_id
    ) THEN
        RAISE EXCEPTION 'Spieler % ist Teilnehmer von Match % und kann dort nicht Schiedsrichter sein',
            NEW.player_id, NEW.match_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_referee_not_participant
    BEFORE INSERT OR UPDATE ON match_referee
    FOR EACH ROW EXECUTE FUNCTION check_referee_not_participant();

-- Umgekehrte Richtung (ein Teilnehmer darf nicht nachtraeglich zum
-- Schiedsrichter desselben Matches werden) ueber denselben Mechanismus
-- auf match_participation:
CREATE OR REPLACE FUNCTION check_participant_not_referee() RETURNS trigger AS $$
DECLARE
    v_match_id INTEGER;
BEGIN
    SELECT mt.match_id INTO v_match_id
    FROM   match_team mt WHERE mt.match_team_id = NEW.match_team_id;

    IF EXISTS (
        SELECT 1 FROM match_referee r
        WHERE r.match_id = v_match_id AND r.player_id = NEW.player_id
    ) THEN
        RAISE EXCEPTION 'Spieler % ist Schiedsrichter von Match % und kann dort nicht teilnehmen',
            NEW.player_id, v_match_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_participant_not_referee
    BEFORE INSERT OR UPDATE ON match_participation
    FOR EACH ROW EXECUTE FUNCTION check_participant_not_referee();

-- Zwei-Schritt-Match-Erfassung: Anlegen (Kader ohne Ergebnis) -> Bewerten.
-- match_team.score ist NOT NULL (CHECK score IN (0,1)) - eine Team-Zeile kann
-- also nicht ohne Ergebnis existieren. Diese Tabelle haelt deshalb nur den
-- geplanten Kader (wer spielt auf Seite A/B), bis das Match bewertet wird.
-- Beim Bewerten entstehen match_team/match_participation wie bisher, und die
-- Zeilen hier werden in derselben Transaktion geloescht - "geplant" ist damit
-- eine aus der DB ableitbare Tatsache (Roster-Zeilen ohne match_team-Zeilen),
-- keine eigene Statusspalte. Bewusst ohne Bonusbier/Wuerfe/Treffer - die
-- entstehen erst beim Bewerten direkt in match_participation.
-- Bekannte Luecke: die Trigger oben pruefen nur match_participation, nicht
-- diese Tabelle - ein Schiri-Konflikt beim Anlegen wird nur in der
-- TypeScript-Validierung abgefangen, nicht auf DB-Ebene.
CREATE TABLE match_planned_roster (
    match_id   INTEGER NOT NULL REFERENCES match(match_id) ON DELETE CASCADE,
    player_id  INTEGER NOT NULL REFERENCES player(player_id),
    side       TEXT    NOT NULL,
    -- Zwischenstand fuer /live waehrend der Erfassung, siehe migrations/0009.
    -- Ohne Einfluss auf die Elo-Berechnung; verschwindet mit der Zeile beim
    -- finalen Bewerten.
    throws     INTEGER NOT NULL DEFAULT 0,
    hits       INTEGER NOT NULL DEFAULT 0,
    bonus_beer INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (match_id, player_id),
    CHECK (side IN ('A','B')),
    CHECK (hits <= throws),
    CHECK (bonus_beer BETWEEN 0 AND 10)
);

CREATE INDEX idx_planned_roster_match ON match_planned_roster(match_id);

-- Cache: Anzahl geleiteter Partien je Spieler (aus match_referee ableitbar,
-- analog zu player_rating_current). Spart bei Ranglisten/Profilseiten das
-- Zaehlen von match_referee bei jedem Aufruf.
CREATE TABLE player_referee_stats (
    player_id      INTEGER     PRIMARY KEY REFERENCES player(player_id),
    matches_reffed INTEGER     NOT NULL DEFAULT 0,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Haelt player_referee_stats automatisch synchron mit match_referee, egal ob
-- ueber die App oder direkt per SQL eingetragen wird.
CREATE OR REPLACE FUNCTION sync_referee_stats() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO player_referee_stats (player_id, matches_reffed, updated_at)
        VALUES (NEW.player_id, 1, now())
        ON CONFLICT (player_id) DO UPDATE
            SET matches_reffed = player_referee_stats.matches_reffed + 1,
                updated_at     = now();
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE player_referee_stats
        SET    matches_reffed = matches_reffed - 1, updated_at = now()
        WHERE  player_id = OLD.player_id;
    ELSIF TG_OP = 'UPDATE' AND NEW.player_id <> OLD.player_id THEN
        UPDATE player_referee_stats
        SET    matches_reffed = matches_reffed - 1, updated_at = now()
        WHERE  player_id = OLD.player_id;
        INSERT INTO player_referee_stats (player_id, matches_reffed, updated_at)
        VALUES (NEW.player_id, 1, now())
        ON CONFLICT (player_id) DO UPDATE
            SET matches_reffed = player_referee_stats.matches_reffed + 1,
                updated_at     = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_referee_stats
    AFTER INSERT OR UPDATE OR DELETE ON match_referee
    FOR EACH ROW EXECUTE FUNCTION sync_referee_stats();

-- Rating-Verlauf: append-only Wahrheit (rating_before + delta = rating_after).
-- WICHTIG fuer Turnieruebergreifendes Rating: kein event_id/tournament_id
-- hier - der Verlauf ist eine einzige, fortlaufende Kette pro Spieler ueber
-- ALLE Matches und Events hinweg. match.event_id ordnet nur zu, WELCHEM
-- Turnier ein Match angehoerte; es startet keine neue Rating-Kette.
CREATE TABLE rating_history (
    history_id     INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    match_id       INTEGER       NOT NULL REFERENCES match(match_id) ON DELETE CASCADE,
    player_id      INTEGER       NOT NULL REFERENCES player(player_id),
    model_id       INTEGER       NOT NULL REFERENCES rating_model(model_id),  -- immer 'v3'
    rating_before  NUMERIC(10,4) NOT NULL,
    delta          NUMERIC(10,4) NOT NULL,                 -- dR_i
    rating_after   NUMERIC(10,4) NOT NULL,
    games_played   INTEGER       NOT NULL,                 -- g VOR diesem Match (ueber alle Turniere gezaehlt)
    UNIQUE (match_id, player_id, model_id)
);

-- Cache: aktuelles Rating je Spieler (aus rating_history ableitbar).
-- Ein Datensatz pro Spieler, NICHT pro Event/Turnier - das ist der Kern der
-- Turnieruebergreifenden Mitnahme: player_rating_current.rating ist immer
-- der neueste rating_after-Wert ueber die gesamte Karriere des Spielers.
CREATE TABLE player_rating_current (
    player_id     INTEGER       NOT NULL REFERENCES player(player_id),
    model_id      INTEGER       NOT NULL REFERENCES rating_model(model_id),  -- immer 'v3'
    rating        NUMERIC(10,4) NOT NULL,
    games_played  INTEGER       NOT NULL DEFAULT 0,
    wins          INTEGER       NOT NULL DEFAULT 0,        -- Statistik (elo-app.md)
    losses        INTEGER       NOT NULL DEFAULT 0,
    draws         INTEGER       NOT NULL DEFAULT 0,
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    PRIMARY KEY (player_id, model_id)
);

-- Indizes für typische Abfragen
CREATE INDEX idx_history_player_model ON rating_history(player_id, model_id);
CREATE INDEX idx_history_match        ON rating_history(match_id);
CREATE INDEX idx_participation_player ON match_participation(player_id);
CREATE INDEX idx_match_event          ON match(event_id);
CREATE INDEX idx_player_club          ON player(club_id);
