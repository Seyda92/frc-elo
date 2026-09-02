/**
 * v3-Elo-Wertung für Flunkyreifen — Portierung von `play_match_v3`
 * aus `ELO-Code/flunkyreifen_test.py` (Referenzimplementierung).
 *
 * Modelleigenschaften (siehe ELO-Code/FORMELN.md):
 * - nullsummen-neutral: P_A = −P_B, keine Punkte-Inflation
 * - Gleichverteilung P/n auf die Spieler (nicht anteilig nach Rating)
 * - gedämpfter Teamfaktor, kein Pol bei kleinen Teamgrößen
 *
 * Bewusst ohne DB-Zugriff: alle Modellparameter kommen als Argument herein
 * (siehe `getEloParams()` in src/db/queries.ts), damit die Berechnung rein
 * und testbar bleibt.
 */

/** Elo-Konstanten ohne Entsprechung in `rating_model` — in der Referenz hartcodiert. */
const ELO_DIVISOR = 400;
const ELO_BASE = 10;
/** Begrenzt den Exponenten gegen Overflow; mathematisch ohne messbaren Effekt. */
const EXPONENT_CLAMP = 300;

export type EloParams = {
  /** c in (n+D)/(n+c) — aus `rating_model.size_factor_offset` (7.0) */
  sizeFactorOffset: number;
  /** aus `rating_model.provisional_games` (15) */
  provisionalGames: number;
  /** aus `rating_model.provisional_k_boost` (3.0) */
  provisionalKBoost: number;
  /** size_diff -> factor, aus `team_factor`. Differenzen oberhalb des größten
   *  vorhandenen Eintrags werden auf diesen gedeckelt (Referenz deckelt bei 5). */
  teamFactors: Map<number, number>;
};

export type EloPlayerInput = {
  playerId: number;
  /** R_i vor diesem Match */
  rating: number;
  /** g_i: Anzahl Matches VOR diesem, über alle Turniere gezählt */
  gamesPlayed: number;
};

export type EloPlayerResult = {
  playerId: number;
  ratingBefore: number;
  /** bereits inklusive Provisional-Faktor */
  delta: number;
  ratingAfter: number;
  /** g_i vor diesem Match — so, wie es in `rating_history` gehört */
  gamesPlayed: number;
};

export type EloMatchResult = {
  players: EloPlayerResult[];
  /** Zwischenwerte zur Nachvollziehbarkeit/Debugging */
  info: {
    expectedA: number;
    expectedB: number;
    teamDeltaA: number;
    teamDeltaB: number;
    teamFactor: number;
    sizeFactor: number;
  };
};

/** E_A = 1 / (1 + 10^((R_B − R_A)/400)), Exponent auf ±300 begrenzt. */
export function expectedScore(ratingSumSelf: number, ratingSumOpponent: number): number {
  const rawExponent = (ratingSumOpponent - ratingSumSelf) / ELO_DIVISOR;
  const exponent = Math.max(-EXPONENT_CLAMP, Math.min(EXPONENT_CLAMP, rawExponent));
  return 1 / (1 + ELO_BASE ** exponent);
}

/**
 * Teamfaktor T. Gleich große Teams: 1.0. Sonst Nachschlag über die
 * Größendifferenz, gedeckelt auf den größten vorhandenen Eintrag.
 */
export function teamFactor(
  sizeA: number,
  sizeB: number,
  teamFactors: Map<number, number>,
): number {
  const diff = Math.abs(sizeA - sizeB);
  if (diff === 0) return 1;
  if (teamFactors.size === 0) {
    throw new Error("teamFactors ist leer — Tabelle team_factor nicht geseedet?");
  }
  const maxDiff = Math.max(...teamFactors.keys());
  return teamFactors.get(Math.min(diff, maxDiff))!;
}

/** sf(n, D) = (n + D) / (n + c) — kein Pol, da c > 0. */
export function sizeFactor(avgTeamSize: number, canDiff: number, offset: number): number {
  return (avgTeamSize + canDiff) / (avgTeamSize + offset);
}

