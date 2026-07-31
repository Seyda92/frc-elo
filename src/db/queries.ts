import { and, asc, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { db } from "./client";
import {
  club,
  event,
  match,
  matchParticipation,
  matchTeam,
  player,
  playerRatingCurrent,
  ratingModel,
  ratingHistory,
  teamFactor,
} from "./generated/schema";
import { initials, type EloPoint } from "@/lib/format";
import type { EloParams } from "@/lib/elo";
import type {
  Club,
  EventSummary,
  MatchDetail,
  MatchPlayerStat,
  MatchSummary,
  Player,
  TeamMember,
} from "./types";

const V3_MODEL_ID = 1;

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
  return row ? Number(row.startRating) : 200;
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
      elo: row.rating != null ? Math.round(Number(row.rating)) : 200,
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

type MatchRow = { matchId: number; eventId: number | null; playedAt: string };

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

  return matchRows.map((m) => {
    const teams = teamsByMatchId.get(m.matchId) ?? [];
    const teamARow = teams.find((t) => t.side === "A");
    const teamBRow = teams.find((t) => t.side === "B");
    const teamA = teamARow ? rosterByTeamId.get(teamARow.matchTeamId) ?? [] : [];
    const teamB = teamBRow ? rosterByTeamId.get(teamBRow.matchTeamId) ?? [] : [];

    const playedAtDate = new Date(m.playedAt);
    const isPlayed = playedAtDate.getTime() <= Date.now();
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
          hour: "2-digit",
          minute: "2-digit",
        }).format(playedAtDate)}`;

    return {
      id: String(m.matchId),
      eventId: m.eventId != null ? String(m.eventId) : undefined,
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
  const rows = await db
    .select({ matchId: match.matchId, eventId: match.eventId, playedAt: match.playedAt })
    .from(match)
    .where(lte(match.playedAt, sql`now()`))
    .orderBy(desc(match.playedAt))
    .limit(limit);
  return buildMatchSummaries(rows);
}

export async function getUpcomingMatches(): Promise<MatchSummary[]> {
  const rows = await db
    .select({ matchId: match.matchId, eventId: match.eventId, playedAt: match.playedAt })
    .from(match)
    .where(gt(match.playedAt, sql`now()`))
    .orderBy(asc(match.playedAt));
  return buildMatchSummaries(rows);
}

export async function getPlayerRecentMatches(
  playerId: number,
  limit = 4,
): Promise<MatchSummary[]> {
  const rows = await db
    .select({ matchId: match.matchId, eventId: match.eventId, playedAt: match.playedAt })
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
      eventName: event.name,
      clubCity: club.city,
    })
    .from(match)
    .leftJoin(event, eq(event.eventId, match.eventId))
    .leftJoin(club, eq(club.clubId, event.clubId))
    .where(eq(match.matchId, matchId));

  if (!row) return undefined;

  const [summary] = await buildMatchSummaries([
    { matchId: row.matchId, eventId: row.eventId, playedAt: row.playedAt },
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
    elo: s.rating != null ? Math.round(Number(s.rating)) : 200,
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
    elo: row.rating != null ? Math.round(Number(row.rating)) : 200,
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
