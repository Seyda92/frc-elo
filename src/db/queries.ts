import { and, asc, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { db } from "./client.ts";
import {
  appUser,
  club,
  event,
  match,
  matchParticipation,
  matchPlannedRoster,
  matchReferee,
  matchRpsDraw,
  matchTeam,
  player,
  playerRatingCurrent,
  ratingModel,
  ratingHistory,
  teamFactor,
} from "./generated/schema.ts";
import {
  initials,
  sortLeaderboard,
  type EloPoint,
  type LeaderboardSortKey,
  type SortDirection,
} from "@/lib/format";
import type { EloParams } from "@/lib/elo";
import type { Role } from "@/lib/session";
import { FALLBACK_RATING, V3_MODEL_ID } from "./model.ts";
import type {
  Club,
  EventSummary,
  MatchDetail,
  MatchListItem,
  MatchPlayerStat,
  MatchSummary,
  Player,
  TeamMember,
} from "./types";

function toDateOnlyString(value: string | Date | null): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return value;
}

function deriveEventStatus(
  startsOn: string | null,
  endsOn: string | null,
): "upcoming" | "ongoing" | "past" {
  if (!startsOn) return "upcoming";
  const end = endsOn ?? startsOn;
  const today = new Date().toISOString().slice(0, 10);
  if (end < today) return "past";
  if (startsOn <= today) return "ongoing";
  return "upcoming";
}

export async function getPrimaryClub(): Promise<Club | undefined> {
  const [row] = await db.select().from(club).orderBy(asc(club.clubId)).limit(1);
  if (!row) return undefined;
  return { id: String(row.clubId), name: row.name, location: row.city ?? row.name };
}

export async function getClubs(): Promise<Club[]> {
  const rows = await db.select().from(club).orderBy(asc(club.name));
  return rows.map((row) => ({
    id: String(row.clubId),
    name: row.name,
    location: row.city ?? "",
  }));
}

export type AppUser = {
  userId: number;
  username: string;
  role: Role;
  isActive: boolean;
  playerId: number | null;
  playerName: string | null;
};

/** Für /admin/schiris — alle Konten, unabhängig von Rolle/Status. */
export async function getAppUsers(): Promise<AppUser[]> {
  const rows = await db
    .select({
      userId: appUser.userId,
      username: appUser.username,
      role: appUser.role,
      isActive: appUser.isActive,
      playerId: appUser.playerId,
      playerName: player.displayName,
    })
    .from(appUser)
    .leftJoin(player, eq(player.playerId, appUser.playerId))
    .orderBy(asc(appUser.username));

  return rows.map((row) => ({
    userId: row.userId,
    username: row.username,
    role: row.role as Role,
    isActive: row.isActive === 1,
    playerId: row.playerId,
    playerName: row.playerName,
  }));
}

export async function getAllPlayers(): Promise<
  { id: string; name: string; alias: string | null; number: number | null; clubName: string }[]
> {
  const rows = await db
    .select({
      playerId: player.playerId,
      name: player.displayName,
      alias: player.alias,
      number: player.jerseyNumber,
      clubName: club.name,
    })
    .from(player)
    .leftJoin(club, eq(club.clubId, player.clubId))
    .orderBy(asc(player.displayName));

  return rows.map((row) => ({
    id: String(row.playerId),
    name: row.name,
    alias: row.alias,
    number: row.number,
    clubName: row.clubName ?? "—",
  }));
}

export async function getAllEvents(): Promise<EventSummary[]> {
  const rows = await db
    .select({
      eventId: event.eventId,
      name: event.name,
      location: event.location,
      startsOn: event.startsOn,
      endsOn: event.endsOn,
      clubName: club.name,
      clubCity: club.city,
    })
    .from(event)
    .leftJoin(club, eq(club.clubId, event.clubId))
    .orderBy(desc(event.startsOn));

  return rows.map((row) => {
    const startsAt = toDateOnlyString(row.startsOn);
    const endsAt = toDateOnlyString(row.endsOn);
    return {
      id: String(row.eventId),
      name: row.name,
      // Eigener Event-Ort hat Vorrang vor dem abgeleiteten Vereinsort
      // (D23) — nur wenn keiner gesetzt ist, greift der alte Fallback.
      location: row.location ?? row.clubCity ?? row.clubName ?? "",
      startsAt,
      endsAt,
      status: deriveEventStatus(startsAt, endsAt),
    } satisfies EventSummary;
  });
}

/** Startwertung für neu angelegte Spieler (aus `rating_model`). */
export async function getStartRating(): Promise<number> {
  const [row] = await db
    .select({ startRating: ratingModel.startRating })
    .from(ratingModel)
    .where(eq(ratingModel.modelId, V3_MODEL_ID));
  return row ? Number(row.startRating) : FALLBACK_RATING;
}