/**
 * Provisional-Boost: neue Spieler bewegen sich schneller.
 * m(g) = boost − (boost − 1)·(g/games) für g < games, sonst 1.
 */
export function provisionalMultiplier(
  gamesPlayed: number,
  provisionalGames: number,
  provisionalKBoost: number,
): number {
  if (gamesPlayed >= provisionalGames) return 1;
  const progress = gamesPlayed / provisionalGames;
  return provisionalKBoost - (provisionalKBoost - 1) * progress;
}

/**
 * Berechnet die Rating-Änderungen aller Spieler eines Matches.
 *
 * @param scoreA Ergebnis aus Sicht von Team A: 1 = Sieg, 0 = Niederlage.
 *   (0.5 wäre ein Remis; die Formel trägt es, das Schema lässt es per
 *   CHECK aktuell nicht zu.)
 * @param canDiff D, Dosenunterschied ≥ 0
 */
export function computeMatchDeltas(
  teamA: EloPlayerInput[],
  teamB: EloPlayerInput[],
  k: number,
  canDiff: number,
  scoreA: number,
  params: EloParams,
): EloMatchResult {
  const sizeA = teamA.length;
  const sizeB = teamB.length;
  if (sizeA === 0 || sizeB === 0) {
    // Die Referenz hat hier keinen Guard und würde durch 0 teilen.
    throw new Error("Beide Teams brauchen mindestens einen Spieler");
  }

  // WICHTIG: Summen der Team-Ratings, nicht Mittelwerte (so die Referenz).
  const ratingSumA = teamA.reduce((sum, p) => sum + p.rating, 0);
  const ratingSumB = teamB.reduce((sum, p) => sum + p.rating, 0);

  const scoreB = 1 - scoreA;
  const expectedA = expectedScore(ratingSumA, ratingSumB);
  const expectedB = expectedScore(ratingSumB, ratingSumA);

  // Ein gemeinsamer Teamfaktor und ein gemeinsamer, aus beiden Teamgrößen
  // gemittelter Größenfaktor — daraus folgt die Nullsummigkeit.
  const factorT = teamFactor(sizeA, sizeB, params.teamFactors);
  const avgSize = (sizeA + sizeB) / 2;
  const factorSize = sizeFactor(avgSize, canDiff, params.sizeFactorOffset);
  const sharedFactor = factorSize * factorT;

  const teamDeltaA = k * sharedFactor * (scoreA - expectedA);
  const teamDeltaB = k * sharedFactor * (scoreB - expectedB);

  // Verteilung: P/n gleichmäßig. Der Teamfaktor steckt bereits in P und darf
  // hier NICHT erneut multipliziert werden. Das Bonusbier wirkt bewusst nicht
  // mehr auf die Wertung (Entscheidung 09/2026): es wird weiterhin erfasst und
  // angezeigt, geht aber nicht in die Rechnung ein.
  const distribute = (team: EloPlayerInput[], teamDelta: number): EloPlayerResult[] =>
    team.map((player) => {
      const rawDelta = teamDelta / team.length;
      // Der Provisional-Faktor wirkt pro Spieler NACH der Verteilung. Dadurch
      // ist die Summe der finalen Deltas i. d. R. ungleich 0, obwohl
      // teamDeltaA = −teamDeltaB gilt. Das ist Referenzverhalten.
      const delta =
        rawDelta *
        provisionalMultiplier(
          player.gamesPlayed,
          params.provisionalGames,
          params.provisionalKBoost,
        );
      return {
        playerId: player.playerId,
        ratingBefore: player.rating,
        delta,
        ratingAfter: player.rating + delta,
        gamesPlayed: player.gamesPlayed,
      };
    });

  return {
    players: [...distribute(teamA, teamDeltaA), ...distribute(teamB, teamDeltaB)],
    info: {
      expectedA,
      expectedB,
      teamDeltaA,
      teamDeltaB,
      teamFactor: factorT,
      sizeFactor: factorSize,
    },
  };
}
