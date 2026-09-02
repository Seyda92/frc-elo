import { pgTable, foreignKey, integer, text, date, unique, check, numeric, index, timestamp, primaryKey, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const event = pgTable("event", {
	eventId: integer("event_id").primaryKey().generatedAlwaysAsIdentity({ name: "event_event_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	name: text().notNull(),
	startsOn: date("starts_on"),
	endsOn: date("ends_on"),
	clubId: integer("club_id"),
}, (table) => [
	foreignKey({
			columns: [table.clubId],
			foreignColumns: [club.clubId],
			name: "event_club_id_fkey"
		}),
]);

export const ratingModel = pgTable("rating_model", {
	modelId: integer("model_id").primaryKey().generatedAlwaysAsIdentity({ name: "rating_model_model_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	code: text().default('v3').notNull(),
	description: text().default('v3: nullsummen-neutral, Gleichverteilung P/n').notNull(),
	startRating: numeric("start_rating", { precision: 10, scale:  4 }).default('200').notNull(),
	sizeFactorOffset: numeric("size_factor_offset", { precision: 10, scale:  4 }).default('7.0').notNull(),
	isZeroSum: integer("is_zero_sum").default(1).notNull(),
	distribution: text().default('equal').notNull(),
	provisionalGames: integer("provisional_games").default(15).notNull(),
	provisionalKBoost: numeric("provisional_k_boost", { precision: 10, scale:  4 }).default('3.0').notNull(),
}, (table) => [
	unique("rating_model_code_key").on(table.code),
	check("rating_model_code_check", sql`code = 'v3'::text`),
]);

export const match = pgTable("match", {
	matchId: integer("match_id").primaryKey().generatedAlwaysAsIdentity({ name: "match_match_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	eventId: integer("event_id"),
	playedAt: timestamp("played_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	kFactor: integer("k_factor").notNull(),
	canDiff: integer("can_diff").default(0).notNull(),
	note: text(),
	name: text(),
}, (table) => [
	index("idx_match_event").using("btree", table.eventId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.eventId],
			foreignColumns: [event.eventId],
			name: "match_event_id_fkey"
		}),
]);

export const matchReferee = pgTable("match_referee", {
	matchId: integer("match_id").primaryKey().notNull(),
	playerId: integer("player_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.matchId],
			foreignColumns: [match.matchId],
			name: "match_referee_match_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.playerId],
			foreignColumns: [player.playerId],
			name: "match_referee_player_id_fkey"
		}),
]);

export const matchTeam = pgTable("match_team", {
	matchTeamId: integer("match_team_id").primaryKey().generatedAlwaysAsIdentity({ name: "match_team_match_team_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	matchId: integer("match_id").notNull(),
	side: text().notNull(),
	teamSize: integer("team_size").notNull(),
	score: numeric({ precision: 2, scale:  1 }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.matchId],
			foreignColumns: [match.matchId],
			name: "match_team_match_id_fkey"
		}).onDelete("cascade"),
	unique("match_team_match_id_side_key").on(table.matchId, table.side),
	check("match_team_side_check", sql`side = ANY (ARRAY['A'::text, 'B'::text])`),
	check("match_team_score_check", sql`score = ANY (ARRAY[(0)::numeric, (1)::numeric])`),
	check("match_team_team_size_check", sql`(team_size >= 1) AND (team_size <= 20)`),
]);

export const matchPlannedRoster = pgTable("match_planned_roster", {
	matchId: integer("match_id").notNull(),
	playerId: integer("player_id").notNull(),
	side: text().notNull(),
}, (table) => [
	index("idx_planned_roster_match").using("btree", table.matchId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.matchId],
			foreignColumns: [match.matchId],
			name: "match_planned_roster_match_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.playerId],
			foreignColumns: [player.playerId],
			name: "match_planned_roster_player_id_fkey"
		}),
	primaryKey({ columns: [table.matchId, table.playerId], name: "match_planned_roster_pkey" }),
	check("match_planned_roster_side_check", sql`side = ANY (ARRAY['A'::text, 'B'::text])`),
]);

export const playerRefereeStats = pgTable("player_referee_stats", {
	playerId: integer("player_id").primaryKey().notNull(),
	matchesReffed: integer("matches_reffed").default(0).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.playerId],
			foreignColumns: [player.playerId],
			name: "player_referee_stats_player_id_fkey"
		}),
]);

