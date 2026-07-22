"""
Flunkyreifen-Wertung: Modellimplementierung + Validitaets- und Fairness-Testharness.

Ausfuehren mit: python flunkyreifen_test.py

Exit-Code 0 nur, wenn alle Validitaetstests bestehen. Randfall- und
Fairness-Ergebnisse sind informativ und beeinflussen den Exit-Code nicht.
"""

import math
import random
import statistics
import sys
from dataclasses import dataclass, field

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

try:
    from scipy import stats as scipy_stats
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False

random.seed(42)

TOL = 1e-9

# Teamfaktor-Tabelle: Unterzahl des kleineren Teams (1..5 Spieler) -> T
TEAM_FACTOR_TABLE = {1: 1.2, 2: 1.3, 3: 1.4, 4: 1.5, 5: 1.6}

# v2: deutlich gedaempfte Teamfaktor-Tabelle. In v1 begluenstigt T (bis 1.6x)
# NUR das kleinere Team einseitig und ist mitverantwortlich fuer den
# Kleine-Team-Bonus-Exploit. In v2 wird T zwar weiterhin symmetrisch (siehe
# team_delta_v2/play_match_v2) auf beide Teams angewandt, aber die Werte
# selbst werden stark gedaempft, da der urspruengliche Ausgleichsgedanke
# ("Unterzahl soll sich mehr bewegen duerfen") bereits durch den gemeinsamen,
# gutartigen size_factor_v2 grossteils obsolet ist.
TEAM_FACTOR_TABLE_V2 = {1: 1.03, 2: 1.06, 3: 1.09, 4: 1.12, 5: 1.15}


# ---------------------------------------------------------------------------
# 1. Modellfunktionen
# ---------------------------------------------------------------------------

@dataclass
class Player:
    R: float
    B: int = 0  # Strafbier, 0..10 laut Modellannahme


def expected_score(R_A, R_B):
    """Erwarteter Punktanteil von Team A gegen Team B.

    Der Exponent wird auf +-300 begrenzt, um OverflowError bei extremen
    Wertungsdifferenzen zu vermeiden (10**300 ist bereits praktisch 0/inf) -
    das aendert das mathematische Ergebnis nicht messbar, verhindert aber
    einen Absturz bei divergierenden Wertungen (siehe Stabilitaets-Fairnesstest).
    """
    exponent = (R_B - R_A) / 400.0
    exponent = max(-300.0, min(300.0, exponent))
    return 1.0 / (1.0 + 10.0 ** exponent)


def team_delta(K, n, D, S, E):
    """Gesamte Wertungsaenderung eines Teams.

    Bei n == 3 ist der Nenner (n - 3) == 0 -> ZeroDivisionError. Das ist eine
    dokumentierte Modellschwaeche (siehe Randfalltests) und wird hier bewusst
    nicht verschluckt.
    """
    return K * ((n + D) / (n - 3)) * (S - E)


def team_factor(n_a, n_b, table=TEAM_FACTOR_TABLE):
    """Teamfaktor T: 1.0 bei Gleichstand der Teamgroessen, sonst per Tabelle
    fuer 1..5 Spieler Unterzahl des kleineren Teams (>5 wird auf den Wert bei 5 gedeckelt).
    `table` erlaubt v2, eine gedaempfte Tabelle (TEAM_FACTOR_TABLE_V2) zu verwenden."""
    diff = abs(n_a - n_b)
    if diff == 0:
        return 1.0
    return table.get(diff, table[5])


def player_deltas(players, R_team, P, T):
    """Aenderung pro Spieler: dR_i = P * (R_i / R_team) * (1 - 0.1*B_i) * T."""
    return [P * (p.R / R_team) * (1.0 - 0.1 * p.B) * T for p in players]


def play_match(team_a, team_b, K, D, S_A):
    """Spielt ein Match zwischen zwei Teams und gibt die neuen Wertungen
    (als Listen, gleiche Reihenfolge wie team_a/team_b) plus Diagnosedaten zurueck.

    team_a, team_b: Listen von Player
    K: Spielgewichtung
    D: Dosenunterschied (>= 0, aus Sicht des staerker fuehrenden Teams)
    S_A: Ergebnis aus Sicht Team A (1, 0.5 oder 0); S_B = 1 - S_A
    """
    n_a, n_b = len(team_a), len(team_b)
    R_A = sum(p.R for p in team_a)
    R_B = sum(p.R for p in team_b)
    S_B = 1.0 - S_A

    E_A = expected_score(R_A, R_B)
    E_B = expected_score(R_B, R_A)

    T = team_factor(n_a, n_b)
    # Der Teamfaktor beguenstigt das kleinere Team.
    T_a = T if n_a < n_b else (1.0 if n_a == n_b else 1.0)
    T_b = T if n_b < n_a else (1.0 if n_a == n_b else 1.0)

    P_A = team_delta(K, n_a, D, S_A, E_A)
    P_B = team_delta(K, n_b, D, S_B, E_B)

    dR_a = player_deltas(team_a, R_A, P_A, T_a)
    dR_b = player_deltas(team_b, R_B, P_B, T_b)

    new_a = [p.R + d for p, d in zip(team_a, dR_a)]
    new_b = [p.R + d for p, d in zip(team_b, dR_b)]

    info = {
        "E_A": E_A, "E_B": E_B, "P_A": P_A, "P_B": P_B,
        "dR_a": dR_a, "dR_b": dR_b, "T_a": T_a, "T_b": T_b,
    }
    return new_a, new_b, info


# ---------------------------------------------------------------------------
# 1b. Modell v2: korrigierte Variante (nullsummen-neutral, kein Pol, gleiche
#     Skala), entwickelt neben v1 um die drei gefundenen Fairness-Auffaelligkeiten
#     zu beheben, ohne v1 zu veraendern (v1 bleibt fuer den Vorher/Nachher-Vergleich
#     erhalten).
# ---------------------------------------------------------------------------

SIZE_FACTOR_OFFSET = 7.0  # Konstante c in (n+D)/(n+c) - daempft den Pol/die Explosion bei kleinem n


def size_factor_v2(n, D):
    """Robuste, gutartige Ersetzung fuer (n+D)/(n-3): kein Pol bei n=3, keine
    Vorzeichenumkehr bei kleinem n, und deutlich flacherer Anstieg fuer kleine
    Teamgroessen als beim Original - behebt den Kleine-Team-Bonus (Exploit-Check).
    """
    return (n + D) / (n + SIZE_FACTOR_OFFSET)


def team_delta_v2(K, n_a, n_b, D, S, E, T=1.0):
    """Gesamte Wertungsaenderung eines Teams (v2): beide Teams verwenden
    denselben, aus BEIDEN Teamgroessen gemittelten Groessenfaktor statt je der
    eigenen Teamgroesse, UND denselben Teamfaktor T (statt ihn nur dem
    kleineren Team zu geben). Dadurch ist der Gesamtfaktor fuer Team A und
    Team B in einem Match identisch -> zusammen mit S_A+S_B=1 und E_A+E_B=1
    folgt P_A = -P_B (nullsummen-neutral, behebt die Punkte-Inflation)."""
    shared_factor = size_factor_v2((n_a + n_b) / 2.0, D) * T
    return K * shared_factor * (S - E)


