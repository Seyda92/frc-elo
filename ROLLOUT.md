# Rollout-Protokoll: VPS-Deploy vom 04.09.2026

Dokumentiert, wie der bislang größte Rollout auf den VPS (`elo.1frc.de`)
durchgeführt wurde: 24 Commits (u.a. Elo-Umstellung, Owner-Rolle,
Passwort-Reset, Live-Match, Schnick-Schnack-Schnuck-Auslosung, Event-Ort)
plus ein Nachtrag. Dient als Vorlage/Checkliste für künftige Rollouts und
hält die dabei gefundenen Eigenheiten des VPS fest, die sonst nirgends
stehen.

**Ergebnis vorweg:** Kein Datenverlust. Die App war während des gesamten
Rollouts durchgehend erreichbar und nutzbar (ein Match wurde sogar live
während des Deploys erfasst).

---

## Ausgangslage

- 21 unveröffentlichte Commits lagen lokal auf `main`, dazu am Rollout-Tag
  entstandene, noch uncommittete Änderungen (Schnick-Schnack-Schnuck-
  Auslosung D22, Event-Ort D23, neue Bearbeiten-Seiten) und zwei
  untrackte Migrationen.
- **Zentrales Risiko:** Es gibt kein Migrations-Tracking und keinen
  Runner — `migrations/*.sql` werden von Hand per `psql` eingespielt.
  Aus dem Repo war nicht ableitbar, welche Migrationen auf dem VPS schon
  angewendet waren. Die Nummerierung überspringt zudem `0005` (hat nie
  existiert, war nirgends dokumentiert), was wie eine verlorene Datei
  aussieht.

## Ablauf

### 1. Lokal committen und prüfen
Vor jedem Commit die volle Kette: `npm run lint`, `npx tsc --noEmit`,
`npm test`, `npm run build`. Änderungen in inhaltlich sinnvolle Commits
aufgeteilt (pro Feature/Migration), nicht als ein Sammel-Commit.

### 2. Backup- und Restore-Skripte ins Repo aufgenommen
Es gab vorher **kein** Backup-Verfahren im Repo. Neu angelegt:
- [scripts/backup-db.sh](scripts/backup-db.sh) — `pg_dump` im laufenden
  Postgres-Container, komprimierter zeitgestempelter Dump.
- [scripts/restore-db.sh](scripts/restore-db.sh) — dokumentierter
  Gegenweg mit Bestätigungsabfrage (Stil analog zu
  [scripts/reset-data.ts](scripts/reset-data.ts)).
- `.gitattributes` ergänzt (`*.sh text eol=lf`), damit die Shebang-Zeile
  bei einem Windows-Checkout nicht durch CRLF kaputtgeht.

### 3. Migrations-Tracking eingeführt
Neue Migration [migrations/0012_schema_migrations.sql](migrations/0012_schema_migrations.sql)
legt eine `schema_migrations`-Tabelle an (`version`, `applied_at`). Jede
künftige Migration sollte am Ende ihre eigene Version dort eintragen —
damit ist ab sofort aus der DB selbst ablesbar, was angewendet wurde.

### 4. Migrationspfad lokal geprobt
Wichtig: [docker-compose.local.yml](docker-compose.local.yml) baut die
lokale DB aus `schema_postgres.sql` auf (Frisch-Schema-Pfad), das ist
**nicht** der Weg, den die Produktion geht. Stattdessen in einem
isolierten Testcontainer den Migrationspfad selbst geprobt: ein älteres
Schema mit repräsentativen Bestandsdaten geladen, dann die fehlenden
Migrationen der Reihe nach angewendet und die gebaute App dagegen
gestartet. Erst danach den echten Produktions-Dump (aus Schritt 5) auf
demselben Weg geprüft.

### 5. VPS: Ist-Zustand feststellen, dann erst sichern
**Reihenfolge ist bindend: sichern, bevor irgendetwas verändert wird.**

Tatsächlich vorgefundener Zustand, der von der Annahme abwich:
- Kein separates `~/frc-elo-db`-Compose-Projekt (wie in
  [UEBERGABE.md](UEBERGABE.md) beschrieben) — Postgres läuft als
  eigenständiger, benannter Container **`frcspieldaten`** (DB-User
  `adminfrc`, DB-Name `frcspieldaten`). App-Verzeichnis: `~/frc-elo-app`.
- Der Git-Checkout auf dem VPS stand auf einem älteren Commit, hatte aber
  einen **uncommitteten lokalen Zwischenstand** (u.a. eine untrackte
  Migration). Vergleich ergab: byte-identisch mit einem längst lokal
  committeten Feature — kein abweichender Code, nur ein alter
  Arbeitsstand, der nie eingecheckt wurde.
- **Die Datenbank war bereits weiter als der Git-Stand vermuten ließ**:
  mehrere frühe Migrationen waren schon angewendet, obwohl der
  eingecheckte Code davon nichts wusste. Genau das Szenario, das
  Migrations-Tracking künftig sichtbar macht.

Vorgehen, das diesen Fund aufgedeckt hat und für künftige Rollouts gilt:
1. Backup ziehen (`scripts/backup-db.sh` mit den Container-/User-Namen
   des jeweiligen Servers als Env-Variablen), Dump-Größe prüfen, **vom
   Server herunterkopieren** (ein Backup nur auf dem Server ist keins).
2. Restore-Test in einem leeren lokalen Container — ein ungetestetes
   Backup ist eine Vermutung, kein Backup.
3. Ist-Zustand des Schemas per read-only Abfragen gegen
   `information_schema` feststellen (welche Spalten/Tabellen aus welcher
   Migration existieren bereits), daraus die Liste der tatsächlich noch
   fehlenden Migrationen ableiten — nicht raten.