/** Modellparameter für die v3-Berechnung in `src/lib/elo.ts`. */
export async function getEloParams(): Promise<EloParams> {
  const [model] = await db
    .select()
    .from(ratingModel)
    .where(eq(ratingModel.modelId, V3_MODEL_ID));
  if (!model) throw new Error(`rating_model mit model_id ${V3_MODEL_ID} fehlt`);

  const factors = await db
    .select({ sizeDiff: teamFactor.sizeDiff, factor: teamFactor.factor })
    .from(teamFactor)
    .where(eq(teamFactor.modelId, V3_MODEL_ID));

  return {
    sizeFactorOffset: Number(model.sizeFactorOffset),
    provisionalGames: model.provisionalGames,
    provisionalKBoost: Number(model.provisionalKBoost),
    teamFactors: new Map(factors.map((f) => [f.sizeDiff, Number(f.factor)])),
  };
}

export type MatchEntryPlayer = {
  /** number, nicht string — geht direkt in EloPlayerInput/validateMatchInput */
  playerId: number;
  name: string;
  alias: string | null;
  jerseyNumber: number | null;
  clubName: string;
  /** Nur für die Anzeige im Formular — die Action liest die maßgeblichen
   *  Werte innerhalb der Transaktion neu (siehe scoreMatch). */
  rating: number;
  gamesPlayed: number;
  /** Zwischenstand aus match_planned_roster, nur von getLiveMatch()
   *  befüllt (siehe saveLiveStats in actions.ts) — bei anderen Aufrufern
   *  (Anlegen-Formular, Bewerten-Seite mit eigenem State) undefined. */
  liveThrows?: number;
  liveHits?: number;
  liveBonusBeer?: number;
};

/** Aktive Spieler für die Match-Erfassung, inkl. aktueller Wertung. */
export async function getPlayersForMatchEntry(): Promise<MatchEntryPlayer[]> {
  const rows = await db
    .select({
      playerId: player.playerId,
      name: player.displayName,
      alias: player.alias,
      jerseyNumber: player.jerseyNumber,
      clubName: club.name,
      rating: playerRatingCurrent.rating,
      gamesPlayed: playerRatingCurrent.gamesPlayed,
    })
    .from(player)
    .leftJoin(club, eq(club.clubId, player.clubId))
    .leftJoin(
      playerRatingCurrent,
      and(
        eq(playerRatingCurrent.playerId, player.playerId),
        eq(playerRatingCurrent.modelId, V3_MODEL_ID),
      ),
    )
    .where(eq(player.isActive, 1))
    .orderBy(asc(player.displayName));

  return rows.map((row) => ({
    playerId: row.playerId,
    name: row.name,
    alias: row.alias,
    jerseyNumber: row.jerseyNumber,
    clubName: row.clubName ?? "—",
    rating: row.rating != null ? Math.round(Number(row.rating)) : FALLBACK_RATING,
    gamesPlayed: row.gamesPlayed ?? 0,
  }));
}

/** player_ids aktiver Konten mit Rolle admin/owner, die mit einem Spieler
 *  verknüpft sind — für die Schiri-Auswahl beim Match-Anlegen. selectDistinct,
 *  weil player_id keine UNIQUE-Constraint hat (zwei Konten könnten theoretisch
 *  denselben Spieler verlinken). */
export async function getRefereePlayerIds(): Promise<number[]> {
  const rows = await db
    .selectDistinct({ playerId: appUser.playerId })
    .from(appUser)
    .where(
      and(
        sql`${appUser.playerId} is not null`,
        eq(appUser.isActive, 1),
        inArray(appUser.role, ["admin", "owner"]),
      ),
    );

  return rows.map((row) => row.playerId).filter((id): id is number => id != null);
}

export type PlannedMatchDetail = {
  matchId: number;
  eventId: number | null;
  eventName: string | null;
  playedAt: string;
  kFactor: number;
  canDiff: number;
  note: string | null;
  teamAName: string;
  teamBName: string;
  refereeName: string | null;
  teamA: MatchEntryPlayer[];
  teamB: MatchEntryPlayer[];
};

/** Match + Kader eines geplanten, noch nicht bewerteten Matches — für die
 *  Bewerten-Seite. undefined, wenn es das Match nicht gibt oder es bereits
 *  bewertet wurde (keine match_planned_roster-Zeilen mehr). */
