# Flunkyreifen ELO-Wertung

Elo-ähnliches Team-Wertungssystem für **Flunkyreifen** samt Testharness, die
Validität (mathematische Korrektheit) und Fairness (belohnt Können statt Zufall)
per randomisierten Läufen und Monte-Carlo-Simulation prüft.

## Ausführen

```bash
python flunkyreifen_test.py
```

Standardbibliothek genügt; `numpy`/`scipy`/`matplotlib` werden optional genutzt
(für Spearman-Korrelation und Diagramme), fehlen sie, läuft das Skript trotzdem
durch. Exit-Code `0`, wenn alle Validitätstests bestehen (Fairness-Kennzahlen
sind informativ).

## Das Modell

Wertung eines Teams = Summe der Spielerwertungen; die Gesamtänderung wird auf die
Spieler verteilt.

- Erwartungswert: `E_A = 1 / (1 + 10 ** ((R_B - R_A) / 400))`
- Team-Änderung: `P = K * ((n + D) / (n - 3)) * (S - E)`
- pro Spieler: `dR_i = P * (R_i / R_team) * (1 - 0.1 * B_i) * T`

Details siehe [Flunkyreifen_Testspec.md](Flunkyreifen_Testspec.md).

## Drei Modellvarianten im Vergleich

Die Testharness spielt dieselbe Match-Sequenz parallel mit drei Varianten durch:

| Variante | Beschreibung |
|---|---|
| **v1** | Original aus der Spec |
| **v2** | korrigiert: nullsummen-neutral (`P_A = -P_B`), robuster Größenfaktor `(n+D)/(n+7)` statt `(n+D)/(n-3)` (kein Pol bei n=3), gedämpfter Teamfaktor, Provisional-K-Faktor für schnellere Konvergenz |
| **v3** | wie v2, aber Gleichverteilung `P/n` statt anteilig `P*R_i/R_team` |

### Kernergebnisse

- **v1** leidet unter Punkte-Inflation (Ratings divergieren unbegrenzt) durch den
  asymmetrischen, pro Team unterschiedlichen Faktor `(n+D)/(n-3)`.
- **v2** behebt Inflation und Instabilität vollständig (Netto-Drift ≈ 0 %,
  Ratings bleiben stabil) und bildet die wahre Stärke gut ab.
- **v3** bringt gegenüber v2 **keinen** messbaren Vorteil — die anteilige
  Verteilung `P*R_i/R_team` aus der Spec ist also unbedenklich.
- Die **Kalibrierung** bleibt bei Team-Elo mit zufälligen Teams inhärent begrenzt
  (Vorhersage aus Ratings, Ergebnis aus verborgenem Skill).

## Ausgaben

Beim Ausführen entstehen:

- `flunkyreifen_report.png` — Gesamtsumme über Zeit + Kalibrierungskurven (v1/v2/v3)
- `flunkyreifen_verlauf.png` — Punkteverlauf aller Spieler, nach wahrer Stärke eingefärbt
- `flunkyreifen_verlauf_v{1,2,3}.csv` — vollständige Verlaufsdaten (nicht eingecheckt)
- `flunkyreifen_report.txt` — kompletter Textreport (nicht eingecheckt)