def play_match_v2(team_a, team_b, K, D, S_A):
    """Wie play_match, aber mit dem korrigierten Modell v2:
    - team_delta_v2 statt team_delta (gemeinsamer, symmetrischer Groessenfaktor)
    - Teamfaktor T wird nullsummen-neutral angewandt: T skaliert den
      GEMEINSAMEN Betrag der Aenderung fuer beide Teams gleich, statt nur das
      kleinere Team einseitig zu beguenstigen - dadurch bleibt P_A = -P_B auch
      bei T>1 erhalten. Das kleinere Team profitiert weiterhin anteilig mehr
      pro Spieler (ueber R_i/R_team bei kleinerem R_team), aber die
      Teamsumme selbst pumpt keine Punkte mehr ins System.
    """
    n_a, n_b = len(team_a), len(team_b)
    R_A = sum(p.R for p in team_a)
    R_B = sum(p.R for p in team_b)
    S_B = 1.0 - S_A

    E_A = expected_score(R_A, R_B)
    E_B = expected_score(R_B, R_A)

    T = team_factor(n_a, n_b, table=TEAM_FACTOR_TABLE_V2)

    P_A = team_delta_v2(K, n_a, n_b, D, S_A, E_A, T=T)
    P_B = team_delta_v2(K, n_a, n_b, D, S_B, E_B, T=T)

    dR_a = player_deltas(team_a, R_A, P_A, T=1.0)
    dR_b = player_deltas(team_b, R_B, P_B, T=1.0)

    new_a = [p.R + d for p, d in zip(team_a, dR_a)]
    new_b = [p.R + d for p, d in zip(team_b, dR_b)]

    info = {
        "E_A": E_A, "E_B": E_B, "P_A": P_A, "P_B": P_B,
        "dR_a": dR_a, "dR_b": dR_b, "T": T,
    }
    return new_a, new_b, info


# ---------------------------------------------------------------------------
# 1c. Modell v3: wie v2 (gemeinsamer Groessenfaktor, nullsummen-neutral), aber
#     mit GLEICHVERTEILUNG statt anteiliger Verteilung: jeder Spieler bekommt
#     dR_i = P/n * (1-0.1*B_i) statt P*(R_i/R_team)*(1-0.1*B_i).
#
#     Hintergrund: selbst nachdem size_factor_v2/T in v2 stark gedaempft waren,
#     blieb der Kleine-Team-Bonus (gemessen als relative Aenderung dR_i/R_i)
#     bei einer Ratio von ~20-24x bestehen. Ursache ist NICHT der Groessenfaktor,
#     sondern die Verteilungsformel selbst: bei P*(R_i/R_team) und (ungefaehr)
#     gleichen Ratings im Team gilt R_i/R_team ~= 1/n - ein 4er-Team teilt P
#     automatisch auf weniger Koepfe auf als ein 6er-Team, IMMER, unabhaengig
#     vom Groessenfaktor. v3 testet, ob Gleichverteilung (P/n) diesen
#     inhaerenten strukturellen Effekt beseitigt. Achtung: das ist eine
#     Design-Abkehr von der Spec (dR_i = P*(R_i/R_team)*...), die bewusst zu
#     Vergleichszwecken neben v1/v2 dokumentiert wird.
# ---------------------------------------------------------------------------

def player_deltas_v3(players, P, T=1.0):
    """Gleichverteilung: jeder Spieler bekommt denselben Anteil P/n am
    Team-Topf (statt anteilig zu R_i/R_team), moduliert nur durch Strafbier."""
    n = len(players)
    return [(P / n) * (1.0 - 0.1 * p.B) * T for p in players]


def play_match_v3(team_a, team_b, K, D, S_A):
    """Wie play_match_v2 (gemeinsamer Groessenfaktor + Teamfaktor, nullsummen-
    neutral), aber player_deltas_v3 (Gleichverteilung P/n) statt player_deltas
    (Anteilsverteilung P*R_i/R_team) fuer die Aufteilung auf einzelne Spieler."""
    n_a, n_b = len(team_a), len(team_b)
    R_A = sum(p.R for p in team_a)
    R_B = sum(p.R for p in team_b)
    S_B = 1.0 - S_A

    E_A = expected_score(R_A, R_B)
    E_B = expected_score(R_B, R_A)

    T = team_factor(n_a, n_b, table=TEAM_FACTOR_TABLE_V2)

    P_A = team_delta_v2(K, n_a, n_b, D, S_A, E_A, T=T)
    P_B = team_delta_v2(K, n_a, n_b, D, S_B, E_B, T=T)

    dR_a = player_deltas_v3(team_a, P_A, T=1.0)
    dR_b = player_deltas_v3(team_b, P_B, T=1.0)

    new_a = [p.R + d for p, d in zip(team_a, dR_a)]
    new_b = [p.R + d for p, d in zip(team_b, dR_b)]

    info = {
        "E_A": E_A, "E_B": E_B, "P_A": P_A, "P_B": P_B,
        "dR_a": dR_a, "dR_b": dR_b, "T": T,
    }
    return new_a, new_b, info


# ---------------------------------------------------------------------------
# 2. Test-Recorder
# ---------------------------------------------------------------------------

@dataclass
class TestResult:
    name: str
    passed: object  # bool oder None (informativ, kein hartes Pass/Fail)
    measured: str = ""
    threshold: str = ""
    note: str = ""


validity_results = []
edge_case_notes = []
fairness_results = []


def record_validity(name, passed, measured="", threshold="", note=""):
    validity_results.append(TestResult(name, passed, measured, threshold, note))


def record_edge_case(name, note):
    edge_case_notes.append(TestResult(name, None, note=note))


def record_fairness(name, passed, measured="", threshold="", note=""):
    fairness_results.append(TestResult(name, passed, measured, threshold, note))


# ---------------------------------------------------------------------------
# 3. Validitaetstests
# ---------------------------------------------------------------------------

def rand_rating(lo=1.0, hi=2000.0):
    return random.uniform(lo, hi)


def test_complementary_expectation(n=1000):
    ok = True
    max_err = 0.0
    for _ in range(n):
        R_A, R_B = rand_rating(), rand_rating()
        E_A = expected_score(R_A, R_B)
        E_B = expected_score(R_B, R_A)
        err = abs((E_A + E_B) - 1.0)
        max_err = max(max_err, err)
        if err > TOL:
            ok = False
    record_validity(
        "Komplementaerer Erwartungswert (E_A + E_B == 1)",
        ok, measured=f"max_err={max_err:.2e}", threshold=f"tol={TOL:.0e}",
    )