export async function getPlannedMatchDetail(matchId: number): Promise<PlannedMatchDetail | undefined> {
  const [row] = await db
    .select({
      matchId: match.matchId,
      eventId: match.eventId,
      eventName: event.name,
      playedAt: match.playedAt,
      kFactor: match.kFactor,
      canDiff: match.canDiff,
      note: match.note,
      teamAName: match.teamAName,
      teamBName: match.teamBName,
    })
    .from(match)
    .leftJoin(event, eq(event.eventId, match.eventId))
    .where(eq(match.matchId, matchId));

  if (!row) return undefined;

  const rosterRows = await db
    .select({
      playerId: matchPlannedRoster.playerId,
      side: matchPlannedRoster.side,
      throws: matchPlannedRoster.throws,
      hits: matchPlannedRoster.hits,
      bonusBeer: matchPlannedRoster.bonusBeer,
      name: player.displayName,
      alias: player.alias,
      jerseyNumber: player.jerseyNumber,
      clubName: club.name,
      rating: playerRatingCurrent.rating,
      gamesPlayed: playerRatingCurrent.gamesPlayed,
    })
    .from(matchPlannedRoster)
    .innerJoin(player, eq(player.playerId, matchPlannedRoster.playerId))
    .leftJoin(club, eq(club.clubId, player.clubId))
    .leftJoin(
      playerRatingCurrent,
      and(
        eq(playerRatingCurrent.playerId, matchPlannedRoster.playerId),
        eq(playerRatingCurrent.modelId, V3_MODEL_ID),
      ),
    )
    .where(eq(matchPlannedRoster.matchId, matchId))
    .orderBy(asc(player.displayName));

  if (rosterRows.length === 0) return undefined;

  const toEntryPlayer = (r: (typeof rosterRows)[number]): MatchEntryPlayer => ({
    playerId: r.playerId,
    name: r.name,
    alias: r.alias,
    jerseyNumber: r.jerseyNumber,
    clubName: r.clubName ?? "—",
    rating: r.rating != null ? Math.round(Number(r.rating)) : FALLBACK_RATING,
    gamesPlayed: r.gamesPlayed ?? 0,
    liveThrows: r.throws,
    liveHits: r.hits,
    liveBonusBeer: r.bonusBeer,
  });

  const [refereeRow] = await db
    .select({ name: player.displayName })
    .from(matchReferee)
    .innerJoin(player, eq(player.playerId, matchReferee.playerId))
    .where(eq(matchReferee.matchId, matchId));

  return {
    matchId: row.matchId,
    eventId: row.eventId,
    eventName: row.eventName,
    playedAt: new Date(row.playedAt).toISOString(),
    kFactor: row.kFactor,
    canDiff: row.canDiff,
    note: row.note,
    teamAName: row.teamAName ?? "Team A",
    teamBName: row.teamBName ?? "Team B",
    refereeName: refereeRow?.name ?? null,
    teamA: rosterRows.filter((r) => r.side === "A").map(toEntryPlayer),
    teamB: rosterRows.filter((r) => r.side === "B").map(toEntryPlayer),
  };
}

export type MatchScoringContext = {
  matchId: number;
  eventName: string | null;
  playedAt: string;
  refereeName: string | null;
  teamAName: string;
  teamBName: string;
  /** Leer, wenn das Match bereits bewertet wurde (match_planned_roster
   *  ist dann geleert) — im Unterschied zu getPlannedMatchDetail liefert
   *  diese Funktion trotzdem die Match-Metadaten statt undefined. Siehe
   *  Kommentar in der Bewerten-Seite: das Formular braucht über einen
   *  Next.js-Refresh nach dem Speichern hinweg stabile Props, sonst geht
   *  sein lokaler State (Erfolgs-Block) verloren. */
  teamA: MatchEntryPlayer[];
  teamB: MatchEntryPlayer[];
};

/** Wie getPlannedMatchDetail, aber undefined nur wenn das Match selbst
 *  nicht existiert — nicht, wenn es bereits bewertet wurde. Nur für die
 *  Bewerten-Seite gedacht (siehe MatchScoringContext-Kommentar). */
export async function getMatchScoringContext(
  matchId: number,
): Promise<MatchScoringContext | undefined> {
  const [row] = await db
    .select({
      matchId: match.matchId,
      eventName: event.name,
      playedAt: match.playedAt,
      teamAName: match.teamAName,
      teamBName: match.teamBName,
    })
    .from(match)
    .leftJoin(event, eq(event.eventId, match.eventId))
    .where(eq(match.matchId, matchId));

  if (!row) return undefined;

  const rosterRows = await db
    .select({
      playerId: matchPlannedRoster.playerId,
      side: matchPlannedRoster.side,
      throws: matchPlannedRoster.throws,
      hits: matchPlannedRoster.hits,
      bonusBeer: matchPlannedRoster.bonusBeer,
      name: player.displayName,
      alias: player.alias,
      jerseyNumber: player.jerseyNumber,
      clubName: club.name,
      rating: playerRatingCurrent.rating,
      gamesPlayed: playerRatingCurrent.gamesPlayed,
    })
    .from(matchPlannedRoster)
    .innerJoin(player, eq(player.playerId, matchPlannedRoster.playerId))
    .leftJoin(club, eq(club.clubId, player.clubId))
    .leftJoin(
      playerRatingCurrent,
      and(
        eq(playerRatingCurrent.playerId, matchPlannedRoster.playerId),
        eq(playerRatingCurrent.modelId, V3_MODEL_ID),
      ),
    )
    .where(eq(matchPlannedRoster.matchId, matchId))
    .orderBy(asc(player.displayName));

  const toEntryPlayer = (r: (typeof rosterRows)[number]): MatchEntryPlayer => ({
    playerId: r.playerId,
    name: r.name,
    alias: r.alias,
    jerseyNumber: r.jerseyNumber,
    clubName: r.clubName ?? "—",
    rating: r.rating != null ? Math.round(Number(r.rating)) : FALLBACK_RATING,
    gamesPlayed: r.gamesPlayed ?? 0,
    liveThrows: r.throws,
    liveHits: r.hits,
    liveBonusBeer: r.bonusBeer,
  });

  const [refereeRow] = await db
    .select({ name: player.displayName })
    .from(matchReferee)
    .innerJoin(player, eq(player.playerId, matchReferee.playerId))
    .where(eq(matchReferee.matchId, matchId));

  return {
    matchId: row.matchId,
    eventName: row.eventName,
    playedAt: new Date(row.playedAt).toISOString(),
    refereeName: refereeRow?.name ?? null,
    teamAName: row.teamAName ?? "Team A",
    teamBName: row.teamBName ?? "Team B",
    teamA: rosterRows.filter((r) => r.side === "A").map(toEntryPlayer),
    teamB: rosterRows.filter((r) => r.side === "B").map(toEntryPlayer),
  };
}

