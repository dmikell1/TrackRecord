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

const Mutation = {
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