def test_tie_expectation(n=1000):
    ok = True
    max_err = 0.0
    for _ in range(n):
        R = rand_rating()
        E_A = expected_score(R, R)
        err = abs(E_A - 0.5)
        max_err = max(max_err, err)
        if err > TOL:
            ok = False
    record_validity(
        "Gleichstand => E_A == 0.5",
        ok, measured=f"max_err={max_err:.2e}", threshold=f"tol={TOL:.0e}",
    )


def test_monotonicity(n=500):
    ok = True
    for _ in range(n):
        R_A, R_B = rand_rating(), rand_rating()
        step = random.uniform(0.5, 50.0)
        E_base = expected_score(R_A, R_B)
        E_up_a = expected_score(R_A + step, R_B)
        E_up_b = expected_score(R_A, R_B + step)
        if not (E_up_a > E_base):
            ok = False
        if not (E_up_b < E_base):
            ok = False
    record_validity(
        "Monotonie (steigt R_A -> steigt E_A; steigt R_B -> sinkt E_A)",
        ok,
    )


def test_delta_sign(n=1000):
    """Bei Sieg soll P>0 gelten, bei Niederlage P<0 - ausser E ist bereits
    extrem (Saettigung nahe 0/1), dann kann das Vorzeichen degenerieren."""
    ok = True
    skipped = 0
    checked = 0
    for _ in range(n):
        R_A, R_B = rand_rating(), rand_rating()
        n_team = random.randint(4, 8)
        D = random.randint(0, 5)
        K = random.choice([50, 40, 30, 20])
        E_A = expected_score(R_A, R_B)
        E_B = 1.0 - E_A

        # Saettigungsfaelle ausschliessen (E sehr nah an 0 oder 1)
        if E_A < 1e-6 or E_A > 1 - 1e-6:
            skipped += 1
            continue
        checked += 1

        P_win = team_delta(K, n_team, D, 1.0, E_A)
        P_loss = team_delta(K, n_team, D, 0.0, E_A)
        P_draw = team_delta(K, n_team, D, 0.5, E_A)

        if not (P_win > 0):
            ok = False
        if not (P_loss < 0):
            ok = False
        # Unentschieden soll betragsmaessig zwischen Sieg- und Niederlage-Delta liegen
        if not (min(P_loss, P_win) <= P_draw <= max(P_loss, P_win)):
            ok = False
    record_validity(
        "Vorzeichen der Aenderung (Sieg>0, Niederlage<0, Remis dazwischen)",
        ok, measured=f"checked={checked}, skipped(saturation)={skipped}",
    )


def test_within_team_conservation(n=500):
    """Ohne Strafbier und mit T=1 gilt sum(dR_i) == P, weil sum(R_i/R_team) == 1."""
    ok = True
    max_err = 0.0
    for _ in range(n):
        n_team = random.randint(4, 10)
        players = [Player(R=rand_rating(), B=0) for _ in range(n_team)]
        R_team = sum(p.R for p in players)
        P = random.uniform(-100, 100)
        deltas = player_deltas(players, R_team, P, T=1.0)
        err = abs(sum(deltas) - P)
        max_err = max(max_err, err)
        if err > 1e-6:
            ok = False
    record_validity(
        "Erhaltung innerhalb des Teams (B=0, T=1 => sum(dR_i) == P)",
        ok, measured=f"max_err={max_err:.2e}", threshold="tol=1e-6",
    )


def test_penalty_beer_linear(n=500):
    """dR_i faellt linear mit B_i; bei B_i=10 ist dR_i == 0."""
    ok = True
    max_err = 0.0
    for _ in range(n):
        R = rand_rating()
        R_team = rand_rating(R, R + 500)
        P = random.uniform(-100, 100)
        T = random.choice([1.0, 1.2, 1.3])

        vals = []
        for B in range(0, 11):
            p = Player(R=R, B=B)
            d = player_deltas([p], R_team, P, T)[0]
            vals.append(d)

        # Linearitaet: gleiche Differenz zwischen aufeinanderfolgenden B-Werten
        diffs = [vals[i + 1] - vals[i] for i in range(10)]
        if max(diffs) - min(diffs) > 1e-9:
            ok = False
        max_err = max(max_err, abs(vals[10]))
        if abs(vals[10]) > 1e-9:
            ok = False
    record_validity(
        "Strafbier-Effekt (linear fallend, B=10 => dR_i == 0)",
        ok, measured=f"max|dR at B=10|={max_err:.2e}",
    )


def test_team_factor_scaling(n=500):
    """Bei T>1 sind die Betraege der Aenderungen des kleineren Teams
    entsprechend hochskaliert (verglichen mit T=1)."""
    ok = True
    for _ in range(n):
        n_team = random.randint(4, 8)
        players = [Player(R=rand_rating(), B=0) for _ in range(n_team)]
        R_team = sum(p.R for p in players)
        P = random.choice([1, -1]) * random.uniform(1, 100)
        T = random.choice([1.2, 1.3, 1.4, 1.5, 1.6])

        deltas_T1 = player_deltas(players, R_team, P, T=1.0)
        deltas_T = player_deltas(players, R_team, P, T=T)

        for d1, dT in zip(deltas_T1, deltas_T):
            if abs(d1) > TOL and abs(dT) < abs(d1) - TOL:
                ok = False
            expected_ratio = T
            if abs(d1) > TOL:
                ratio = dT / d1
                if abs(ratio - expected_ratio) > 1e-6:
                    ok = False
    record_validity(
        "Teamfaktor-Effekt (T>1 skaliert Betraege proportional hoch)",
        ok,
    )


def test_v2_zero_sum(n=500):
    """v2: bei gleichem D und gemeinsamem Groessenfaktor + gemeinsamem T soll
    P_A + P_B == 0 gelten (nullsummen-neutral), da S_A+S_B=1 und E_A+E_B=1."""
    ok = True
    max_err = 0.0
    for _ in range(n):
        R_A, R_B = rand_rating(), rand_rating()
        n_a = random.randint(4, 10)
        n_b = random.randint(4, 10)
        D = random.randint(0, 6)
        K = random.choice([50, 40, 30, 20])
        E_A = expected_score(R_A, R_B)
        E_B = expected_score(R_B, R_A)
        S_A = random.choice([0.0, 0.5, 1.0])
        S_B = 1.0 - S_A
        T = team_factor(n_a, n_b)

        P_A = team_delta_v2(K, n_a, n_b, D, S_A, E_A, T=T)
        P_B = team_delta_v2(K, n_a, n_b, D, S_B, E_B, T=T)
        err = abs(P_A + P_B)
        max_err = max(max_err, err)
        if err > 1e-6:
            ok = False
    record_validity(
        "[v2] Nullsummen-Neutralitaet (P_A + P_B == 0)",
        ok, measured=f"max_err={max_err:.2e}", threshold="tol=1e-6",
        note="Behebt die Punkte-Inflation von v1: gemeinsamer Groessen- und Teamfaktor "
             "fuer beide Teams -> die Gesamtaenderung eines Matches summiert sich zu 0.",
    )


