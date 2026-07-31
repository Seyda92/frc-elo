# Übergabe: Flunkyreifen ELO-Wertung — Datenbank-Setup

Kontext-Datei für eine neue Claude-Code-Instanz. Enthält Projektüberblick,
bisherigen Stand und die noch offenen Schritte.

---

## Projekt

**Flunkyreifen ELO-Wertung** — Elo-artiges Wertungssystem für Flunkyball-
Turniere („Flunky Reifen"), bestehend aus zwei Quellen, die zu einem
gemeinsamen Datenmodell zusammengeführt wurden:

1. **Python-Testharness** (`ELO-Code/flunkyreifen_test.py`, `FORMELN.md`) —
   drei Modellvarianten v1/v2/v3. **Verwendet wird ausschließlich v3**
   (nullsummen-neutral, Gleichverteilung $P/n$ auf die Spieler, gedämpfter
   Teamfaktor, kein Pol bei kleinen Teamgrößen).
2. **Next.js/TypeScript-Prototyp** (`Seyda92/frc-elo`, Repo-Root hier) —
   Phase 0, bislang nur Dummy-Daten, kein Backend. App-Datenmodell
   beschrieben in `elo-app.md`: Verein, Spieler, Team, Spiel, Spieltag/Event,
   Login/Rollen, Offline-Sync-Anforderung (Raspberry Pi ↔ Cloud).

### Zentrale Design-Entscheidungen (bereits geklärt)

- **Teamgröße:** 1–20 Spieler pro Team.
- **Nur Modell v3**, per `CHECK`-Constraint auf `rating_model.code = 'v3'`
  festgenagelt. Tabelle bleibt bestehen, damit Parameter änderbar sind.
- **Bonusbier = Strafbier:** einheitlich Spalte `bonus_beer` (mindert
  $\Delta R_i$ über Faktor $1-0{,}1B_i$, trotz des Namens).
- **Rating ist turnierübergreifend:** `rating_history` und
  `player_rating_current` hängen nur an `player_id`, **nicht** an
  `event_id`. Kein Reset zwischen Turnieren. `match.event_id` ist reine
  Zuordnung/Filtermöglichkeit.
- **Schiedsrichter:** optional, 0 oder 1 pro Match (`match_referee`).
  Regel „ein Spieler kann im selben Match nicht Teilnehmer *und*
  Schiedsrichter sein" ist per Trigger **in beide Richtungen** abgesichert.
- **`player_referee_stats`:** Cache-Tabelle für Anzahl geleiteter Partien,
  per Trigger synchron mit `match_referee`.
- **Rohdaten vs. abgeleitete Werte getrennt:** `match`/`match_team`/
  `match_participation` sind Eingaben; `rating_history` ist append-only
  Wahrheit; `player_rating_current` nur performanter, jederzeit neu
  berechenbarer Cache.

### Offene Fachfragen (noch nicht entschieden)

- Soll „gleiche Teamgröße beider Seiten" (aus `elo-app.md`) als Constraint
  erzwungen werden? Aktuell **nicht** erzwungen — v3 braucht es
  mathematisch nicht, wäre App-Logik.
- Soll Remis ($S = 0{,}5$) in der App überhaupt erlaubt sein? Schema
  erlaubt 0 / 0.5 / 1.

---

## Relevante Dateien im Repo

| Datei | Inhalt |
|---|---|
| `DATENBANK.md` | **Maßgebliche Schema-Doku** — vollständiges PostgreSQL-DDL im ```sql-Block, ER-Diagramm (mermaid), Beispiel-Queries, Designbegründungen |
| `elo-app.md` | App-Datenmodell des Next.js-Prototyps (Quelle 2) |
| `FORMELN.md` | Mathematische Herleitung der Elo-Modelle |
| `ELO-Code/flunkyreifen_test.py` | Python-Testharness, `play_match_v3` ist die Referenzimplementierung |
| `schema_postgres.sql` | Deployte, native PostgreSQL-DDL (aus `DATENBANK.md` extrahiert, IDENTITY statt SQLite-Autoincrement) |

### Tabellen im Schema (13)

**App-Domäne:** `club`, `player`, `app_user`, `event`
**Elo-/Match-Domäne:** `rating_model`, `team_factor`, `match`, `match_team`,
`match_participation`, `match_referee`, `player_referee_stats`,
`rating_history`, `player_rating_current`

---

## Bisheriger Verlauf / Was schon passiert ist

1. **IONOS-Ansatz (verworfen).** Ursprünglich sollte das Schema in eine
   leere MariaDB/MySQL-Datenbank bei IONOS-Webhosting. Dafür wurde
   `DATENBANK.md` nach MySQL portiert (`schema_mysql.sql` +
   `schema_mysql_triggers.sql`; `match` → `match_` umbenannt, da `MATCH`
   in MySQL reserviert ist).
   **Gescheitert:** Der IONOS-Hostname `db5002278287.hosting-data.io` war
   selbst beim autoritativen IONOS-Nameserver (`ns-1and1.ui-dns.com`) nicht
   auflösbar („Non-existent domain") — serverseitiges IONOS-Problem, kein
   lokales DNS-/Pi-hole-/Router-Problem (verifiziert gegen 8.8.8.8, 1.1.1.1
   und den IONOS-NS selbst).

2. **Umschwenk auf eigenen VPS + PostgreSQL.** Entscheidung: zurück zum
   nativen PostgreSQL-Schema aus `DATENBANK.md`, gehostet auf einem
   **netcup VPS Nano G11s** (Debian), PostgreSQL in einem **Docker-
   Container** via Docker Compose.

3. **Lokale Umgebung:** Node.js LTS (v24.18.0) wurde per `winget` auf dem
   Windows-Rechner installiert (vorher war weder Node, noch echtes Python,
   noch ein DB-Client vorhanden — nur Windows-Store-Platzhalter).

---

## Bereits erledigt (nicht erneut ausführen)

- ✅ VPS eingerichtet, SSH-Zugang funktioniert
- ✅ Docker + Docker Compose auf dem VPS installiert
- ✅ PostgreSQL-Container läuft
- ✅ Datenbank und DB-Rolle angelegt

---

## Noch offen — die eigentliche Aufgabe

### 1. `schema_postgres.sql` erzeugen

Den SQL-Codeblock aus `DATENBANK.md` (der ```sql-Block unter „## DDL (SQL)")
**1:1** in eine neue Datei `schema_postgres.sql` im Repo-Root extrahieren.

Keine inhaltlichen Anpassungen nötig — das DDL ist bereits natives
PostgreSQL (`CREATE OR REPLACE FUNCTION ... LANGUAGE plpgsql`,
`RAISE EXCEPTION`, `ON CONFLICT ... DO UPDATE`, `EXECUTE FUNCTION`).

⚠️ Zwei Details prüfen, da das DDL ursprünglich SQLite-nah geschrieben war:
- `datetime('now')` als DEFAULT ist **SQLite-Syntax** → in PostgreSQL
  `now()` bzw. `CURRENT_TIMESTAMP` verwenden.
- `INTEGER PRIMARY KEY` ohne Auto-Increment → in PostgreSQL
  `GENERATED ALWAYS AS IDENTITY` oder `SERIAL`/`BIGSERIAL` ergänzen.
- Spaltentypen `TEXT`/`REAL`/`INTEGER` sind in PostgreSQL gültig, aber für
  Ratings ist `NUMERIC`/`DOUBLE PRECISION` sauberer als `REAL`.

### 2. Schema in den Container einspielen

```bash
scp schema_postgres.sql <user>@<vps>:~/frc-elo-db/
ssh <user>@<vps>
cd ~/frc-elo-db
docker compose exec -T postgres psql -U <db_user> -d <db_name> < schema_postgres.sql
```

### 3. Verifikation

```bash
docker compose exec postgres psql -U <db_user> -d <db_name> -c '\dt'   # 13 Tabellen
docker compose exec postgres psql -U <db_user> -d <db_name> -c '\df'   # Trigger-Funktionen
```

Erwartete Trigger-Funktionen: `check_referee_not_participant`,
`check_participant_not_referee`, `sync_referee_stats`.

### 4. Smoke-Test (empfohlen)

- Testdaten: 1 `club`, 2 `player`, 1 `rating_model` (v3-Defaults),
  1 `match` + 2 `match_team` + `match_participation`-Zeilen.
- **Gezielter Trigger-Test:** denselben Spieler als `match_referee` *und*
  `match_participation` für dasselbe Match eintragen → muss mit
  `RAISE EXCEPTION` abgelehnt werden (in beide Reihenfolgen testen).
- Vorher klären, ob die Testdaten danach drinbleiben oder gelöscht werden.

### 5. Sicherheit prüfen

Port 5432 darf **nicht** öffentlich exponiert sein — Port-Mapping im
Compose-File sollte `127.0.0.1:5432:5432` lauten (nicht `0.0.0.0`).
Test auf dem VPS: `sudo ss -tlnp | grep 5432`.

### 6. Aufräumen (nach Rückfrage)

`schema_mysql.sql` und `schema_mysql_triggers.sql` sind Reste des
verworfenen IONOS-Ansatzes. Klären, ob löschen oder als Referenz behalten.

---

## Explizite Einschränkung

**Keine Anbindung an die bestehende Next.js-App in diesem Schritt.** Keine
DB-Zugangsdaten in `.env`/`.env.local` des Next.js-Projekts, keine
Code-Änderungen in `src/`, kein Prisma-Client, keine API-Routen. Die
Datenbank wird eigenständig aufgesetzt und verifiziert — die App-Anbindung
ist ein separater, späterer Schritt.

---

## Nächster Schritt für die neue Instanz

Frage den Nutzer nach:
- SSH-Zugangsdaten des VPS (IP, Benutzer, Passwort/Key)
- Name der Datenbank und des DB-Benutzers im Container
- Pfad des Compose-Projektverzeichnisses auf dem VPS

Dann mit Schritt 1 (`schema_postgres.sql` erzeugen) beginnen.
