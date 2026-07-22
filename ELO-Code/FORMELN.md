# Flunkyreifen ELO-Wertung — Formelübersicht

Zusammenfassung aller aktuell im Code ([flunkyreifen_test.py](flunkyreifen_test.py))
implementierten Formeln in drei Modellvarianten: **v1** (Original laut Spec),
**v2** (korrigiert) und **v3** (Gleichverteilung, Vergleichsvariante).

## Symbole

| Symbol | Bedeutung |
|---|---|
| $R_i$ | Wertung eines Spielers (Start typischerweise 200) |
| $R_A, R_B$ | Summe der Spielerwertungen je Team ($R_A = \sum_i R_i$) |
| $R_\text{team}$ | Wertungssumme des betrachteten Teams |
| $E_A, E_B$ | erwarteter Punktanteil (Gewinnwahrscheinlichkeit) je Team |
| $S$ | Ergebnis aus Teamsicht: $1$ = Sieg, $0{,}5$ = Remis, $0$ = Niederlage; $S_B = 1 - S_A$ |
| $K$ | Spielgewichtung, eine aus $\{50, 40, 30, 20\}$ |
| $n$ | Spieleranzahl im Team ($\geq 4$ laut Modellannahme) |
| $D$ | Dosenunterschied (ganzzahlig, $\geq 0$) |
| $B_i$ | Strafbier eines Spielers ($0 \ldots 10$) |
| $T$ | Teamfaktor (Ausgleich bei Unterzahl des kleineren Teams) |
| $P$ | gesamte Wertungsänderung eines Teams in einem Match |
| $\Delta R_i$ | Wertungsänderung eines einzelnen Spielers |

---

## Gemeinsam für alle Varianten

### Erwartungswert (Elo-Logistik)

$$E_A = \frac{1}{1 + 10^{\,(R_B - R_A)/400}}$$

Es gilt $E_A + E_B = 1$ und bei $R_A = R_B$ ist $E_A = 0{,}5$.
(Im Code wird der Exponent auf $\pm 300$ begrenzt, um Overflow bei extremen
Wertungsdifferenzen zu vermeiden — mathematisch ohne messbaren Effekt.)

### Neue Wertung

$$R_i^{\text{neu}} = R_i + \Delta R_i$$

---

## Modell v1 — Original (laut Spezifikation)

### Team-Änderung

$$P = K \cdot \frac{n + D}{\,n - 3\,} \cdot (S - E)$$

Jedes Team rechnet mit **seiner eigenen** Teamgröße $n$.

### Änderung pro Spieler (anteilige Verteilung)

$$\Delta R_i = P \cdot \frac{R_i}{R_\text{team}} \cdot (1 - 0{,}1 \, B_i) \cdot T$$

### Teamfaktor $T$

$1{,}0$ bei gleicher Teamgröße, sonst je nach Unterzahl des kleineren Teams:

| Spieler Unterzahl | 1 | 2 | 3 | 4 | 5 (und mehr) |
|---|---|---|---|---|---|
| $T$ | 1,2 | 1,3 | 1,4 | 1,5 | 1,6 |

$T$ wird **nur auf das kleinere Team** angewandt.

### Bekannte Schwächen von v1

- **Pol bei $n = 3$:** Nenner $n - 3 = 0$ → Division durch null; für $n < 3$
  Vorzeichenumkehr (Sieger verlöre Punkte).
- **Punkte-Inflation:** Da beide Teams verschiedene Faktoren $\frac{n+D}{n-3}$
  benutzen und $T$ einseitig wirkt, gilt $P_A + P_B \neq 0$ → das System ist
  nicht nullsummig, Wertungen driften unbegrenzt nach oben.

---

## Modell v2 — Korrigiert

Ziel: nullsummen-neutral, kein Pol, gedämpfter Kleine-Team-Effekt.

### Größenfaktor ohne Pol

$$\text{sf}(n, D) = \frac{n + D}{\,n + 7\,}$$

Kein Pol bei $n = 3$, keine Vorzeichenumkehr, deutlich flacher als $\frac{n+D}{n-3}$.

### Team-Änderung (gemeinsamer, symmetrischer Faktor)

$$P = K \cdot \text{sf}\!\left(\tfrac{n_A + n_B}{2},\, D\right) \cdot T \cdot (S - E)$$

**Beide Teams** verwenden denselben, aus beiden Teamgrößen gemittelten
Größenfaktor **und** denselben Teamfaktor $T$. Zusammen mit $S_A + S_B = 1$ und
$E_A + E_B = 1$ folgt daraus $P_A = -P_B$ → **nullsummig** (keine Inflation).

### Änderung pro Spieler (wie v1, anteilig)

$$\Delta R_i = P \cdot \frac{R_i}{R_\text{team}} \cdot (1 - 0{,}1 \, B_i)$$

### Teamfaktor $T$ (gedämpft)

| Spieler Unterzahl | 1 | 2 | 3 | 4 | 5 (und mehr) |
|---|---|---|---|---|---|
| $T$ | 1,03 | 1,06 | 1,09 | 1,12 | 1,15 |

Symmetrisch auf beide Teams angewandt (nicht nur das kleinere).

---

## Modell v3 — Gleichverteilung (Vergleichsvariante)

Identisch zu v2, **außer** der Verteilung auf einzelne Spieler:

$$\Delta R_i = \frac{P}{n} \cdot (1 - 0{,}1 \, B_i)$$

Jeder Spieler bekommt denselben Anteil $P/n$ statt anteilig zu $R_i / R_\text{team}$.

> **Ergebnis des Vergleichs:** v3 bringt gegenüber v2 **keinen** messbaren
> Vorteil. Die anteilige Verteilung $P \cdot R_i / R_\text{team}$ aus der Spec
> (v2) ist unbedenklich; der ursprünglich vermutete „Kleine-Team-Bonus" war ein
> Messfehler, kein Modellfehler.

---

## Simulations- und Konvergenzparameter

Nur für die Fairness-Simulation relevant, nicht Teil der eigentlichen Wertung:

| Parameter | Wert | Bedeutung |
|---|---|---|
| Startwertung | 200 | Anfangs-$R_i$ aller Spieler |
| Teamgröße | 4 – 10 | erlaubte Spieleranzahl je Team |
| max. Größendifferenz | 2 | z. B. 4 vs 6 erlaubt, 5 vs 10 nicht |
| $K$ | $\{50, 40, 30, 20\}$ | Spielgewichtung (zufällig je Match) |

### Provisional-Faktor (schnellere Konvergenz neuer Spieler)

Analog zur Placement-Phase in Schach/Online-Ranglisten wird $\Delta R_i$ neuer
Spieler mit einem erhöhten, linear abklingenden Faktor multipliziert:

$$m(g) = \begin{cases}
3{,}0 - (3{,}0 - 1{,}0)\cdot \dfrac{g}{15} & g < 15 \\[2mm]
1{,}0 & g \geq 15
\end{cases}$$

wobei $g$ die Anzahl der bisher gespielten Matches ist. Ein Anfänger bewegt sich
also anfangs bis zu $3\times$ schneller, ab dem 15. Spiel normal.