4. Für die bereits vorhandenen Migrationen die passenden Zeilen in
   `schema_migrations` nachtragen, damit die Tabelle ab sofort den
   echten Stand abbildet.

### 6. Migrationen einspielen
Jede fehlende Migration einzeln:
```bash
docker exec -i <db_container> psql -v ON_ERROR_STOP=1 -1 -U <user> -d <db> < migrations/00XX_*.sql
```
- `-1` (single transaction) + `ON_ERROR_STOP=1`: eine Migration läuft
  ganz oder gar nicht durch, kein halb angewendetes Schema bei Fehlern.
- Strikt aufsteigende Reihenfolge, `0005` überspringen.
- `0012_schema_migrations.sql` zuerst, danach die Nachtrag-Inserts für
  die schon vorhandenen Versionen.
- Alle eingespielten Migrationen waren rein additiv (`ADD COLUMN`
  nullable/mit Default, `CREATE TABLE`, `CREATE INDEX`) — kein `DROP`,
  kein `DELETE`.

Nach jedem Schritt Zeilenzahlen gegenprüfen (`player`, `match`,
`app_user`, `rating_history`, `club`) — müssen exakt gleich bleiben.

### 7. App ausrollen
1. `git push origin main`.
2. Auf dem VPS: uncommittete Zwischenstände dort per `git stash -u`
   sichern (nicht verwerfen), dann `git pull` (Fast-Forward).
3. `.env` neben `docker-compose.yml` unangetastet lassen —
   insbesondere `AUTH_SECRET` darf sich nicht ändern, sonst werden alle
   laufenden Sessions ungültig.
4. `docker compose up -d --build`.

Reihenfolge Migration → App ist bewusst so: additive Migrationen stören
die alte App-Version nicht, umgekehrt (App zuerst) würde die neue
Version gegen ein Schema ohne die neuen Spalten/Tabellen laufen.

**Ressourcen-Hinweis für künftige Rollouts:** Der VPS ist ein Nano mit
1,9 GB RAM und **keinem Swap**. Ein `docker compose up -d --build`
brauchte dort **15–35 Minuten** statt der ~1–2 Minuten lokal (`next
build` mit mehreren Workern parallel ist auf diesem Server sehr eng am
Limit, aber lief beide Male ohne OOM/Absturz durch). Der alte Container
bleibt während des gesamten Builds unverändert online — keine Downtime,
aber Geduld einplanen. Eine Swap-Datei würde das beschleunigen/
stabilisieren, wurde bisher aber nicht eingerichtet.

### 8. Live verifizieren
- Container-Status und Logs prüfen.
- Betroffene Seiten durchklicken (Leaderboard, Spielerprofile, Events,
  Vereine, Match anlegen/bewerten, `/live`, Login).
- Datenbestand (Zeilenzahlen) vor/nach vergleichen — müssen exakt
  übereinstimmen (Erhöhungen durch währenddessen echt erfasste Daten
  sind unproblematisch, Reduktionen sind ein Alarmsignal).

## Nachtrag: Logo-Fix

Nach dem Rollout fiel auf, dass das Logo oben links nicht mehr angezeigt
wurde (Logs: `The requested resource isn't a valid image for /logo.png
received null`). Ursache: Next.js' `<Image>`-Komponente ruft `/logo.png`
intern über den `_next/image`-Optimizer ab, **ohne** dabei
Basic-Auth-Credentials mitzuschicken. Der Middleware-Matcher in
[src/middleware.ts](src/middleware.ts) schloss bisher nur den
Optimizer-Endpunkt selbst aus, nicht die Quelldatei — der interne
Request bekam dadurch ein 401 statt das Bild.

**Fix:** `logo.png` zusätzlich in den Matcher aufgenommen (analog zu
`favicon.ico`) — unbedenklich, da öffentliches Asset ohne
schützenswerten Inhalt. Gilt generell: Ein Asset aus `public/`, das über
`<Image>` statt `<img>` eingebunden wird, muss im Basic-Auth-Matcher
ausgenommen sein, sonst schlägt die Next.js-Bildoptimierung fehl.

## Was nicht angefasst wird

- **`scripts/reset-data.ts` / `reset-data.sql`** haben in einem Rollout
  nichts zu suchen — sie löschen alle Spiel-/Spielerdaten und sind für
  den einmaligen Übergang von Test- auf Echtbetrieb gedacht.
- Der Postgres-Container (`frcspieldaten`) wird beim App-Deploy nicht
  neu gestartet oder neu aufgesetzt — die produktive
  [docker-compose.yml](docker-compose.yml) enthält bewusst keinen
  DB-Service und kein Volume.

## Rollback

- **App:** auf dem VPS zum vorherigen Commit wechseln,
  `docker compose up -d --build`. Unkritisch, solange alle Migrationen
  additiv sind.
- **DB:** Restore aus dem vor dem Rollout gezogenen Dump via
  `scripts/restore-db.sh`. Ein "Runter-Migrieren" gibt es bewusst nicht
  — der Dump ist der einzige Rückweg.

## Offene Punkte für den nächsten Rollout

- Swap-Datei auf dem VPS einrichten, um die Build-Dauer/-Stabilität zu
  verbessern (bisher nicht umgesetzt).
- Der uncommittete Server-Zwischenstand von vor diesem Rollout liegt
  weiterhin als `git stash` auf dem VPS (inhaltlich bereits im
  deployten Code enthalten, kann bei Gelegenheit mit `git stash drop`
  entfernt werden).