/** Markiert ein geplantes Match als "live gestartet" - aufgerufen beim
 *  Aufruf der Bewerten-Seite. Idempotent (WHERE started_at IS NULL): ein
 *  Reload oder ein zweiter Aufruf aendert den einmal gesetzten Zeitpunkt
 *  nicht mehr. "Live" selbst ist kein gespeichertes Feld, sondern wird aus
 *  started_at IS NOT NULL + keine match_team-Zeilen (noch nicht bewertet)
 *  abgeleitet, siehe getLiveMatch(). */
export async function markMatchStarted(matchId: number): Promise<void> {
  await db
    .update(match)
    .set({ startedAt: sql`now()` })
    .where(and(eq(match.matchId, matchId), sql`${match.startedAt} is null`));
}

/** Das eine aktuell laufende Match (started_at gesetzt, noch nicht
 *  bewertet) - Annahme: nur ein Match gleichzeitig live. undefined, wenn
 *  keins laeuft. */
export async function getLiveMatch(): Promise<PlannedMatchDetail | undefined> {
  const [row] = await db
    .select({ matchId: match.matchId })
    .from(match)
    .where(
      and(
        sql`${match.startedAt} is not null`,
        sql`EXISTS (SELECT 1 FROM ${matchPlannedRoster} WHERE ${matchPlannedRoster.matchId} = ${match.matchId})`,
      ),
    )
    .orderBy(desc(match.startedAt))
    .limit(1);
  if (!row) return undefined;
  return getPlannedMatchDetail(row.matchId);
}

export async function getMatchCount(): Promise<number> {
  const [row] = await db.select({ count: sql<string>`count(*)` }).from(match);
  return row ? Number(row.count) : 0;
}

export async function getLeaderboard(
  clubId: number,
  sortBy: LeaderboardSortKey = "elo",
  direction: SortDirection = "desc",
): Promise<Player[]> {
  const base = await db
    .select({
      playerId: player.playerId,
      name: player.displayName,
      alias: player.alias,
      number: player.jerseyNumber,
      clubId: player.clubId,
      rating: playerRatingCurrent.rating,
      gamesPlayed: playerRatingCurrent.gamesPlayed,
      wins: playerRatingCurrent.wins,
      losses: playerRatingCurrent.losses,
    })
    .from(player)
    .leftJoin(
      playerRatingCurrent,
      and(
        eq(playerRatingCurrent.playerId, player.playerId),
        eq(playerRatingCurrent.modelId, V3_MODEL_ID),
      ),
    )
    .where(and(eq(player.clubId, clubId), eq(player.isActive, 1)));

  const statRows = await db
    .select({
      playerId: matchParticipation.playerId,
      throws: sql<string>`coalesce(sum(${matchParticipation.throws}), 0)`,
      hits: sql<string>`coalesce(sum(${matchParticipation.hits}), 0)`,
      bonusBeer: sql<string>`coalesce(sum(${matchParticipation.bonusBeer}), 0)`,
    })
    .from(matchParticipation)
    .groupBy(matchParticipation.playerId);

  const statsByPlayer = new Map(statRows.map((s) => [s.playerId, s]));

  const rpsRows = await db
    .select({
      playerId: matchRpsDraw.playerId,
      ehrensteine: sql<string>`coalesce(sum(${matchRpsDraw.ehrensteinCount}), 0)`,
      antritte: sql<string>`count(*)`,
    })
    .from(matchRpsDraw)
    .groupBy(matchRpsDraw.playerId);

  const rpsByPlayer = new Map(rpsRows.map((r) => [r.playerId, r]));

  // Letzter rating_history-Eintrag je Spieler (DISTINCT ON, sortiert nach
  // played_at) liefert ratingBefore/delta des jeweils letzten Spiels — die
  // Basis für Rangdelta und Elo-Delta in der Leaderboard-Zeile. Getrennt
  // von playerRatingCurrent, das nur den aktuellen Stand kennt, nicht den
  // Stand davor.
  const lastMatchRows = await db.execute<{
    player_id: number;
    rating_before: string;
    delta: string;
  }>(sql`
    select distinct on (rh.player_id) rh.player_id, rh.rating_before, rh.delta
    from ${ratingHistory} rh
    inner join ${match} m on m.match_id = rh.match_id
    where rh.model_id = ${V3_MODEL_ID}
    order by rh.player_id, m.played_at desc, rh.history_id desc
  `);
  const lastMatchByPlayer = new Map(
    lastMatchRows.rows.map((r) => [r.player_id, r]),
  );

  type PlayerWithPreviousRating = Omit<Player, "rankDelta"> & {
    _ratingBeforeLastMatch: number | null;
  };

  const players: PlayerWithPreviousRating[] = base.map((row) => {
    const stats = statsByPlayer.get(row.playerId);
    const rps = rpsByPlayer.get(row.playerId);
    const lastMatch = lastMatchByPlayer.get(row.playerId);
    return {
      id: String(row.playerId),
      name: row.name,
      alias: row.alias,
      number: row.number,
      clubId: row.clubId != null ? String(row.clubId) : "",
      elo: row.rating != null ? Math.round(Number(row.rating)) : FALLBACK_RATING,
      throws: Number(stats?.throws ?? 0),
      hits: Number(stats?.hits ?? 0),
      bonusBeers: Number(stats?.bonusBeer ?? 0),
      wins: row.wins ?? 0,
      losses: row.losses ?? 0,
      games: row.gamesPlayed ?? 0,
      avatarInitials: initials(row.name),
      eloHistory: [],
      ehrensteine: Number(rps?.ehrensteine ?? 0),
      antritte: Number(rps?.antritte ?? 0),
      lastEloDelta: lastMatch ? Math.round(Number(lastMatch.delta)) : null,
      _ratingBeforeLastMatch: lastMatch ? Number(lastMatch.rating_before) : null,
    };
  });

  // Rang "vor dem letzten Spiel" je Spieler: Spieler ohne Vergleichsbasis
  // (kein Spiel) fallen ans Ende, behalten aber ihre relative Reihenfolge
  // per aktuellem Elo bei, damit die übrigen Ränge stabil bleiben.
  const previousOrder = [...players].sort((a, b) => {
    const aRating = a._ratingBeforeLastMatch ?? a.elo;
    const bRating = b._ratingBeforeLastMatch ?? b.elo;
    return bRating - aRating;
  });
  const previousRankByPlayer = new Map(previousOrder.map((p, i) => [p.id, i + 1]));

  const currentEloOrder = [...players].sort((a, b) => b.elo - a.elo);
  const currentRankByPlayer = new Map(currentEloOrder.map((p, i) => [p.id, i + 1]));

  const withRankDelta: Player[] = players.map(({ _ratingBeforeLastMatch, ...p }) => {
    const hasHistory = _ratingBeforeLastMatch != null;
    const currentRank = currentRankByPlayer.get(p.id)!;
    const previousRank = previousRankByPlayer.get(p.id)!;
    return {
      ...p,
      rankDelta: hasHistory ? previousRank - currentRank : null,
    };
  });

  return sortLeaderboard(withRankDelta, sortBy, direction);
}

