# Aufgabe: Python-Testharness für die Flunkyreifen-Wertung

Du bist eine Claude-Instanz in VS Code. Erstelle eine eigenständige Python-Datei (z. B. `flunkyreifen_test.py`), die das unten beschriebene Wertungssystem implementiert und mit **randomisierten Testläufen** prüft, ob es ein **valider** (mathematisch korrekt, keine Ausreißer/Bugs) und **fairer** (belohnt Können, nicht Zufall oder Systemlücken) Ansatz ist.

Keine externen Abhängigkeiten außer der Standardbibliothek plus optional `numpy` und `scipy` (für Korrelationen). Nutze `random.seed(...)`, damit Läufe reproduzierbar sind. Gib am Ende eine kompakte Zusammenfassung (bestanden/nicht bestanden pro Test) auf der Konsole aus.

---

## 1. Das zu implementierende Modell

Wertung eines Teams = Summe der Spielerwertungen. Die Gesamtänderung wird proportional auf die Spieler verteilt.

Erwartungswert (erwarteter Punktanteil) von Team A:

```
E_A = 1 / (1 + 10 ** ((R_B - R_A) / 400))
```

Gesamte Wertungsänderung eines Teams:

```
P = K * ((n + D) / (n - 3)) * (S - E)
```

Änderung pro Spieler:

```
dR_i = P * (R_i / R_team) * (1 - 0.1 * B_i) * T
```

Neue Wertung: `R_i_neu = R_i + dR_i`.

Variablen:
- `R_i` — Wertung eines Spielers (Start typischerweise ~50, Wertebereich offen)
- `R_A`, `R_B` — Summe der Spielerwertungen je Team
- `S` — Ergebnis aus Sicht des Teams: 1 = Sieg, 0.5 = Unentschieden, 0 = Niederlage (die beiden Teams haben komplementäre S: `S_B = 1 - S_A`)
- `K` — Spielgewichtung: eine aus {50, 40, 30, 20}
- `n` — Spieleranzahl im Team (>= 4 laut Modellannahme)
- `D` — Dosenunterschied (ganzzahlig, >= 0)
- `B_i` — Strafbier eines Spielers (0..10)
- `T` — Teamfaktor: 1.0 bei Gleichstand, sonst 1.2 / 1.3 / 1.4 / 1.5 / 1.6 für 1..5 Spieler Unterzahl des kleineren Teams

Implementiere das Modell als saubere Funktionen (`expected_score`, `team_delta`, `player_deltas`, `play_match`), damit die Tests einzelne Bausteine ansprechen können.

---

## 2. Validitätstests (deterministisch bzw. mit vielen Zufallsinputs)

Für jeden Test viele zufällige Parametersätze ziehen und die Eigenschaft prüfen (Toleranz z. B. `1e-9`):

1. **Komplementärer Erwartungswert:** `E_A + E_B == 1` für beliebige `R_A`, `R_B`.
2. **Gleichstand:** `R_A == R_B` ⇒ `E_A == 0.5`.
3. **Monotonie:** steigt `R_A` (bei festem `R_B`), steigt `E_A` streng monoton; steigt `R_B`, sinkt `E_A`.
4. **Vorzeichen der Änderung:** bei `S=1` (Sieg) ist `P > 0`, bei `S=0` (Niederlage) `P < 0`, bei `S=0.5` liegt `P` betragsmäßig zwischen den beiden — außer die Erwartung war bereits extrem. Prüfe: Sieger gewinnt Punkte, Verlierer verliert Punkte, sofern `E` nicht bereits 0 bzw. 1 war.
5. **Erhaltung innerhalb des Teams:** ohne Strafbier und mit `T=1` gilt `sum(dR_i) == P`, weil `sum(R_i / R_team) == 1`.
6. **Strafbier-Effekt:** `dR_i` fällt linear mit steigendem `B_i`; bei `B_i = 10` ist `dR_i == 0`.
7. **Teamfaktor-Effekt:** bei `T > 1` sind die Beträge der Änderungen des kleineren Teams entsprechend hochskaliert.

---

## 3. Kritische Randfälle (müssen als Warnung/Fehler auffallen)

Diese Fälle sind mutmaßliche Schwächen des Modells — die Tests sollen sie **sichtbar machen**, nicht verstecken:

1. **Division durch null / Instabilität bei kleinen Teams:** `n = 3` ⇒ Nenner `n - 3 = 0`; `n < 3` ⇒ negativer Nenner (Vorzeichenumkehr der Änderung). Dokumentiere das Verhalten.
2. **Leere/Null-Teamwertung:** `R_team = 0` ⇒ Division durch null bei `R_i / R_team`.
3. **Strafbier > 10:** Faktor `(1 - 0.1*B)` wird negativ — ein Sieg würde Punkte kosten. Prüfe, ob das gewollt ist.
4. **Negative Wertungen:** kann `R_i` durch Verluste unter 0 fallen, und was passiert dann mit den Anteilen `R_i / R_team` (Vorzeichen)?

---

## 4. Fairness-Tests per Monte-Carlo-Simulation

Ziel: prüfen, ob das System über viele Spiele hinweg Können abbildet und nicht durch Zufall oder Systemlücken verzerrt wird.

**Setup:** Gib jedem Spieler eine verborgene „wahre Stärke" `skill_i` (z. B. normalverteilt). Erzeuge Spielausgänge aus den wahren Stärken, nicht aus den Wertungen — etwa mit einem logistischen Modell:

```
P(Team A gewinnt) = 1 / (1 + 10 ** ((mean_skill_B - mean_skill_A) / 400))
```

Starte alle mit gleicher Anfangswertung, spiele viele zufällige Matches (zufällige Teamzusammenstellung, K, D, ggf. Strafbier), aktualisiere die Wertungen nach jedem Spiel. Prüfe dann:

1. **Konvergenz / Skill-Korrelation:** Nach vielen Spielen sollte die Rangfolge der Endwertungen stark mit der Rangfolge der wahren Stärken korrelieren (Spearman-Korrelation z. B. > 0.7). Das ist der zentrale Fairness-Nachweis.
2. **Kalibrierung:** Gruppiere Matches nach vorhergesagtem `E_A` (z. B. in Bins 0.5–0.6, 0.6–0.7, …). Die tatsächliche Siegquote pro Bin sollte nahe am vorhergesagten `E_A` liegen.
3. **Punkte-Erhaltung (Systemebene):** Standard-ELO ist nullsummenspiel-artig. Miss pro Match `dR_A_total + dR_B_total`. Prüfe, ob der Faktor `(n+D)/(n-3)` und `T` systematisch Punkte ins System pumpen oder abziehen (Inflation/Deflation). Trage die Gesamtwertungssumme über die Zeit auf.
4. **Stabilität:** Wertungen dürfen nicht divergieren (gegen ±∞ laufen) oder kollabieren. Prüfe Streuung und Extremwerte über die Simulation.
5. **Ausnutzbarkeit (Exploit-Checks):**
   - *Kleine-Team-Bonus:* Da `(n+D)/(n-3)` für kleine `n` groß wird, prüfe, ob Spieler in kleinen Teams schneller/übermäßig Wertung gewinnen — ein Anreiz, das System zu gamen.
   - *Free-Rider:* Ein schwacher Spieler in einem starken Team gewinnt über `R_i/R_team` nur wenig absolut, profitiert aber vom Sieg. Prüfe, ob ein dauerhaft schwacher Spieler ungerechtfertigt aufsteigt.
   - *Dosen-Hebel:* Prüfe den Einfluss großer `D`-Werte auf die Punktemenge.

Für jeden Fairness-Test einen klaren Schwellenwert definieren und bestanden/nicht bestanden ausgeben. Wo ein Test durchfällt, kurz interpretieren, ob es ein Modellfehler oder eine bewusste Designentscheidung sein könnte.

---

## 5. Ausgabe

- Konsolen-Report: pro Test Name, Ergebnis, ggf. gemessener Wert vs. Schwelle.
- Bei den Simulationen: die wichtigsten Kennzahlen (Spearman-Korrelation Skill↔Wertung, Kalibrierungsabweichung, Netto-Punktedrift, Min/Max-Wertung).
- Optional (falls `matplotlib` vorhanden): einfache Plots (Wertungsverlauf, Kalibrierungskurve) — sonst überspringen, ohne dass die Datei fehlschlägt.
- Exit-Code 0 nur, wenn alle *Validitäts*-Tests bestanden sind; Fairness-Tests sind informativ und dürfen den Exit-Code nicht auf Fehler setzen (sie sind Bewertung, kein harter Fehler).

Halte den Code lesbar, kommentiert und in einer einzigen Datei lauffähig (`python flunkyreifen_test.py`).
