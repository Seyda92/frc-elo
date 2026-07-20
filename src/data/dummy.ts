export type Club = {
  id: string;
  name: string;
  location: string;
};

export type Player = {
  id: string;
  name: string;
  number: number;
  clubId: string;
  elo: number;
  throws: number;
  hits: number;
  bonusBeers: number;
  warnings: number;
  wins: number;
  losses: number;
  games: number;
  avatarInitials: string;
  achievements: string[];
  eloHistory: { label: string; elo: number }[];
};

export type Event = {
  id: string;
  name: string;
  location: string;
  startsAt: string;
  endsAt: string;
  status: "upcoming" | "ongoing" | "past";
};

export type MatchPlayerStat = {
  playerId: string;
  throws: number;
  hits: number;
  bonusBeers: number;
  warnings: number;
  eloDelta: number;
};

export type MatchSummary = {
  id: string;
  eventId?: string;
  playedAt: string;
  status: "planned" | "played";
  teamA: string[];
  teamB: string[];
  winner?: "A" | "B";
  scoreLabel: string;
  playerStats?: MatchPlayerStat[];
};

export type LivePlayerStats = {
  playerId: string;
  throws: number;
  hits: number;
  bonusBeers: number;
  warnings: number;
};

export type LiveMatch = {
  id: string;
  eventName: string;
  startedAt: string;
  teamSize: number;
  teamA: LivePlayerStats[];
  teamB: LivePlayerStats[];
  winner: "A" | "B" | null;
};

export const club: Club = {
  id: "club-1frc",
  name: "1. FRC Klönberg-Rödelplötzen",
  location: "Klönberg-Rödelplötzen",
};

export const players: Player[] = [
  {
    id: "p1",
    name: "Torben Reifen",
    number: 7,
    clubId: club.id,
    elo: 1248,
    throws: 142,
    hits: 89,
    bonusBeers: 18,
    warnings: 1,
    wins: 14,
    losses: 6,
    games: 20,
    avatarInitials: "TR",
    achievements: ["Bierkönig", "Hot Streak", "Festival-Ass"],
    eloHistory: [
      { label: "Apr", elo: 1000 },
      { label: "Mai", elo: 1055 },
      { label: "Jun", elo: 1120 },
      { label: "Jul", elo: 1188 },
      { label: "Aug", elo: 1210 },
      { label: "Sep", elo: 1248 },
    ],
  },
  {
    id: "p2",
    name: "Mila Flunky",
    number: 11,
    clubId: club.id,
    elo: 1215,
    throws: 130,
    hits: 78,
    bonusBeers: 12,
    warnings: 0,
    wins: 13,
    losses: 5,
    games: 18,
    avatarInitials: "MF",
    achievements: ["Underdog", "Saubere Weste"],
    eloHistory: [
      { label: "Apr", elo: 1000 },
      { label: "Mai", elo: 1030 },
      { label: "Jun", elo: 1095 },
      { label: "Jul", elo: 1140 },
      { label: "Aug", elo: 1190 },
      { label: "Sep", elo: 1215 },
    ],
  },
  {
    id: "p3",
    name: "Jonas Asphalt",
    number: 3,
    clubId: club.id,
    elo: 1182,
    throws: 156,
    hits: 84,
    bonusBeers: 22,
    warnings: 3,
    wins: 11,
    losses: 9,
    games: 20,
    avatarInitials: "JA",
    achievements: ["Bierkönig", "Risikospieler"],
    eloHistory: [
      { label: "Apr", elo: 1000 },
      { label: "Mai", elo: 1080 },
      { label: "Jun", elo: 1110 },
      { label: "Jul", elo: 1095 },
      { label: "Aug", elo: 1150 },
      { label: "Sep", elo: 1182 },
    ],
  },
  {
    id: "p4",
    name: "Saskia Dose",
    number: 19,
    clubId: club.id,
    elo: 1164,
    throws: 118,
    hits: 71,
    bonusBeers: 9,
    warnings: 0,
    wins: 10,
    losses: 6,
    games: 16,
    avatarInitials: "SD",
    achievements: ["Präzision", "Teamplayer"],
    eloHistory: [
      { label: "Apr", elo: 1000 },
      { label: "Mai", elo: 1040 },
      { label: "Jun", elo: 1088 },
      { label: "Jul", elo: 1122 },
      { label: "Aug", elo: 1148 },
      { label: "Sep", elo: 1164 },
    ],
  },
  {
    id: "p5",
    name: "Finn Camp",
    number: 42,
    clubId: club.id,
    elo: 1138,
    throws: 125,
    hits: 68,
    bonusBeers: 15,
    warnings: 2,
    wins: 9,
    losses: 8,
    games: 17,
    avatarInitials: "FC",
    achievements: ["Festival-Ass"],
    eloHistory: [
      { label: "Apr", elo: 1000 },
      { label: "Mai", elo: 1025 },
      { label: "Jun", elo: 1070 },
      { label: "Jul", elo: 1105 },
      { label: "Aug", elo: 1120 },
      { label: "Sep", elo: 1138 },
    ],
  },
  {
    id: "p6",
    name: "Lea Kork",
    number: 8,
    clubId: club.id,
    elo: 1102,
    throws: 110,
    hits: 58,
    bonusBeers: 11,
    warnings: 1,
    wins: 8,
    losses: 8,
    games: 16,
    avatarInitials: "LK",
    achievements: ["Comeback"],
    eloHistory: [
      { label: "Apr", elo: 1000 },
      { label: "Mai", elo: 1010 },
      { label: "Jun", elo: 1045 },
      { label: "Jul", elo: 1078 },
      { label: "Aug", elo: 1090 },
      { label: "Sep", elo: 1102 },
    ],
  },
  {
    id: "p7",
    name: "Paul Ring",
    number: 14,
    clubId: club.id,
    elo: 1076,
    throws: 98,
    hits: 49,
    bonusBeers: 7,
    warnings: 0,
    wins: 7,
    losses: 7,
    games: 14,
    avatarInitials: "PR",
    achievements: ["Debütant"],
    eloHistory: [
      { label: "Apr", elo: 1000 },
      { label: "Mai", elo: 1005 },
      { label: "Jun", elo: 1030 },
      { label: "Jul", elo: 1055 },
      { label: "Aug", elo: 1068 },
      { label: "Sep", elo: 1076 },
    ],
  },
  {
    id: "p8",
    name: "Nora Pils",
    number: 21,
    clubId: club.id,
    elo: 1051,
    throws: 102,
    hits: 47,
    bonusBeers: 14,
    warnings: 1,
    wins: 6,
    losses: 9,
    games: 15,
    avatarInitials: "NP",
    achievements: ["Durstlöscher"],
    eloHistory: [
      { label: "Apr", elo: 1000 },
      { label: "Mai", elo: 990 },
      { label: "Jun", elo: 1015 },
      { label: "Jul", elo: 1030 },
      { label: "Aug", elo: 1040 },
      { label: "Sep", elo: 1051 },
    ],
  },
  {
    id: "p9",
    name: "Ben Zelt",
    number: 5,
    clubId: club.id,
    elo: 1024,
    throws: 88,
    hits: 38,
    bonusBeers: 6,
    warnings: 2,
    wins: 5,
    losses: 8,
    games: 13,
    avatarInitials: "BZ",
    achievements: ["Kämpferherz"],
    eloHistory: [
      { label: "Apr", elo: 1000 },
      { label: "Mai", elo: 980 },
      { label: "Jun", elo: 995 },
      { label: "Jul", elo: 1010 },
      { label: "Aug", elo: 1018 },
      { label: "Sep", elo: 1024 },
    ],
  },
  {
    id: "p10",
    name: "Kim Schlamm",
    number: 27,
    clubId: club.id,
    elo: 998,
    throws: 76,
    hits: 31,
    bonusBeers: 5,
    warnings: 0,
    wins: 4,
    losses: 8,
    games: 12,
    avatarInitials: "KS",
    achievements: ["Aufsteiger"],
    eloHistory: [
      { label: "Apr", elo: 1000 },
      { label: "Mai", elo: 970 },
      { label: "Jun", elo: 960 },
      { label: "Jul", elo: 975 },
      { label: "Aug", elo: 990 },
      { label: "Sep", elo: 998 },
    ],
  },
];