type MatchRow = {
  matchId: number;
  eventId: number | null;
  playedAt: string;
  name: string | null;
  teamAName: string | null;
  teamBName: string | null;
};

async function buildMatchSummaries(matchRows: MatchRow[]): Promise<MatchSummary[]> {
  if (matchRows.length === 0) return [];
  const matchIds = matchRows.map((m) => m.matchId);

  const teamRows = await db
    .select({
      matchTeamId: matchTeam.matchTeamId,
      matchId: matchTeam.matchId,
      side: matchTeam.side,
      score: matchTeam.score,
    })
    .from(matchTeam)
    .where(inArray(matchTeam.matchId, matchIds));

  const teamIds = teamRows.map((t) => t.matchTeamId);
  const participationRows = teamIds.length
    ? await db
        .select({
          matchTeamId: matchParticipation.matchTeamId,
          playerId: matchParticipation.playerId,
          playerName: player.displayName,
        })
        .from(matchParticipation)
        .innerJoin(player, eq(player.playerId, matchParticipation.playerId))
        .where(inArray(matchParticipation.matchTeamId, teamIds))
    : [];

  const rosterByTeamId = new Map<number, TeamMember[]>();
  for (const p of participationRows) {
    const list = rosterByTeamId.get(p.matchTeamId) ?? [];
    list.push({ id: String(p.playerId), name: p.playerName });
    rosterByTeamId.set(p.matchTeamId, list);
  }

  const teamsByMatchId = new Map<number, typeof teamRows>();
  for (const t of teamRows) {
    const list = teamsByMatchId.get(t.matchId) ?? [];
    list.push(t);
    teamsByMatchId.set(t.matchId, list);
  }

  // Fallback für geplante, noch nicht bewertete Matches: die haben keine
  // match_team-Zeilen, ihr Kader steckt stattdessen in match_planned_roster.
  const matchIdsWithoutTeams = matchRows
    .filter((m) => !teamsByMatchId.has(m.matchId))
    .map((m) => m.matchId);
  const plannedRosterRows = matchIdsWithoutTeams.length
    ? await db
        .select({
          matchId: matchPlannedRoster.matchId,
          side: matchPlannedRoster.side,
          playerId: matchPlannedRoster.playerId,
          playerName: player.displayName,
        })
        .from(matchPlannedRoster)
        .innerJoin(player, eq(player.playerId, matchPlannedRoster.playerId))
        .where(inArray(matchPlannedRoster.matchId, matchIdsWithoutTeams))
    : [];
  const plannedRosterByMatchId = new Map<number, { teamA: TeamMember[]; teamB: TeamMember[] }>();
  for (const r of plannedRosterRows) {
    const entry = plannedRosterByMatchId.get(r.matchId) ?? { teamA: [], teamB: [] };
    const member = { id: String(r.playerId), name: r.playerName };
    if (r.side === "A") entry.teamA.push(member);
    else entry.teamB.push(member);
    plannedRosterByMatchId.set(r.matchId, entry);
  }

  return matchRows.map((m) => {
    const teams = teamsByMatchId.get(m.matchId) ?? [];
    const teamARow = teams.find((t) => t.side === "A");
    const teamBRow = teams.find((t) => t.side === "B");
    // Status ist eine DB-Tatsache, keine Uhrzeit-Heuristik: match_team-Zeilen
    // existieren genau dann, wenn das Match bewertet wurde (siehe
    // migrations/0001_planned_match_roster.sql). So wird auch ein Match, das
    // gestern gespielt aber noch nicht bewertet wurde, korrekt als "planned"
    // geführt statt fälschlich als "played".
    const isPlayed = teamARow !== undefined || teamBRow !== undefined;

    const planned = plannedRosterByMatchId.get(m.matchId);
    const teamA = teamARow ? rosterByTeamId.get(teamARow.matchTeamId) ?? [] : planned?.teamA ?? [];
    const teamB = teamBRow ? rosterByTeamId.get(teamBRow.matchTeamId) ?? [] : planned?.teamB ?? [];

    const playedAtDate = new Date(m.playedAt);
    const scoreA = teamARow ? Number(teamARow.score) : null;
    const scoreB = teamBRow ? Number(teamBRow.score) : null;
    const winner: "A" | "B" | undefined = isPlayed
      ? scoreA === 1
        ? "A"
        : scoreB === 1
          ? "B"
          : undefined
      : undefined;

    const teamAName = m.teamAName ?? "Team A";
    const teamBName = m.teamBName ?? "Team B";

    const scoreLabel = isPlayed
      ? winner === "A"
        ? `${teamAName} gewinnt`
        : winner === "B"
          ? `${teamBName} gewinnt`
          : "Unentschieden"
      : `Geplant · ${new Intl.DateTimeFormat("de-DE", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }).format(playedAtDate)}`;

    return {
      id: String(m.matchId),
      eventId: m.eventId != null ? String(m.eventId) : undefined,
      name: m.name ?? undefined,
      teamAName,
      teamBName,
      playedAt: playedAtDate.toISOString(),
      status: isPlayed ? "played" : "planned",
      teamA,
      teamB,
      winner,
      scoreLabel,
    } satisfies MatchSummary;
  });
}