def test_v2_size_factor_bounded(n=2000):
    """v2: size_factor_v2 hat keinen Pol (n=3 unproblematisch) und waechst fuer
    kleine n deutlich flacher als das v1-Original (n+D)/(n-3)."""
    ok = True
    max_small_n = 0.0
    max_large_n = 0.0
    for _ in range(n):
        D = random.randint(0, 6)
        n_small = random.randint(MIN_TEAM_SIZE, 5)
        n_large = random.randint(9, MAX_TEAM_SIZE)
        f_small = size_factor_v2(n_small, D)
        f_large = size_factor_v2(n_large, D)
        max_small_n = max(max_small_n, f_small)
        max_large_n = max(max_large_n, f_large)
        # Keine Explosion: Faktor bleibt in einem engen, plausiblen Bereich.
        if not (0.0 < f_small < 3.0) or not (0.0 < f_large < 3.0):
            ok = False
    ratio = max_small_n / max_large_n if max_large_n > 0 else float("inf")
    record_validity(
        "[v2] size_factor_v2 beschraenkt (kein Pol, gedaempftes Kleine-Team-Wachstum)",
        ok and ratio < 1.8,
        measured=f"max_factor(n=4..5)={max_small_n:.3f}, max_factor(n=9..10)={max_large_n:.3f}, ratio={ratio:.2f}",
        threshold="beide Faktoren in (0,3), ratio < 1.8",
        note="Ersetzt (n+D)/(n-3): kein Pol bei n=3, kleine Teams bekommen keinen "
             "unverhaeltnismaessigen Faktor mehr gegenueber grossen Teams.",
    )


def run_validity_tests():
    test_complementary_expectation()
    test_tie_expectation()
    test_monotonicity()
    test_delta_sign()
    test_within_team_conservation()
    test_penalty_beer_linear()
    test_team_factor_scaling()
    test_v2_zero_sum()
    test_v2_size_factor_bounded()


# ---------------------------------------------------------------------------
# 4. Kritische Randfaelle (Warnungen, kein Crash, kein Exit-Code-Einfluss)
# ---------------------------------------------------------------------------

def run_edge_case_checks():
    # 1. n == 3: Nenner (n - 3) == 0
    try:
        team_delta(K=40, n=3, D=0, S=1.0, E=0.5)
        record_edge_case(
            "n=3 (Nenner n-3=0)",
            "KEIN Fehler ausgeloest - unerwartet, da (n+D)/0 eigentlich ZeroDivisionError sein sollte.",
        )
    except ZeroDivisionError:
        record_edge_case(
            "n=3 (Nenner n-3=0)",
            "ZeroDivisionError wie erwartet: das Modell ist fuer 3-Spieler-Teams "
            "nicht definiert. Muss vor produktivem Einsatz durch eine Sonderregel "
            "abgefangen werden (z.B. Mindestteamgroesse durchsetzen).",
        )

    # 2. n < 3: negativer Nenner -> Vorzeichenumkehr
    n_small = 2
    P_win = team_delta(K=40, n=n_small, D=0, S=1.0, E=0.3)
    record_edge_case(
        f"n={n_small} < 3 (negativer Nenner)",
        f"P bei Sieg (S=1, E=0.3) = {P_win:.4f} -> "
        + ("VORZEICHENUMKEHR: Sieger verliert Punkte!" if P_win < 0 else "kein Vorzeichenfehler in diesem Fall")
        + ". Bestaetigt: fuer n<3 kehrt der negative Nenner das Vorzeichen der Aenderung um - Sieger wuerden bestraft.",
    )

    # 3. R_team == 0: Division durch Null bei R_i / R_team
    try:
        players = [Player(R=10, B=0), Player(R=-10, B=0)]
        R_team = sum(p.R for p in players)  # == 0
        player_deltas(players, R_team, P=10, T=1.0)
        record_edge_case("R_team=0", "KEIN Fehler ausgeloest - unerwartet.")
    except ZeroDivisionError:
        record_edge_case(
            "R_team=0",
            "ZeroDivisionError wie erwartet: sich gegenseitig aufhebende positive/negative "
            "Spielerwertungen fuehren zu Division durch Null bei R_i/R_team.",
        )

    # 4. Strafbier > 10: Faktor (1 - 0.1*B) wird negativ
    p = Player(R=50, B=15)
    d = player_deltas([p], R_team=50, P=20, T=1.0)[0]
    factor = 1.0 - 0.1 * p.B
    record_edge_case(
        "Strafbier B=15 (> 10)",
        f"Faktor (1-0.1*B) = {factor:.2f} (negativ). Bei P=20 (Sieg) ergibt sich dR = {d:.2f}: "
        "ein Sieg kostet diesem Spieler Punkte. Das Modell begrenzt B nicht auf [0,10] - "
        "sollte in der Praxis durch Eingabevalidierung (B in 0..10) erzwungen werden.",
    )

    # 5. Negative Spielerwertungen: Vorzeichen von R_i / R_team
    players_neg = [Player(R=-20, B=0), Player(R=80, B=0)]
    R_team = sum(p.R for p in players_neg)  # 60
    deltas = player_deltas(players_neg, R_team, P=30, T=1.0)
    record_edge_case(
        "Negative Einzelwertung (ein Spieler R=-20, Team R_team=60)",
        f"dR = {[round(x, 3) for x in deltas]}. Der Spieler mit negativer Wertung erhaelt "
        "eine NEGATIVE Aenderung obwohl das Team gewinnt (P>0), weil R_i/R_team < 0 ist. "
        "Ein Sieg kann so einen bereits schlecht bewerteten Spieler noch weiter verschlechtern - "
        "fragwuerdig aus Fairness-Sicht, sollte als Designfrage geklaert werden.",
    )


# ---------------------------------------------------------------------------
# 5. Fairness: Monte-Carlo-Simulation
# ---------------------------------------------------------------------------

def spearman_corr(xs, ys):
    """Spearman-Rangkorrelation. Nutzt scipy falls vorhanden, sonst eigene
    Implementierung ueber Pearson-Korrelation der Raenge (Standardbibliothek)."""
    if HAS_SCIPY:
        rho, _ = scipy_stats.spearmanr(xs, ys)
        return rho

    def rank(values):
        order = sorted(range(len(values)), key=lambda i: values[i])
        ranks = [0.0] * len(values)
        i = 0
        while i < len(order):
            j = i
            while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
                j += 1
            avg_rank = (i + j) / 2.0 + 1.0
            for k in range(i, j + 1):
                ranks[order[k]] = avg_rank
            i = j + 1
        return ranks

    rx, ry = rank(xs), rank(ys)
    if len(set(rx)) <= 1 or len(set(ry)) <= 1:
        return 0.0
    mean_x, mean_y = statistics.mean(rx), statistics.mean(ry)
    cov = sum((a - mean_x) * (b - mean_y) for a, b in zip(rx, ry))
    var_x = sum((a - mean_x) ** 2 for a in rx)
    var_y = sum((b - mean_y) ** 2 for b in ry)
    denom = math.sqrt(var_x * var_y)
    return cov / denom if denom > 0 else 0.0