export const events: Event[] = [
  {
    id: "e1",
    name: "Sommer-Open Air",
    location: "Festwiese Rödelplötzen",
    startsAt: "2026-07-18",
    endsAt: "2026-07-20",
    status: "ongoing",
  },
  {
    id: "e2",
    name: "Trainingswochenende",
    location: "Vereinsgelände",
    startsAt: "2026-08-08",
    endsAt: "2026-08-09",
    status: "upcoming",
  },
  {
    id: "e3",
    name: "Frühlings-Cup",
    location: "Campingplatz Nord",
    startsAt: "2026-04-11",
    endsAt: "2026-04-12",
    status: "past",
  },
];

export const matches: MatchSummary[] = [
  {
    id: "m1",
    eventId: "e1",
    playedAt: "2026-07-19T16:30:00",
    status: "played",
    teamA: ["p1", "p3", "p5", "p7"],
    teamB: ["p2", "p4", "p6", "p8"],
    winner: "A",
    scoreLabel: "Team A gewinnt",
    playerStats: [
      { playerId: "p1", throws: 8, hits: 5, bonusBeers: 1, warnings: 0, eloDelta: 14 },
      { playerId: "p3", throws: 7, hits: 3, bonusBeers: 2, warnings: 1, eloDelta: 11 },
      { playerId: "p5", throws: 9, hits: 4, bonusBeers: 0, warnings: 0, eloDelta: 13 },
      { playerId: "p7", throws: 6, hits: 3, bonusBeers: 1, warnings: 0, eloDelta: 15 },
      { playerId: "p2", throws: 8, hits: 4, bonusBeers: 0, warnings: 0, eloDelta: -12 },
      { playerId: "p4", throws: 7, hits: 5, bonusBeers: 1, warnings: 0, eloDelta: -10 },
      { playerId: "p6", throws: 8, hits: 2, bonusBeers: 1, warnings: 0, eloDelta: -9 },
      { playerId: "p8", throws: 6, hits: 1, bonusBeers: 2, warnings: 1, eloDelta: -11 },
    ],
  },
  {
    id: "m2",
    eventId: "e1",
    playedAt: "2026-07-19T14:00:00",
    status: "played",
    teamA: ["p2", "p5", "p9"],
    teamB: ["p1", "p6", "p10"],
    winner: "B",
    scoreLabel: "Team B gewinnt",
    playerStats: [
      { playerId: "p2", throws: 6, hits: 2, bonusBeers: 0, warnings: 0, eloDelta: -11 },
      { playerId: "p5", throws: 7, hits: 3, bonusBeers: 1, warnings: 0, eloDelta: -10 },
      { playerId: "p9", throws: 5, hits: 1, bonusBeers: 0, warnings: 1, eloDelta: -8 },
      { playerId: "p1", throws: 7, hits: 5, bonusBeers: 1, warnings: 0, eloDelta: 13 },
      { playerId: "p6", throws: 6, hits: 3, bonusBeers: 2, warnings: 0, eloDelta: 14 },
      { playerId: "p10", throws: 5, hits: 2, bonusBeers: 0, warnings: 0, eloDelta: 16 },
    ],
  },
  {
    id: "m3",
    eventId: "e1",
    playedAt: "2026-07-20T11:00:00",
    status: "planned",
    teamA: ["p1", "p4", "p8", "p9"],
    teamB: ["p2", "p3", "p7", "p10"],
    scoreLabel: "Geplant · 11:00",
  },
  {
    id: "m4",
    eventId: "e3",
    playedAt: "2026-04-12T15:00:00",
    status: "played",
    teamA: ["p3", "p4", "p6", "p8", "p9"],
    teamB: ["p1", "p2", "p5", "p7", "p10"],
    winner: "B",
    scoreLabel: "Team B gewinnt",
    playerStats: [
      { playerId: "p3", throws: 8, hits: 3, bonusBeers: 2, warnings: 1, eloDelta: -12 },
      { playerId: "p4", throws: 7, hits: 4, bonusBeers: 0, warnings: 0, eloDelta: -10 },
      { playerId: "p6", throws: 6, hits: 2, bonusBeers: 1, warnings: 0, eloDelta: -9 },
      { playerId: "p8", throws: 7, hits: 2, bonusBeers: 1, warnings: 0, eloDelta: -11 },
      { playerId: "p9", throws: 5, hits: 1, bonusBeers: 0, warnings: 0, eloDelta: -8 },
      { playerId: "p1", throws: 8, hits: 5, bonusBeers: 1, warnings: 0, eloDelta: 12 },
      { playerId: "p2", throws: 7, hits: 4, bonusBeers: 0, warnings: 0, eloDelta: 11 },
      { playerId: "p5", throws: 9, hits: 4, bonusBeers: 1, warnings: 0, eloDelta: 13 },
      { playerId: "p7", throws: 6, hits: 3, bonusBeers: 0, warnings: 0, eloDelta: 14 },
      { playerId: "p10", throws: 5, hits: 2, bonusBeers: 1, warnings: 0, eloDelta: 15 },
    ],
  },
];