export async function getRecentMatches(limit = 3): Promise<MatchSummary[]> {
  // Nur bewertete Matches (existierende match_team-Zeilen) - ein geplantes,
  // noch nicht bewertetes Match mit played_at in der Vergangenheit gehört
  // nicht in "Zuletzt erfasst", sondern zu getPlannedMatches().
  const rows = await db
    .select({
      matchId: match.matchId,
      eventId: match.eventId,
      playedAt: match.playedAt,
      name: match.name,
      teamAName: match.teamAName,
      teamBName: match.teamBName,
    })
    .from(match)
    .where(sql`EXISTS (SELECT 1 FROM ${matchTeam} WHERE ${matchTeam.matchId} = ${match.matchId})`)
    .orderBy(desc(match.playedAt))
    .limit(limit);
  return buildMatchSummaries(rows);
}

export async function getUpcomingMatches(): Promise<MatchSummary[]> {
  const rows = await db
    .select({
      matchId: match.matchId,
      eventId: match.eventId,
      playedAt: match.playedAt,
      name: match.name,
      teamAName: match.teamAName,
      teamBName: match.teamBName,
    })
    .from(match)
    .where(gt(match.playedAt, sql`now()`))
    .orderBy(asc(match.playedAt));
  return buildMatchSummaries(rows);
}

/** Geplante, noch nicht bewertete Matches (Kader in match_planned_roster,
 *  noch keine match_team-Zeilen) - für "Nächstes Match" und die "Geplante
 *  Matches"-Übersicht in /admin/spiele. */
export async function getPlannedMatches(limit?: number): Promise<MatchSummary[]> {
  const query = db
    .select({
      matchId: match.matchId,
      eventId: match.eventId,
      playedAt: match.playedAt,
      name: match.name,
      teamAName: match.teamAName,
      teamBName: match.teamBName,
    })
    .from(match)
    .where(
      sql`EXISTS (SELECT 1 FROM ${matchPlannedRoster} WHERE ${matchPlannedRoster.matchId} = ${match.matchId})`,
    )
    .orderBy(asc(match.playedAt));
  const rows = limit != null ? await query.limit(limit) : await query;
  return buildMatchSummaries(rows);
}

/** Alle Matches (geplant + bewertet) chronologisch absteigend, paginiert -
 *  für die öffentliche Übersicht unter /spiele. */
