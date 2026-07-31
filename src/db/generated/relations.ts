import { relations } from "drizzle-orm/relations";
import { club, event, match, matchReferee, player, matchTeam, playerRefereeStats, ratingHistory, ratingModel, appUser, teamFactor, matchParticipation, playerRatingCurrent } from "./schema";

export const eventRelations = relations(event, ({one, many}) => ({
	club: one(club, {
		fields: [event.clubId],
		references: [club.clubId]
	}),
	matches: many(match),
}));

export const clubRelations = relations(club, ({many}) => ({
	events: many(event),
	players: many(player),
}));

export const matchRelations = relations(match, ({one, many}) => ({
	event: one(event, {
		fields: [match.eventId],
		references: [event.eventId]
	}),
	matchReferees: many(matchReferee),
	matchTeams: many(matchTeam),
	ratingHistories: many(ratingHistory),
}));

export const matchRefereeRelations = relations(matchReferee, ({one}) => ({
	match: one(match, {
		fields: [matchReferee.matchId],
		references: [match.matchId]
	}),
	player: one(player, {
		fields: [matchReferee.playerId],
		references: [player.playerId]
	}),
}));

export const playerRelations = relations(player, ({one, many}) => ({
	matchReferees: many(matchReferee),
	playerRefereeStats: many(playerRefereeStats),
	ratingHistories: many(ratingHistory),
	club: one(club, {
		fields: [player.clubId],
		references: [club.clubId]
	}),
	appUsers: many(appUser),
	matchParticipations: many(matchParticipation),
	playerRatingCurrents: many(playerRatingCurrent),
}));

export const matchTeamRelations = relations(matchTeam, ({one, many}) => ({
	match: one(match, {
		fields: [matchTeam.matchId],
		references: [match.matchId]
	}),
	matchParticipations: many(matchParticipation),
}));

export const playerRefereeStatsRelations = relations(playerRefereeStats, ({one}) => ({
	player: one(player, {
		fields: [playerRefereeStats.playerId],
		references: [player.playerId]
	}),
}));

export const ratingHistoryRelations = relations(ratingHistory, ({one}) => ({
	match: one(match, {
		fields: [ratingHistory.matchId],
		references: [match.matchId]
	}),
	player: one(player, {
		fields: [ratingHistory.playerId],
		references: [player.playerId]
	}),
	ratingModel: one(ratingModel, {
		fields: [ratingHistory.modelId],
		references: [ratingModel.modelId]
	}),
}));

export const ratingModelRelations = relations(ratingModel, ({many}) => ({
	ratingHistories: many(ratingHistory),
	teamFactors: many(teamFactor),
	playerRatingCurrents: many(playerRatingCurrent),
}));

export const appUserRelations = relations(appUser, ({one}) => ({
	player: one(player, {
		fields: [appUser.playerId],
		references: [player.playerId]
	}),
}));

export const teamFactorRelations = relations(teamFactor, ({one}) => ({
	ratingModel: one(ratingModel, {
		fields: [teamFactor.modelId],
		references: [ratingModel.modelId]
	}),
}));

export const matchParticipationRelations = relations(matchParticipation, ({one}) => ({
	matchTeam: one(matchTeam, {
		fields: [matchParticipation.matchTeamId],
		references: [matchTeam.matchTeamId]
	}),
	player: one(player, {
		fields: [matchParticipation.playerId],
		references: [player.playerId]
	}),
}));

export const playerRatingCurrentRelations = relations(playerRatingCurrent, ({one}) => ({
	player: one(player, {
		fields: [playerRatingCurrent.playerId],
		references: [player.playerId]
	}),
	ratingModel: one(ratingModel, {
		fields: [playerRatingCurrent.modelId],
		references: [ratingModel.modelId]
	}),
}));