export const liveMatch: LiveMatch = {
  id: "live-1",
  eventName: "Sommer-Open Air · Match 3",
  startedAt: "2026-07-20T17:05:00",
  teamSize: 4,
  teamA: [
    { playerId: "p1", throws: 6, hits: 4, bonusBeers: 1, warnings: 0 },
    { playerId: "p3", throws: 5, hits: 2, bonusBeers: 2, warnings: 1 },
    { playerId: "p5", throws: 7, hits: 3, bonusBeers: 0, warnings: 0 },
    { playerId: "p7", throws: 4, hits: 2, bonusBeers: 1, warnings: 0 },
  ],
  teamB: [
    { playerId: "p2", throws: 6, hits: 3, bonusBeers: 0, warnings: 0 },
    { playerId: "p4", throws: 5, hits: 4, bonusBeers: 1, warnings: 0 },
    { playerId: "p6", throws: 6, hits: 2, bonusBeers: 1, warnings: 0 },
    { playerId: "p8", throws: 5, hits: 1, bonusBeers: 2, warnings: 1 },
  ],
  winner: null,
};

export function getPlayer(id: string): Player | undefined {
  return players.find((p) => p.id === id);
}

export function getMatch(id: string): MatchSummary | undefined {
  return matches.find((m) => m.id === id);
}

export function getEvent(id: string): Event | undefined {
  return events.find((e) => e.id === id);
}

export function getMatchStat(
  match: MatchSummary,
  playerId: string,
): MatchPlayerStat | undefined {
  return match.playerStats?.find((s) => s.playerId === playerId);
}

export function hitRate(player: Player): number {
  if (player.throws === 0) return 0;
  return Math.round((player.hits / player.throws) * 100);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