export async function getAllMatches(
  offset: number,
  limit: number,
): Promise<{ matches: MatchListItem[]; total: number }> {
  const [{ count }] = await db.select({ count: sql<string>`count(*)` }).from(match);
  const rows = await db
    .select({
      matchId: match.matchId,
      eventId: match.eventId,
      playedAt: match.playedAt,
      name: match.name,
      teamAName: match.teamAName,
      teamBName: match.teamBName,
      note: match.note,
    })
    .from(match)
    // Nach Abschluss sortieren, nicht nach Anlagedatum: ein spaeter
    // bewertetes Match soll oben stehen, auch wenn played_at frueher liegt.
    // Ohne ended_at (noch geplant) faellt COALESCE auf played_at zurueck.
    .orderBy(desc(sql`coalesce(${match.endedAt}, ${match.playedAt})`))
    .limit(limit)
    .offset(offset);

  const noteByMatchId = new Map(rows.map((r) => [String(r.matchId), r.note]));
  const summaries = await buildMatchSummaries(rows);
  const matches: MatchListItem[] = summaries.map((s) => ({
    ...s,
    note: noteByMatchId.get(s.id) ?? null,
  }));

  return { matches, total: Number(count) };
}

export async function getPlayerRecentMatches(
  playerId: number,
  limit = 4,
): Promise<MatchSummary[]> {
  const rows = await db
    .select({
      matchId: match.matchId,
      eventId: match.eventId,
      playedAt: match.playedAt,
      name: match.name,
      teamAName: match.teamAName,
      teamBName: match.teamBName,
    })
    .from(match)
    .innerJoin(matchTeam, eq(matchTeam.matchId, match.matchId))
    .innerJoin(matchParticipation, eq(matchParticipation.matchTeamId, matchTeam.matchTeamId))
    .where(and(eq(matchParticipation.playerId, playerId), lte(match.playedAt, sql`now()`)))
    .orderBy(desc(match.playedAt))
    .limit(limit);
  return buildMatchSummaries(rows);
}

export async function getMatchDetail(matchId: number): Promise<MatchDetail | undefined> {
  const [row] = await db
    .select({
      matchId: match.matchId,
      eventId: match.eventId,
      playedAt: match.playedAt,
      name: match.name,
      note: match.note,
      teamAName: match.teamAName,
      teamBName: match.teamBName,
      eventName: event.name,
      eventLocation: event.location,
      clubCity: club.city,
    })
    .from(match)
    .leftJoin(event, eq(event.eventId, match.eventId))
    .leftJoin(club, eq(club.clubId, event.clubId))
    .where(eq(match.matchId, matchId));

  if (!row) return undefined;

  const [summary] = await buildMatchSummaries([
    {
      matchId: row.matchId,
      eventId: row.eventId,
      playedAt: row.playedAt,
      name: row.name,
      teamAName: row.teamAName,
      teamBName: row.teamBName,
    },
  ]);

  const statRows = await db
    .select({
      playerId: matchParticipation.playerId,
      name: player.displayName,
      alias: player.alias,
      number: player.jerseyNumber,
      rating: playerRatingCurrent.rating,
      side: matchTeam.side,
      throws: matchParticipation.throws,
      hits: matchParticipation.hits,
      bonusBeer: matchParticipation.bonusBeer,
      delta: ratingHistory.delta,
    })
    .from(matchParticipation)
    .innerJoin(matchTeam, eq(matchTeam.matchTeamId, matchParticipation.matchTeamId))
    .innerJoin(player, eq(player.playerId, matchParticipation.playerId))
    .leftJoin(
      playerRatingCurrent,
      and(
        eq(playerRatingCurrent.playerId, matchParticipation.playerId),
        eq(playerRatingCurrent.modelId, V3_MODEL_ID),
      ),
    )
    .leftJoin(
      ratingHistory,
      and(
        eq(ratingHistory.matchId, matchTeam.matchId),
        eq(ratingHistory.playerId, matchParticipation.playerId),
        eq(ratingHistory.modelId, V3_MODEL_ID),
      ),
    )
    .where(eq(matchTeam.matchId, matchId));

  const playerStats: MatchPlayerStat[] = statRows.map((s) => ({
    playerId: String(s.playerId),
    name: s.name,
    alias: s.alias,
    number: s.number,
    elo: s.rating != null ? Math.round(Number(s.rating)) : FALLBACK_RATING,
    side: s.side as "A" | "B",
    throws: s.throws ?? 0,
    hits: s.hits ?? 0,
    bonusBeers: s.bonusBeer,
    eloDelta: s.delta != null ? Math.round(Number(s.delta)) : 0,
  }));

  return {
    ...summary,
    eventName: row.eventName ?? undefined,
    // Eigener Event-Ort hat Vorrang vor dem abgeleiteten Vereinsort (D23).
    eventLocation: row.eventLocation ?? row.clubCity ?? undefined,
    note: row.note ?? undefined,
    playerStats,
  };
}

export async function getPlayerRatingHistory(playerId: number): Promise<EloPoint[]> {
  const rows = await db
    .select({
      playedAt: match.playedAt,
      ratingAfter: ratingHistory.ratingAfter,
    })
    .from(ratingHistory)
    .innerJoin(match, eq(match.matchId, ratingHistory.matchId))
    .where(and(eq(ratingHistory.playerId, playerId), eq(ratingHistory.modelId, V3_MODEL_ID)))
    .orderBy(asc(match.playedAt));

  return rows.map((r) => ({
    label: new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short" }).format(
      new Date(r.playedAt),
    ),
    elo: Math.round(Number(r.ratingAfter)),
  }));
}