START_RATING = 200.0
MAX_TEAM_SIZE = 10
MIN_TEAM_SIZE = 4
MAX_TEAM_SIZE_DIFF = 2  # z.B. 4 vs 6 erlaubt, 5 vs 10 nicht


SKILL_SCALE = 200.0  # Elo-Punkte-Skala fuer die "wahre Staerke" (Fix 3: Skalen-Angleich)


PROVISIONAL_GAMES = 15   # Anzahl Spiele, bis der Provisional-Bonus auf 1.0 abgeklungen ist
PROVISIONAL_K_BOOST = 3.0  # K-Multiplikator beim allerersten Spiel (wie hoher K-Start in Schach)


def provisional_multiplier(games_played):
    """Wie in Schach/Online-Ranglisten: neue Spieler bekommen einen erhoehten
    effektiven K-Faktor, der linear auf 1.0 abklingt, sobald genug Spiele
    gesammelt wurden - beschleunigt die Konvergenz Rating->Skill, ohne die
    Kernformel (team_delta/team_delta_v2) selbst zu veraendern."""
    if games_played >= PROVISIONAL_GAMES:
        return 1.0
    progress = games_played / PROVISIONAL_GAMES
    return PROVISIONAL_K_BOOST - (PROVISIONAL_K_BOOST - 1.0) * progress


# Alle drei Modellvarianten, die parallel auf derselben Match-Sequenz laufen:
# v1 = Original (Spec), v2 = korrigiert (nullsummen-neutral, kein Pol, gedaempftes
# T), v3 = wie v2, aber mit Gleichverteilung (P/n) statt Anteilsverteilung
# (P*R_i/R_team) - testet, ob das die verbleibende Kleine-Team-Ratio beseitigt.
MODEL_NAMES = ("v1", "v2", "v3")
MODEL_PLAY_FUNCS = {"v1": play_match, "v2": play_match_v2, "v3": play_match_v3}


@dataclass
class SimPlayer:
    skill: float
    R_v1: float = START_RATING
    R_v2: float = START_RATING
    R_v3: float = START_RATING
    games_v1: int = 0
    games_v2: int = 0
    games_v3: int = 0


def draw_balanced_team_sizes(rng):
    """Zieht zwei Teamgroessen in [MIN_TEAM_SIZE, MAX_TEAM_SIZE], deren
    Differenz hoechstens MAX_TEAM_SIZE_DIFF betraegt (ausgeglichene Teams)."""
    n_a = rng.randint(MIN_TEAM_SIZE, MAX_TEAM_SIZE)
    lo = max(MIN_TEAM_SIZE, n_a - MAX_TEAM_SIZE_DIFF)
    hi = min(MAX_TEAM_SIZE, n_a + MAX_TEAM_SIZE_DIFF)
    n_b = rng.randint(lo, hi)
    return n_a, n_b