export const ratingHistory = pgTable("rating_history", {
	historyId: integer("history_id").primaryKey().generatedAlwaysAsIdentity({ name: "rating_history_history_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	matchId: integer("match_id").notNull(),
	playerId: integer("player_id").notNull(),
	modelId: integer("model_id").notNull(),
	ratingBefore: numeric("rating_before", { precision: 10, scale:  4 }).notNull(),
	delta: numeric({ precision: 10, scale:  4 }).notNull(),
	ratingAfter: numeric("rating_after", { precision: 10, scale:  4 }).notNull(),
	gamesPlayed: integer("games_played").notNull(),
}, (table) => [
	index("idx_history_match").using("btree", table.matchId.asc().nullsLast().op("int4_ops")),
	index("idx_history_player_model").using("btree", table.playerId.asc().nullsLast().op("int4_ops"), table.modelId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.matchId],
			foreignColumns: [match.matchId],
			name: "rating_history_match_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.playerId],
			foreignColumns: [player.playerId],
			name: "rating_history_player_id_fkey"
		}),
	foreignKey({
			columns: [table.modelId],
			foreignColumns: [ratingModel.modelId],
			name: "rating_history_model_id_fkey"
		}),
	unique("rating_history_match_id_player_id_model_id_key").on(table.matchId, table.playerId, table.modelId),
]);

export const club = pgTable("club", {
	clubId: integer("club_id").primaryKey().generatedAlwaysAsIdentity({ name: "club_club_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	name: text().notNull(),
	city: text(),
});

export const player = pgTable("player", {
	playerId: integer("player_id").primaryKey().generatedAlwaysAsIdentity({ name: "player_player_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	clubId: integer("club_id"),
	displayName: text("display_name").notNull(),
	jerseyNumber: integer("jersey_number"),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	isActive: integer("is_active").default(1).notNull(),
}, (table) => [
	index("idx_player_club").using("btree", table.clubId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.clubId],
			foreignColumns: [club.clubId],
			name: "player_club_id_fkey"
		}),
	unique("player_club_id_jersey_number_key").on(table.clubId, table.jerseyNumber),
]);

export const appUser = pgTable("app_user", {
	userId: integer("user_id").primaryKey().generatedAlwaysAsIdentity({ name: "app_user_user_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	username: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	role: text().default('user').notNull(),
	playerId: integer("player_id"),
	isActive: integer("is_active").default(1).notNull(),
}, (table) => [
	uniqueIndex("app_user_single_owner").using("btree", table.role.asc().nullsLast().op("text_ops")).where(sql`(role = 'owner'::text)`),
	foreignKey({
			columns: [table.playerId],
			foreignColumns: [player.playerId],
			name: "app_user_player_id_fkey"
		}),
	unique("app_user_username_key").on(table.username),
	check("app_user_role_check", sql`role = ANY (ARRAY['owner'::text, 'admin'::text, 'user'::text])`),
]);

export const teamFactor = pgTable("team_factor", {
	modelId: integer("model_id").notNull(),
	sizeDiff: integer("size_diff").notNull(),
	factor: numeric({ precision: 10, scale:  6 }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.modelId],
			foreignColumns: [ratingModel.modelId],
			name: "team_factor_model_id_fkey"
		}),
	primaryKey({ columns: [table.modelId, table.sizeDiff], name: "team_factor_pkey"}),
]);

export const matchParticipation = pgTable("match_participation", {
	matchTeamId: integer("match_team_id").notNull(),
	playerId: integer("player_id").notNull(),
	bonusBeer: integer("bonus_beer").default(0).notNull(),
	throws: integer(),
	hits: integer(),
}, (table) => [
	index("idx_participation_player").using("btree", table.playerId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.matchTeamId],
			foreignColumns: [matchTeam.matchTeamId],
			name: "match_participation_match_team_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.playerId],
			foreignColumns: [player.playerId],
			name: "match_participation_player_id_fkey"
		}),
	primaryKey({ columns: [table.matchTeamId, table.playerId], name: "match_participation_pkey"}),
	check("match_participation_bonus_beer_check", sql`(bonus_beer >= 0) AND (bonus_beer <= 10)`),
	check("match_participation_check", sql`(hits IS NULL) OR (throws IS NULL) OR (hits <= throws)`),
]);

export const playerRatingCurrent = pgTable("player_rating_current", {
	playerId: integer("player_id").notNull(),
	modelId: integer("model_id").notNull(),
	rating: numeric({ precision: 10, scale:  4 }).notNull(),
	gamesPlayed: integer("games_played").default(0).notNull(),
	wins: integer().default(0).notNull(),
	losses: integer().default(0).notNull(),
	draws: integer().default(0).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.playerId],
			foreignColumns: [player.playerId],
			name: "player_rating_current_player_id_fkey"
		}),
	foreignKey({
			columns: [table.modelId],
			foreignColumns: [ratingModel.modelId],
			name: "player_rating_current_model_id_fkey"
		}),
	primaryKey({ columns: [table.playerId, table.modelId], name: "player_rating_current_pkey"}),
]);