export async function getPlayerDetail(playerId: number): Promise<Player | undefined> {
  const [row] = await db
    .select({
      playerId: player.playerId,
      name: player.displayName,
      alias: player.alias,
      number: player.jerseyNumber,
      clubId: player.clubId,
      rating: playerRatingCurrent.rating,
      gamesPlayed: playerRatingCurrent.gamesPlayed,
      wins: playerRatingCurrent.wins,
      losses: playerRatingCurrent.losses,
    })
    .from(player)
    .leftJoin(
      playerRatingCurrent,
      and(
        eq(playerRatingCurrent.playerId, player.playerId),
        eq(playerRatingCurrent.modelId, V3_MODEL_ID),
      ),
    )
    .where(eq(player.playerId, playerId));

  if (!row) return undefined;

  const [statRow] = await db
    .select({
      throws: sql<string>`coalesce(sum(${matchParticipation.throws}), 0)`,
      hits: sql<string>`coalesce(sum(${matchParticipation.hits}), 0)`,
      bonusBeer: sql<string>`coalesce(sum(${matchParticipation.bonusBeer}), 0)`,
    })
    .from(matchParticipation)
    .where(eq(matchParticipation.playerId, playerId));

  const [rpsRow] = await db
    .select({
      ehrensteine: sql<string>`coalesce(sum(${matchRpsDraw.ehrensteinCount}), 0)`,
      antritte: sql<string>`count(*)`,
    })
    .from(matchRpsDraw)
    .where(eq(matchRpsDraw.playerId, playerId));

  const eloHistory = await getPlayerRatingHistory(playerId);

  return {
    id: String(row.playerId),
    name: row.name,
    alias: row.alias,
    number: row.number,
    clubId: row.clubId != null ? String(row.clubId) : "",
    elo: row.rating != null ? Math.round(Number(row.rating)) : FALLBACK_RATING,
    throws: Number(statRow?.throws ?? 0),
    hits: Number(statRow?.hits ?? 0),
    bonusBeers: Number(statRow?.bonusBeer ?? 0),
    wins: row.wins ?? 0,
    losses: row.losses ?? 0,
    games: row.gamesPlayed ?? 0,
    avatarInitials: initials(row.name),
    eloHistory,
    ehrensteine: Number(rpsRow?.ehrensteine ?? 0),
    antritte: Number(rpsRow?.antritte ?? 0),
    // Rang-/Elo-Delta sind nur im Ranglisten-Kontext sinnvoll (siehe
    // getLeaderboard) — hier gibt es keine Vergleichsbasis.
    rankDelta: null,
    lastEloDelta: null,
  };
}

export type PlayerEditDetail = {
  playerId: number;
  displayName: string;
  alias: string | null;
  jerseyNumber: number | null;
  clubId: number | null;
  isActive: boolean;
};

/** Für /admin/spieler/[id]/bearbeiten — Stammdaten eines einzelnen Spielers. */
export async function getPlayerById(playerId: number): Promise<PlayerEditDetail | undefined> {
  const [row] = await db
    .select({
      playerId: player.playerId,
      displayName: player.displayName,
      alias: player.alias,
      jerseyNumber: player.jerseyNumber,
      clubId: player.clubId,
      isActive: player.isActive,
    })
    .from(player)
    .where(eq(player.playerId, playerId));

  if (!row) return undefined;

  return {
    playerId: row.playerId,
    displayName: row.displayName,
    alias: row.alias,
    jerseyNumber: row.jerseyNumber,
    clubId: row.clubId,
    isActive: row.isActive === 1,
  };
}

export type ClubEditDetail = {
  clubId: number;
  name: string;
  city: string | null;
};

/** Für /admin/vereine/[id]/bearbeiten — Stammdaten eines einzelnen Vereins (D23). */
export async function getClubById(clubId: number): Promise<ClubEditDetail | undefined> {
  const [row] = await db
    .select({ clubId: club.clubId, name: club.name, city: club.city })
    .from(club)
    .where(eq(club.clubId, clubId));

  if (!row) return undefined;

  return { clubId: row.clubId, name: row.name, city: row.city };
}

export type EventEditDetail = {
  eventId: number;
  name: string;
  clubId: number | null;
  startsOn: string | null;
  endsOn: string | null;
  location: string | null;
};

/** Für /admin/events/[id]/bearbeiten — Stammdaten eines einzelnen Events (D23). */
export async function getEventById(eventId: number): Promise<EventEditDetail | undefined> {
  const [row] = await db
    .select({
      eventId: event.eventId,
      name: event.name,
      clubId: event.clubId,
      startsOn: event.startsOn,
      endsOn: event.endsOn,
      location: event.location,
    })
    .from(event)
    .where(eq(event.eventId, eventId));

  if (!row) return undefined;

  return {
    eventId: row.eventId,
    name: row.name,
    clubId: row.clubId,
    startsOn: toDateOnlyString(row.startsOn),
    endsOn: toDateOnlyString(row.endsOn),
    location: row.location,
  };
}
