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
  matchTeam,
  player,
  playerRatingCurrent,
  ratingModel,
  ratingHistory,
  teamFactor,
} from "./generated/schema.ts";
import { initials, type EloPoint } from "@/lib/format";
import type { EloParams } from "@/lib/elo";
import type { Role } from "@/lib/session";
import { FALLBACK_RATING, V3_MODEL_ID } from "./model.ts";
import type {
  Club,
  EventSummary,
  MatchDetail,
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
};

/** Für /admin/schiris — alle Konten, unabhängig von Rolle/Status. */
export async function getAppUsers(): Promise<AppUser[]> {
  const rows = await db
    .select({
      userId: appUser.userId,
      username: appUser.username,
      role: appUser.role,
      isActive: appUser.isActive,
    })
    .from(appUser)
    .orderBy(asc(appUser.username));

  return rows.map((row) => ({
    userId: row.userId,
    username: row.username,
    role: row.role as Role,
    isActive: row.isActive === 1,
  }));
}

export async function getAllPlayers(): Promise<
  { id: string; name: string; number: number | null; clubName: string }[]
> {
  const rows = await db
    .select({
      playerId: player.playerId,
      name: player.displayName,
      number: player.jerseyNumber,
      clubName: club.name,
    })
    .from(player)
    .leftJoin(club, eq(club.clubId, player.clubId))
    .orderBy(asc(player.displayName));

  return rows.map((row) => ({
    id: String(row.playerId),
    name: row.name,
    number: row.number,
    clubName: row.clubName ?? "—",
  }));
}

export async function getAllEvents(): Promise<EventSummary[]> {
  const rows = await db
    .select({
      eventId: event.eventId,
      name: event.name,
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
      location: row.clubCity ?? row.clubName ?? "",
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
  jerseyNumber: number | null;
  clubName: string;
  /** Nur für die Anzeige im Formular — die Action liest die maßgeblichen
   *  Werte innerhalb der Transaktion neu (siehe scoreMatch). */
  rating: number;
  gamesPlayed: number;
};

/** Aktive Spieler für die Match-Erfassung, inkl. aktueller Wertung. */
export async function getPlayersForMatchEntry(): Promise<MatchEntryPlayer[]> {
  const rows = await db
    .select({
      playerId: player.playerId,
      name: player.displayName,
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
    jerseyNumber: row.jerseyNumber,
    clubName: row.clubName ?? "—",
    rating: row.rating != null ? Math.round(Number(row.rating)) : FALLBACK_RATING,
    gamesPlayed: row.gamesPlayed ?? 0,
  }));
}

export type PlannedMatchDetail = {
  matchId: number;
  eventId: number | null;
  eventName: string | null;
  playedAt: string;
  kFactor: number;
  canDiff: number;
  note: string | null;
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
    })
    .from(match)
    .leftJoin(event, eq(event.eventId, match.eventId))
    .where(eq(match.matchId, matchId));

  if (!row) return undefined;

  const rosterRows = await db
    .select({
      playerId: matchPlannedRoster.playerId,
      side: matchPlannedRoster.side,
      name: player.displayName,
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
    jerseyNumber: r.jerseyNumber,
    clubName: r.clubName ?? "—",
    rating: r.rating != null ? Math.round(Number(r.rating)) : FALLBACK_RATING,
    gamesPlayed: r.gamesPlayed ?? 0,
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
    refereeName: refereeRow?.name ?? null,
    teamA: rosterRows.filter((r) => r.side === "A").map(toEntryPlayer),
    teamB: rosterRows.filter((r) => r.side === "B").map(toEntryPlayer),
  };
}

export async function getMatchCount(): Promise<number> {
  const [row] = await db.select({ count: sql<string>`count(*)` }).from(match);
  return row ? Number(row.count) : 0;
}

export async function getLeaderboard(clubId: number): Promise<Player[]> {
  const base = await db
    .select({
      playerId: player.playerId,
      name: player.displayName,
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

  const players: Player[] = base.map((row) => {
    const stats = statsByPlayer.get(row.playerId);
    return {
      id: String(row.playerId),
      name: row.name,
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
    };
  });

  return players.sort((a, b) => b.elo - a.elo);
}

export async function getFeaturedEvents(clubId: number): Promise<EventSummary[]> {
  const rows = await db
    .select({
      eventId: event.eventId,
      name: event.name,
      startsOn: event.startsOn,
      endsOn: event.endsOn,
      clubCity: club.city,
    })
    .from(event)
    .leftJoin(club, eq(club.clubId, event.clubId))
    .where(eq(event.clubId, clubId));

  return rows
    .map((row) => {
      const startsAt = toDateOnlyString(row.startsOn);
      const endsAt = toDateOnlyString(row.endsOn);
      return {
        id: String(row.eventId),
        name: row.name,
        location: row.clubCity ?? row.name,
        startsAt,
        endsAt,
        status: deriveEventStatus(startsAt, endsAt),
      } satisfies EventSummary;
    })
    .filter((e) => e.status !== "past");
}

type MatchRow = { matchId: number; eventId: number | null; playedAt: string; name: string | null };

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

    const scoreLabel = isPlayed
      ? winner === "A"
        ? "Team A gewinnt"
        : winner === "B"
          ? "Team B gewinnt"
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
    .select({ matchId: match.matchId, eventId: match.eventId, playedAt: match.playedAt, name: match.name })
    .from(match)
    .where(sql`EXISTS (SELECT 1 FROM ${matchTeam} WHERE ${matchTeam.matchId} = ${match.matchId})`)
    .orderBy(desc(match.playedAt))
    .limit(limit);
  return buildMatchSummaries(rows);
}

export async function getUpcomingMatches(): Promise<MatchSummary[]> {
  const rows = await db
    .select({ matchId: match.matchId, eventId: match.eventId, playedAt: match.playedAt, name: match.name })
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
    .select({ matchId: match.matchId, eventId: match.eventId, playedAt: match.playedAt, name: match.name })
    .from(match)
    .where(
      sql`EXISTS (SELECT 1 FROM ${matchPlannedRoster} WHERE ${matchPlannedRoster.matchId} = ${match.matchId})`,
    )
    .orderBy(asc(match.playedAt));
  const rows = limit != null ? await query.limit(limit) : await query;
  return buildMatchSummaries(rows);
}

export async function getPlayerRecentMatches(
  playerId: number,
  limit = 4,
): Promise<MatchSummary[]> {
  const rows = await db
    .select({ matchId: match.matchId, eventId: match.eventId, playedAt: match.playedAt, name: match.name })
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
      eventName: event.name,
      clubCity: club.city,
    })
    .from(match)
    .leftJoin(event, eq(event.eventId, match.eventId))
    .leftJoin(club, eq(club.clubId, event.clubId))
    .where(eq(match.matchId, matchId));

  if (!row) return undefined;

  const [summary] = await buildMatchSummaries([
    { matchId: row.matchId, eventId: row.eventId, playedAt: row.playedAt, name: row.name },
  ]);

  const statRows = await db
    .select({
      playerId: matchParticipation.playerId,
      name: player.displayName,
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
    eventLocation: row.clubCity ?? undefined,
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

  const eloHistory = await getPlayerRatingHistory(playerId);

  return {
    id: String(row.playerId),
    name: row.name,
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
  };
}
