# Ideen / Backlog

Noch nicht geplante, nicht umgesetzte Ideen für spätere Iterationen. Kein
Rollout-Bezug (siehe dafür `ROLLOUT.md` → „Offene Punkte für den nächsten
Rollout“).

---

## Owner-Korrektur an bereits gespielten Spielen (nicht-Elo-relevant)

Anlass: Bei Oli (Nr. 13) war bei einem Spiel ein Treffer nicht gewertet
(`hits` < `throws`, obwohl er getroffen hatte). Korrektur wurde am
21./22.09.2026 direkt in der DB nachgezogen (`match_participation.hits`
41 → 1 bei `match_team_id 80` / `match_id 44` / `player_id 31`).

Idee: Der Owner soll bereits gespielte, bereits bewertete Spiele im Nachhinein
selbst korrigieren können — aber nur bei Feldern, die **nicht** in die
Elo-Berechnung einfließen. Elo-relevant ist der Sieg/Niederlage-Status über
`match_team.score`; nicht Elo-relevant sind u. a. `throws`, `hits`,
`bonus_beer` (fließen nur in Trefferquote/Statistik-Anzeige, siehe
`src/lib/format.ts` → `hitRate`, nicht in `src/lib/elo.ts`).

Zu klären, wenn das angegangen wird:
- UI: vermutlich an der bestehenden Bewerten-Seite
  (`src/app/admin/spiele/[id]/bewerten/`) oder einer neuen
  Nachbearbeiten-Ansicht.
- Server Action mit Rollenprüfung auf `owner` (nicht `admin`).
- Muss explizit verhindern, dass über den Umweg `score`/Sieg-Status oder
  sonst etwas Elo-Relevantes verändert wird.

## Löschen fälschlich angelegter Spiele (Owner)

Anlass: Zwei Spiele wurden versehentlich doppelt/falsch angelegt (Match 35
und 42, beide „geplant" — Kader in `match_planned_roster`, nie bewertet,
kurz danach jeweils ein Ersatz-Spiel angelegt: 36 bzw. 43). Es gibt aktuell
**keine** Lösch-Funktion in der App (`src/app/admin/actions.ts` kennt nur
das Leeren von `match_planned_roster` beim Bewerten, kein Match-Delete).
Am 22.09.2026 direkt in der DB nachgezogen: `delete from match where
match_id in (35, 42)` — per `ON DELETE CASCADE` wurden `match_planned_roster`
und `match_referee`-Zeilen automatisch mitgelöscht, `rating_history` war in
beiden Fällen ohnehin leer (nie bewertet, also Elo-neutral).

Idee: Der Owner soll Spiele selbst löschen können. Zu klären:
- Nur geplante/unbewertete Spiele (keine `match_team`-Zeilen, kein
  `rating_history`-Eintrag) löschbar machen, oder auch bereits bewertete?
  Bewertete Spiele haben Elo-Auswirkungen (`rating_history`,
  `player_rating_current`) — Löschen müsste dort ggf. die Folge-Matches
  neu durchrechnen, das ist ein deutlich größerer Eingriff als das reine
  Löschen eines geplanten, nie bewerteten Spiels.
- UI: vermutlich Button in der Spiele-Übersicht / Spiel-Detail-Ansicht,
  nur für Rolle `owner` sichtbar, mit Bestätigungsdialog.
- Server Action mit Rollenprüfung auf `owner`.

## Einfacheres Nachtragen von Spielern (Nachzügler)

Anlass: Nach dem Anlegen eines Spiels (`src/app/admin/spiele/anlegen/`) gibt
es zwar schon einen "+ Spieler anlegen (inline, ohne Seitenwechsel)"-Block
(`NewPlayerBlock` in `TeamBuilderForm.tsx`, Action `createPlayerForMatch`) —
aber nur dort. Sobald das Spiel angelegt ist, gibt es auf der
Bewerten-Seite (`src/app/admin/spiele/[id]/bewerten/ScoreMatchForm.tsx`)
keine Möglichkeit mehr, einen Spieler zum Kader hinzuzufügen: das Roster
wird dort beim Mount aus den Props eingefroren (`useState({ teamA, teamB,
... })`) und `scoreMatch` validiert das eingereichte Payload strikt gegen
den zu diesem Zeitpunkt in `match_planned_roster` stehenden Kader
(`validateScoringInput(parsed, rosterTeamA, rosterTeamB)` in
`src/app/admin/actions.ts`). Kommt ein Nachzügler, der noch nicht im Kader
steht (oder als Spieler noch gar nicht existiert), lässt sich das Spiel
nur mit dem ursprünglichen Kader bewerten — der Nachzügler geht verloren.

Idee (Design bereits mit dem Nutzer geklärt, 22.09.2026):
- Ort: im Bewerten-Formular selbst (`ScoreMatchForm.tsx`), nicht auf der
  reinen Zuschauer-Live-Ansicht (`/live`, `LiveMatchView.tsx` hat aktuell
  keine Auth-Aktionen und bleibt read-only).
- Neue Server Action (Vorbild `createPlannedMatch`/`createPlayerForMatch`):
  fügt einen Spieler (bestehend, per Auswahl — oder neu, wiederverwendet
  `createPlayerForMatch`) direkt einer Seite (A/B) in
  `match_planned_roster` hinzu. Kein Zwischen-Pool wie beim
  Anlegen-Formular — Team A/B wird beim Hinzufügen direkt mitgewählt.
- UX: Ergebnis landet sofort im Formular-State (wie `handlePlayerCreated`
  im Anlegen-Formular), kein Seiten-Neuladen — sonst gingen bereits
  eingetragene Würfe/Treffer/Bonusbier im laufenden Bewerten-Vorgang
  verloren.
- `scoreMatch`/`validateScoringInput` müssen nichts Grundsätzliches ändern,
  da sie ohnehin zur Bewertungszeit gegen den dann aktuellen
  `match_planned_roster`-Stand validieren — der neue Spieler ist zu dem
  Zeitpunkt einfach schon Teil des Kaders.
- Offene Frage: Soll das auch nach dem finalen Speichern (`match_team`/
  `match_participation` existiert bereits) noch möglich sein? Das wäre
  wieder die Elo-Neutralität-Frage aus dem Owner-Korrektur-Punkt oben —
  fürs Erste reicht vermutlich "nur vor dem Bewerten".
