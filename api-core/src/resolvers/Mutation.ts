import { createTrainingSession } from '@api-core/src/resolvers/mutations/trainingSession/createTrainingSession'
import { updateTrainingSession } from '@api-core/src/resolvers/mutations/trainingSession/updateTrainingSession'
import { deleteTrainingSession } from '@api-core/src/resolvers/mutations/trainingSession/deleteTrainingSession'
import { bulkCreateAthletes } from '@api-core/src/resolvers/mutations/athlete/bulkCreateAthletes'
import { createAthlete } from '@api-core/src/resolvers/mutations/athlete/createAthlete'
import { updateAthlete } from '@api-core/src/resolvers/mutations/athlete/updateAthlete'
import { deleteAthlete } from '@api-core/src/resolvers/mutations/athlete/deleteAthlete'
import { createAthleteInvite } from '@api-core/src/resolvers/mutations/athlete/createAthleteInvite'
import { acceptAthleteInvite } from '@api-core/src/resolvers/mutations/athlete/acceptAthleteInvite'
import { sendAthleteInviteEmail } from '@api-core/src/resolvers/mutations/athlete/sendAthleteInviteEmail'
import { resendAthleteInvite } from '@api-core/src/resolvers/mutations/athlete/resendAthleteInvite'
import { grantParentalConsent } from '@api-core/src/resolvers/mutations/athlete/grantParentalConsent'
import { resendParentalConsentEmail } from '@api-core/src/resolvers/mutations/athlete/resendParentalConsentEmail'
import { acceptRecorderInvite } from '@api-core/src/resolvers/mutations/recorder/acceptRecorderInvite'
import { cancelRecorderInvite } from '@api-core/src/resolvers/mutations/recorder/cancelRecorderInvite'
import { createRecorderInvite } from '@api-core/src/resolvers/mutations/recorder/createRecorderInvite'
import { resendRecorderInvite } from '@api-core/src/resolvers/mutations/recorder/resendRecorderInvite'
import { revokeRecorderAccess } from '@api-core/src/resolvers/mutations/recorder/revokeRecorderAccess'
import { createVideo } from '@api-core/src/resolvers/mutations/video/createVideo'
import { createRunningVideo } from '@api-core/src/resolvers/mutations/video/createRunningVideo'
import { updateVideo } from '@api-core/src/resolvers/mutations/video/updateVideo'
import { updateVideoPerformances } from '@api-core/src/resolvers/mutations/video/updateVideoPerformances'
import { deleteVideo } from '@api-core/src/resolvers/mutations/video/deleteVideo'
import { moveVideos } from '@api-core/src/resolvers/mutations/video/moveVideos'
import { createVideoComment } from '@api-core/src/resolvers/mutations/videoComment/createVideoComment'
import { markNotificationsRead } from '@api-core/src/resolvers/mutations/notification/markNotificationsRead'
import { markAllNotificationsRead } from '@api-core/src/resolvers/mutations/notification/markAllNotificationsRead'
import { updateTeam } from '@api-core/src/resolvers/mutations/team/updateTeam'
import { updateTeamSettings } from '@api-core/src/resolvers/mutations/team/updateTeamSettings'
import { teamInviteLink } from '@api-core/src/resolvers/mutations/team/teamInviteLink'
import { syncCompanySubscription } from '@api-core/src/resolvers/mutations/billing/syncCompanySubscription'
import { deleteMyAccount } from '@api-core/src/resolvers/mutations/user/deleteMyAccount'

const Mutation = {
	syncCompanySubscription,
	deleteMyAccount,
	createTrainingSession,
	updateTrainingSession,
	deleteTrainingSession,
	createAthlete,
	bulkCreateAthletes,
	updateAthlete,
	deleteAthlete,
	createAthleteInvite,
	acceptAthleteInvite,
	sendAthleteInviteEmail,
	resendAthleteInvite,
	grantParentalConsent,
	resendParentalConsentEmail,
	createRecorderInvite,
	resendRecorderInvite,
	acceptRecorderInvite,
	cancelRecorderInvite,
	revokeRecorderAccess,
	createVideo,
	createRunningVideo,
	updateVideo,
	updateVideoPerformances,
	deleteVideo,
	moveVideos,
	createVideoComment,
	markNotificationsRead,
	markAllNotificationsRead,
	updateTeam,
	updateTeamSettings,
	teamInviteLink
}

export { Mutation }
