import type { EloPoint } from "@/lib/format";

export type Club = {
  id: string;
  name: string;
  location: string;
};

export type TeamMember = {
  id: string;
  name: string;
};

export type Player = {
  id: string;
  name: string;
  alias: string | null;
  number: number | null;
  clubId: string;
  elo: number;
  throws: number;
  hits: number;
  bonusBeers: number;
  wins: number;
  losses: number;
  games: number;
  avatarInitials: string;
  eloHistory: EloPoint[];
};

export type EventSummary = {
  id: string;
  name: string;
  location: string;
  startsAt: string | null;
  endsAt: string | null;
  status: "upcoming" | "ongoing" | "past";
};

export type MatchPlayerStat = {
  playerId: string;
  name: string;
  alias: string | null;
  number: number | null;
  elo: number;
  side: "A" | "B";
  throws: number;
  hits: number;
  bonusBeers: number;
  eloDelta: number;
};

export type MatchSummary = {
  id: string;
  eventId?: string;
  name?: string;
  teamAName: string;
  teamBName: string;
  playedAt: string;
  status: "planned" | "played";
  teamA: TeamMember[];
  teamB: TeamMember[];
  winner?: "A" | "B";
  scoreLabel: string;
};

export type MatchDetail = MatchSummary & {
  eventName?: string;
  eventLocation?: string;
  note?: string;
  playerStats: MatchPlayerStat[];
};
