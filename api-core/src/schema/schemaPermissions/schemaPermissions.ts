import { isDevelopment } from '@packages/utils/isDevelopment'
import { shield } from 'graphql-shield'
import { authorizationRules } from './authorizationRules'

export const permissions = {
	Query: {
		root: authorizationRules.withPublicAccess,
		me: authorizationRules.isClerkOrAppAuthenticated,
		// Track Record queries
		trainingSessions: authorizationRules.withTeamAccess,
		trainingSession: authorizationRules.withTeamAccess,
		athletes: authorizationRules.withTeamAccess,
		athlete: authorizationRules.withTeamAccess,
		athleteInviteLink: authorizationRules.withCoachAccess,
		videos: authorizationRules.withTeamAccess,
		video: authorizationRules.withTeamAccess,
		notifications: authorizationRules.withTeamAccess,
		athleteProgression: authorizationRules.withTeamAccess,
		athleteInvite: authorizationRules.withPublicAccess,
		joinInfo: authorizationRules.withPublicAccess,
		teamRecorders: authorizationRules.withCoachAccess
	},
	Mutation: {
		root: authorizationRules.withPublicAccess,
		syncCompanySubscription: authorizationRules.isClerkOrAppAuthenticated,
		deleteMyAccount: authorizationRules.isClerkOrAppAuthenticated,
		// Training Sessions (coach-only)
		createTrainingSession: authorizationRules.withCoachAccess,
		updateTrainingSession: authorizationRules.withCoachAccess,
		deleteTrainingSession: authorizationRules.withCoachAccess,
		// Athletes (coach-only)
		createAthlete: authorizationRules.withCoachAccess,
		bulkCreateAthletes: authorizationRules.withCoachAccess,
		updateAthlete: authorizationRules.withCoachAccess,
		deleteAthlete: authorizationRules.withCoachAccess,
		createAthleteInvite: authorizationRules.withCoachAccess,
		sendAthleteInviteEmail: authorizationRules.withCoachAccess,
		resendAthleteInvite: authorizationRules.withCoachAccess,
		acceptAthleteInvite: authorizationRules.isClerkOrAppAuthenticated,
		createRecorderInvite: authorizationRules.withCoachAccess,
		resendRecorderInvite: authorizationRules.withCoachAccess,
		acceptRecorderInvite: authorizationRules.isClerkOrAppAuthenticated,
		cancelRecorderInvite: authorizationRules.withCoachAccess,
		revokeRecorderAccess: authorizationRules.withCoachAccess,
		// Videos
		createVideo: authorizationRules.withTeamAccess,
		createRunningVideo: authorizationRules.withTeamAccess,
		updateVideo: authorizationRules.withTeamAccess,
		updateVideoPerformances: authorizationRules.withCoachAccess,
		deleteVideo: authorizationRules.withTeamAccess,
		moveVideos: authorizationRules.withCoachAccess,
		// Comments
		createVideoComment: authorizationRules.withTeamAccess,
		// Notifications
		markNotificationsRead: authorizationRules.withTeamAccess,
		markAllNotificationsRead: authorizationRules.withTeamAccess,
		// Settings (coach-only)
		updateTeam: authorizationRules.withCoachAccess,
		updateTeamSettings: authorizationRules.withCoachAccess,
		teamInviteLink: authorizationRules.withCoachAccess
	},
	Subscription: {
		root: authorizationRules.withPublicAccess
	}
}

// https://github.com/maticzav/graphql-shield
export const schemaPermissions = shield(permissions, {
	debug: isDevelopment,
	fallbackError: new Error(`You don't have permission to perform this action.`)
})