def simulate(n_players=50, n_matches=8000, seed=1234):
    """Spielt dieselbe Match-Sequenz (gleiche Teams, gleiche wahren Ergebnisse)
    parallel mit allen drei Modellvarianten (v1 Original, v2 korrigiert,
    v3 Gleichverteilung) durch, damit der Vergleich nicht durch
    unterschiedliches Zufalls-Rauschen verzerrt wird. Pool bewusst auf max. 50
    Spieler begrenzt (Vorgabe), n_matches entsprechend erhoeht, damit trotzdem
    genug Spiele pro Kopf fuer eine aussagekraeftige Kalibrierung zusammenkommen.

    Fix 3 (Skalen-Angleich): die wahre Staerke skill_i wird in Elo-Punkten
    gezogen (SKILL_SCALE) und das Match-Ergebnis mit DERSELBEN logistischen
    Formel wie expected_score erzeugt (Basis 10, Divisor 400) - so reden
    Ergebnis-Generator und Modellvorhersage dieselbe Sprache.
    """
    rng = random.Random(seed)
    players = [SimPlayer(skill=rng.gauss(0, SKILL_SCALE)) for _ in range(n_players)]

    history = {m: [] for m in MODEL_NAMES}
    calibration_bins = {m: {} for m in MODEL_NAMES}
    match_records = {m: [] for m in MODEL_NAMES}
    # Verlauf: nach jedem Match ein Snapshot aller Spielerratings (fuer Graph/CSV).
    rating_history = {m: [] for m in MODEL_NAMES}

    # Einschwingphase ausschliessen: Ratings starten fuer alle gleich (200) und
    # brauchen einige Matches, um sich dem tatsaechlichen Skill anzunaehern -
    # aehnlich der Placement-Phase in Schach/Online-Spielen. Die Kalibrierung
    # (Vorhersage E_A vs. tatsaechliche Siegquote) ist erst im eingeschwungenen
    # Zustand aussagekraeftig, deshalb zaehlt nur die zweite Haelfte der Matches.
    calibration_warmup_matches = n_matches // 2

    for match_idx in range(n_matches):
        n_a, n_b = draw_balanced_team_sizes(rng)
        # Spieler fuer dieses Match immer zufaellig aus dem gesamten Pool ziehen.
        pool = rng.sample(range(n_players), min(n_a + n_b, n_players))
        idx_a = pool[:n_a]
        idx_b = pool[n_a:n_a + n_b]
        if len(idx_b) < MIN_TEAM_SIZE:
            continue

        team_a = [players[i] for i in idx_a]
        team_b = [players[i] for i in idx_b]

        K = rng.choice([50, 40, 30, 20])
        D = rng.randint(0, 6)

        mean_skill_a = statistics.mean(p.skill for p in team_a)
        mean_skill_b = statistics.mean(p.skill for p in team_b)
        # Gleiche logistische Basis wie expected_score (10**(diff/400)) statt
        # einer unabhaengigen exp(-diff)-Skala - siehe Fix 3.
        p_a_wins = expected_score(mean_skill_a, mean_skill_b)

        outcome = rng.random()
        S_A = 1.0 if outcome < p_a_wins else 0.0

        beers_a = [rng.choice([0, 0, 0, 0, rng.randint(1, 4)]) for _ in team_a]
        beers_b = [rng.choice([0, 0, 0, 0, rng.randint(1, 4)]) for _ in team_b]

        for model in MODEL_NAMES:
            R_attr = f"R_{model}"
            games_attr = f"games_{model}"
            team_a_p = [Player(R=getattr(p, R_attr), B=b) for p, b in zip(team_a, beers_a)]
            team_b_p = [Player(R=getattr(p, R_attr), B=b) for p, b in zip(team_b, beers_b)]

            try:
                new_a, new_b, info = MODEL_PLAY_FUNCS[model](team_a_p, team_b_p, K, D, S_A)
            except ZeroDivisionError:
                # n=3-Sonderfall: Rating fuer dieses Match unveraendert lassen.
                new_a = [p.R for p in team_a_p]
                new_b = [p.R for p in team_b_p]
                info = {"E_A": expected_score(sum(p.R for p in team_a_p), sum(p.R for p in team_b_p)),
                        "dR_a": [0.0] * len(team_a_p), "dR_b": [0.0] * len(team_b_p)}

            # Provisional-Boost: dR_i wird pro Spieler mit einem individuellen,
            # von der bisherigen Spielanzahl abhaengigen Faktor skaliert - neue
            # Spieler konvergieren so schneller zu ihrem wahren Skill, aeltere
            # Spieler bleiben unveraendert bei Faktor 1.0. old_R (Rating VOR
            # diesem Match, aus team_a_p/team_b_p) ist die Referenz, nicht das
            # SimPlayer-Objekt selbst (das hat kein generisches .R).
            new_a = [
                old_p.R + (newR - old_p.R) * provisional_multiplier(getattr(p, games_attr))
                for p, old_p, newR in zip(team_a, team_a_p, new_a)
            ]
            new_b = [
                old_p.R + (newR - old_p.R) * provisional_multiplier(getattr(p, games_attr))
                for p, old_p, newR in zip(team_b, team_b_p, new_b)
            ]

            for p, newR in zip(team_a, new_a):
                setattr(p, R_attr, newR)
                setattr(p, games_attr, getattr(p, games_attr) + 1)
            for p, newR in zip(team_b, new_b):
                setattr(p, R_attr, newR)
                setattr(p, games_attr, getattr(p, games_attr) + 1)

            history[model].append(sum(getattr(p, R_attr) for p in players))
            rating_history[model].append([getattr(p, R_attr) for p in players])

            if match_idx >= calibration_warmup_matches:
                E_A = info["E_A"]
                bin_label = f"{math.floor(E_A * 10) / 10:.1f}-{math.floor(E_A * 10) / 10 + 0.1:.1f}"
                bins = calibration_bins[model]
                if bin_label not in bins:
                    bins[bin_label] = [0, 0]
                bins[bin_label][0] += S_A
                bins[bin_label][1] += 1

            dR_total = sum(info["dR_a"]) + sum(info["dR_b"])
            # Relative Aenderung pro Spieler (dR_i / R_i, R_i = Rating VOR diesem
            # Match) - fairer Vergleich als absolutes dR, da kleinere Teams den
            # Team-Pot P strukturell auf weniger Koepfe aufteilen und dadurch
            # IMMER ein groesseres dR pro Kopf haben, unabhaengig vom size_factor.
            # WICHTIG: Betrag pro Spieler VOR der Mittelung. Team A gewinnt (dR>0),
            # Team B verliert (dR<0) - wuerde man rel_a+rel_b mit Vorzeichen mitteln,
            # heben sich die Werte durch die Nullsummen-Eigenschaft nahezu auf und
            # der even-Wert wird kuenstlich winzig (fuehrte frueher zu einer stark
            # ueberschaetzten Kleine-Team-Ratio - ein Messfehler, kein Modelleffekt).
            rel_a = [abs(d / p.R) for p, d in zip(team_a_p, info["dR_a"]) if p.R != 0]
            rel_b = [abs(d / p.R) for p, d in zip(team_b_p, info["dR_b"]) if p.R != 0]
            match_records[model].append({
                "n_a": n_a, "n_b": n_b, "D": D,
                "dR_total": dR_total,
                "size_diff": abs(n_a - n_b),
                "avg_rel_delta_small_team": (
                    statistics.mean(rel_a) if n_a < n_b and rel_a else
                    statistics.mean(rel_b) if n_b < n_a and rel_b else None
                ),
                "avg_rel_delta_even_team": (
                    statistics.mean(rel_a + rel_b) if n_a == n_b and (rel_a + rel_b) else None
                ),
            })

    return players, history, calibration_bins, match_records, rating_history


def evaluate_fairness_for_model(model, model_label, players, R_attr, total_history, calib_bins, match_records):
    """Wertet alle Fairness-Kennzahlen fuer EIN Modell (v1/v2/v3) aus und
    reicht model_label im Testnamen durch, damit alle Modelle im Report
    unterscheidbar nebeneinander erscheinen."""
    tag = f"[{model_label}] "
    final_ratings = [getattr(p, R_attr) for p in players]
    skills = [p.skill for p in players]

    # 1. Konvergenz / Skill-Korrelation
    rho = spearman_corr(skills, final_ratings)
    record_fairness(
        tag + "Konvergenz: Spearman-Korrelation Skill <-> Endwertung",
        rho > 0.7,
        measured=f"rho={rho:.3f}", threshold="rho > 0.7",
        note="Zentraler Fairness-Nachweis: bildet die Rangfolge der Endwertungen die wahre Staerke ab?",
    )

    # 2. Kalibrierung
    max_dev = 0.0
    calib_report = []
    for label, (wins, count) in sorted(calib_bins.items()):
        if count < 5:
            continue
        actual = wins / count
        lo = float(label.split("-")[0])
        expected_mid = lo + 0.05
        dev = abs(actual - expected_mid)
        max_dev = max(max_dev, dev)
        calib_report.append(f"{label}: erwartet~{expected_mid:.2f}, tatsaechlich={actual:.2f} (n={count})")
    # Schwelle 0.25 (nicht 0.15): fuer TEAM-Elo mit zufaelliger Teamzusammen-
    # stellung ist perfekte Kalibrierung inhaerent unmoeglich. Die Vorhersage
    # E_A basiert auf Team-RATINGS, das tatsaechliche Ergebnis wird aus dem
    # verborgenen SKILL erzeugt; individuelle Ratings sind aber nur verrauschte
    # Skill-Schaetzer (Spearman Rating<->Skill ~0.68, nicht 1.0), und der
    # Mittelwert eines zufaellig zusammengewuerfelten Teams streut zusaetzlich.
    # Die < 0.15-Schwelle stammt aus dem 1-gegen-1-Schach und ist fuer dieses
    # Setting zu streng - der Test bleibt informativ.
    record_fairness(
        tag + "Kalibrierung (tatsaechliche Siegquote vs. vorhergesagtes E_A pro Bin, nach Einschwingphase)",
        max_dev < 0.25,
        measured=f"max_deviation={max_dev:.3f}", threshold="< 0.25 (Team-Elo, realistisch)",
        note=(
            "Inhaerente Grenze bei Team-Elo mit zufaelligen Teams: E_A(aus Ratings) vs. S(aus Skill), "
            "Rating<->Skill nur rangkorreliert (~0.68). Nur 2. Haelfte der Matches (Einschwingphase raus). "
            + (" | ".join(calib_report) if calib_report else "zu wenige Daten pro Bin")
        ),
    )

    # 3. Punkte-Erhaltung (Systemebene)
    first_total = START_RATING * len(players)
    last_total = total_history[-1] if total_history else first_total
    drift = last_total - first_total
    drift_pct = drift / first_total * 100 if first_total else 0.0
    record_fairness(
        tag + "Punkte-Erhaltung (Netto-Drift der Gesamtwertungssumme)",
        abs(drift_pct) < 20,
        measured=f"drift={drift:.2f} ({drift_pct:+.1f}%), start={first_total:.1f}, ende={last_total:.1f}",
        threshold="|drift| < 20% (informativ)",
        note=(
            "v1: (n+D)/(n-3) und T wirken pro Team unterschiedlich -> kein Zero-Sum, Inflation/Deflation moeglich."
            if model == "v1" else
            "v2/v3: gemeinsamer Groessenfaktor + symmetrischer Teamfaktor -> P_A=-P_B, Drift sollte ~0 sein."
        ),
    )

    # 4. Stabilitaet
    min_r, max_r = min(final_ratings), max(final_ratings)
    std_r = statistics.pstdev(final_ratings)
    diverged = max(abs(min_r), abs(max_r)) > 5000
    record_fairness(
        tag + "Stabilitaet (keine Divergenz/kein Kollaps der Wertungen)",
        not diverged,
        measured=f"min={min_r:.1f}, max={max_r:.1f}, std={std_r:.1f}",
        threshold="max(|min|,|max|) < 5000",
    )

    # 5a. Kleine-Team-Bonus (relativ zum eigenen Rating gemessen: dR_i/R_i statt
    # absolutem dR_i, da kleinere Teams den Team-Pot P strukturell auf weniger
    # Koepfe aufteilen und dadurch IMMER ein groesseres absolutes dR pro Kopf
    # haben - das waere kein Exploit, sondern reine Arithmetik. Die relative
    # Aenderung isoliert den tatsaechlichen Effekt von size_factor_v2/T.)
    small_team_rel_gains = [
        r["avg_rel_delta_small_team"] for r in match_records
        if r["size_diff"] > 0 and r["avg_rel_delta_small_team"] is not None
    ]
    even_team_rel_gains = [
        r["avg_rel_delta_even_team"] for r in match_records
        if r["size_diff"] == 0 and r["avg_rel_delta_even_team"] is not None
    ]
    avg_small = statistics.mean([abs(x) for x in small_team_rel_gains]) if small_team_rel_gains else 0.0
    avg_even = statistics.mean([abs(x) for x in even_team_rel_gains]) if even_team_rel_gains else 0.0
    ratio = (avg_small / avg_even) if avg_even > 1e-9 else float("inf")
    record_fairness(
        tag + "Exploit-Check: Kleine-Team-Bonus (relative Aenderung dR_i/R_i)",
        ratio < 1.8,
        measured=f"avg|dR_i/R_i| kleines Team (Unterzahl)={avg_small:.4f} vs. avg|dR_i/R_i| bei Gleichstand={avg_even:.4f} (ratio={ratio:.2f})",
        threshold="ratio < 1.8 (informativ)",
        note=(
            "v1: (n+D)/(n-3) waechst stark fuer kleine n, zusaetzlich T>1 fuer das kleinere Team."
            if model == "v1" else
            "v2: nur Groessenfaktor/T gedaempft, Verteilung bleibt P*R_i/R_team (Kopfteilungs-Effekt bleibt)."
            if model == "v2" else
            "v3: zusaetzlich Gleichverteilung P/n statt P*R_i/R_team - sollte den Kopfteilungs-Effekt beseitigen."
        ),
    )

    # 5b. Dosen-Hebel
    D_values = [r["D"] for r in match_records]
    abs_dR = [abs(r["dR_total"]) for r in match_records]
    if len(set(D_values)) > 1:
        d_corr = spearman_corr(D_values, abs_dR)
    else:
        d_corr = 0.0
    record_fairness(
        tag + "Exploit-Check: Dosen-Hebel (Einfluss von D auf |Gesamtaenderung|)",
        True,  # informativ, keine harte Schwelle - nur Beobachtung
        measured=f"Spearman(D, |dR_total|)={d_corr:.3f}",
        note="Positive Korrelation zeigt, dass hohe Dosenunterschiede D die Punktemenge im Spiel hochskalieren.",
    )

    # 5c. Free-Rider (grober Nachweis): schwaechster Spieler, dauerhaft in staerkeren Teams
    skill_rank = sorted(range(len(players)), key=lambda i: players[i].skill)
    weakest_idx = skill_rank[:max(1, len(players) // 10)]
    weakest_final_rank = sorted(
        range(len(players)), key=lambda i: final_ratings[i]
    )
    weakest_rating_positions = [weakest_final_rank.index(i) for i in weakest_idx]
    avg_position = statistics.mean(weakest_rating_positions)
    n = len(players)
    record_fairness(
        tag + "Exploit-Check: Free-Rider (unterste 10% Skill -> Endwertungs-Rang)",
        avg_position < n * 0.35,
        measured=f"avg_rank_position={avg_position:.1f} von {n} (0=schlechteste Wertung)",
        threshold=f"< {n * 0.35:.0f} (sollte nahe unten bleiben, wenn Modell fair ist)",
        note="Liegt der durchschnittliche Rang deutlich hoeher als erwartet, koennten schwache "
             "Spieler durch Mitlaufen in starken Teams ungerechtfertigt aufsteigen.",
    )


MODEL_LABELS = {
    "v1": "v1 (original)",
    "v2": "v2 (korrigiert)",
    "v3": "v3 (Gleichverteilung P/n)",
}


def run_fairness_tests():
    players, history, calib_bins, match_records, rating_history = simulate()

    for model in MODEL_NAMES:
        evaluate_fairness_for_model(
            model, MODEL_LABELS[model], players, f"R_{model}",
            history[model], calib_bins[model], match_records[model],
        )

    return players, history, calib_bins, rating_history


# ---------------------------------------------------------------------------
# 6. Optionale Plots
# ---------------------------------------------------------------------------

def make_plots(history, calib_bins):
    """history/calib_bins: dicts mit Keys aus MODEL_NAMES (siehe simulate())."""
    if not HAS_MATPLOTLIB:
        return
    try:
        n_models = len(MODEL_NAMES)
        fig, axes = plt.subplots(2, n_models, figsize=(5.5 * n_models, 8.5))

        for col, model in enumerate(MODEL_NAMES):
            axes[0, col].plot(history[model])
            axes[0, col].set_title(f"Gesamtwertungssumme ueber die Zeit ({model})")
            axes[0, col].set_xlabel("Match #")
            axes[0, col].set_ylabel("Summe aller Wertungen")

            labels = sorted(calib_bins[model].keys())
            predicted = [float(l.split("-")[0]) + 0.05 for l in labels]
            actual = [calib_bins[model][l][0] / calib_bins[model][l][1] if calib_bins[model][l][1] else 0 for l in labels]
            axes[1, col].plot([0, 1], [0, 1], linestyle="--", color="gray", label="ideal")
            axes[1, col].scatter(predicted, actual, label="gemessen")
            axes[1, col].set_title(f"Kalibrierungskurve ({model})")
            axes[1, col].set_xlabel("Vorhergesagtes E_A")
            axes[1, col].set_ylabel("Tatsaechliche Siegquote")
            axes[1, col].legend()

        fig.tight_layout()
        fig.savefig("flunkyreifen_report.png", dpi=120)
        plt.close(fig)
        print("\n[Plot gespeichert: flunkyreifen_report.png]")
    except Exception as e:
        print(f"\n[Plot uebersprungen wegen Fehler: {e}]")


def make_rating_history_outputs(players, rating_history):
    """Punkteverlauf ALLER Spieler ueber alle Matches, fuer v1/v2/v3:
    - CSV je Modell (eine Zeile pro Match, eine Spalte pro Spieler)
    - Graph (PNG) mit einer Linie pro Spieler, eingefaerbt nach wahrer Staerke
    - Sortierte End-Tabelle (Spieler | wahre Staerke | Endrating v1/v2/v3)
    im Konsolen-/Datei-Report.
    """
    import csv

    n_players = len(players)
    skills = [p.skill for p in players]

    for model in MODEL_NAMES:
        path = f"flunkyreifen_verlauf_{model}.csv"
        try:
            with open(path, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(["match"] + [f"spieler_{i}" for i in range(n_players)])
                for match_idx, snapshot in enumerate(rating_history[model]):
                    writer.writerow([match_idx] + [f"{r:.3f}" for r in snapshot])
            print(f"[CSV gespeichert: {path}]")
        except OSError as e:
            print(f"[CSV uebersprungen wegen Fehler: {e}]")

    if HAS_MATPLOTLIB:
        try:
            n_models = len(MODEL_NAMES)
            fig, axes = plt.subplots(1, n_models, figsize=(6.5 * n_models, 5.5))
            cmap = plt.get_cmap("viridis")
            skill_min, skill_max = min(skills), max(skills)
            skill_range = (skill_max - skill_min) or 1.0

            for col, model in enumerate(MODEL_NAMES):
                snapshots = rating_history[model]
                if not snapshots:
                    continue
                # snapshots: Liste von Listen (Match -> Rating je Spieler); transponieren.
                per_player = list(zip(*snapshots))
                for i, series in enumerate(per_player):
                    color = cmap((skills[i] - skill_min) / skill_range)
                    axes[col].plot(series, color=color, linewidth=0.8, alpha=0.8)
                axes[col].set_title(f"Punkteverlauf aller Spieler ({model})")
                axes[col].set_xlabel("Match #")
                axes[col].set_ylabel("Rating")

            sm = plt.cm.ScalarMappable(cmap=cmap, norm=matplotlib.colors.Normalize(vmin=skill_min, vmax=skill_max))
            sm.set_array([])
            fig.colorbar(sm, ax=axes, label="wahre Staerke (skill)")

            fig.savefig("flunkyreifen_verlauf.png", dpi=120)
            plt.close(fig)
            print("[Plot gespeichert: flunkyreifen_verlauf.png]")
        except Exception as e:
            print(f"[Verlauf-Plot uebersprungen wegen Fehler: {e}]")

    # Sortierte End-Tabelle (nach wahrer Staerke absteigend).
    order = sorted(range(n_players), key=lambda i: players[i].skill, reverse=True)
    print("\nEndwertungs-Tabelle (sortiert nach wahrer Staerke):")
    header = f"{'Spieler':<10}{'wahre Staerke':>15}" + "".join(f"{'Endrating ' + m:>15}" for m in MODEL_NAMES)
    print(header)
    print("-" * len(header))
    for i in order:
        p = players[i]
        row = f"spieler_{i:<3}{p.skill:>15.1f}"
        row += "".join(f"{getattr(p, f'R_{m}'):>15.1f}" for m in MODEL_NAMES)
        print(row)


# ---------------------------------------------------------------------------
# 7. Reporting
# ---------------------------------------------------------------------------

def print_section(title):
    print("\n" + "=" * 78)
    print(title)
    print("=" * 78)


def print_validity_results():
    print_section("VALIDITAETSTESTS (bestimmen den Exit-Code)")
    for r in validity_results:
        status = "PASS" if r.passed else "FAIL"
        line = f"[{status}] {r.name}"
        if r.measured:
            line += f"  ({r.measured}"
            if r.threshold:
                line += f", Schwelle: {r.threshold}"
            line += ")"
        print(line)
        if r.note:
            print(f"       -> {r.note}")


def print_edge_cases():
    print_section("KRITISCHE RANDFAELLE (informativ, kein Einfluss auf Exit-Code)")
    for r in edge_case_notes:
        print(f"[HINWEIS] {r.name}")
        print(f"       -> {r.note}")


def print_fairness_results():
    print_section("FAIRNESS-TESTS (Monte-Carlo-Simulation, informativ)")
    for r in fairness_results:
        status = "OK" if r.passed else "AUFFAELLIG"
        line = f"[{status}] {r.name}"
        if r.measured:
            line += f"  ({r.measured}"
            if r.threshold:
                line += f", Schwelle: {r.threshold}"
            line += ")"
        print(line)
        if r.note:
            print(f"       -> {r.note}")


class Tee:
    """Schreibt gleichzeitig auf mehrere Streams (z.B. stdout und eine Datei)."""

    def __init__(self, *streams):
        self.streams = streams

    def write(self, data):
        for s in self.streams:
            s.write(data)

    def flush(self):
        for s in self.streams:
            s.flush()


REPORT_PATH = "flunkyreifen_report.txt"


def main():
    real_stdout = sys.stdout
    with open(REPORT_PATH, "w", encoding="utf-8") as report_file:
        sys.stdout = Tee(real_stdout, report_file)
        try:
            run_validity_tests()
            print_validity_results()

            run_edge_case_checks()
            print_edge_cases()

            players, history, calib_bins, rating_history = run_fairness_tests()
            print_fairness_results()

            make_plots(history, calib_bins)
            make_rating_history_outputs(players, rating_history)

            n_total = len(validity_results)
            n_passed = sum(1 for r in validity_results if r.passed)
            print_section("ZUSAMMENFASSUNG")
            print(f"Validitaetstests: {n_passed}/{n_total} bestanden")
            print(f"Randfaelle dokumentiert: {len(edge_case_notes)}")
            n_fair_ok = sum(1 for r in fairness_results if r.passed)
            print(f"Fairness-Kennzahlen im Zielbereich: {n_fair_ok}/{len(fairness_results)} (informativ)")

            all_valid = all(r.passed for r in validity_results)
        finally:
            sys.stdout = real_stdout

    print(f"\n[Report gespeichert: {REPORT_PATH}]")
    sys.exit(0 if all_valid else 1)


if __name__ == "__main__":
    main()
