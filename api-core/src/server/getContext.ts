import { container } from 'tsyringe'

import { CompanyService } from '@packages/services/company/CompanyService'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { TeamService } from '@packages/services/team/TeamService'
import { UserService } from '@packages/services/user/UserService'
import { AthleteService } from '@packages/services/athlete/AthleteService'
import { TrainingSessionService } from '@packages/services/trainingSession/TrainingSessionService'
import { VideoService } from '@packages/services/video/VideoService'
import { VideoCommentService } from '@packages/services/videoComment/VideoCommentService'
import { TrackRecordNotificationService } from '@packages/services/notification/TrackRecordNotificationService'
import { AthleteInviteService } from '@packages/services/athleteInvite/AthleteInviteService'
import { Context } from '@packages/types'

export const getContext = (): Omit<Context, 'req' | 'res'> => {
	const userService = container.resolve(UserService)
	const teamService = container.resolve(TeamService)
	const companyService = container.resolve(CompanyService)
	const reportingService = container.resolve(ReportingService)
	const athleteService = container.resolve(AthleteService)
	const trainingSessionService = container.resolve(TrainingSessionService)
	const videoService = container.resolve(VideoService)
	const videoCommentService = container.resolve(VideoCommentService)
	const trackRecordNotificationService = container.resolve(TrackRecordNotificationService)
	const athleteInviteService = container.resolve(AthleteInviteService)

	return {
		userService,
		teamService,
		companyService,
		reportingService,
		athleteService,
		trainingSessionService,
		videoService,
		videoCommentService,
		trackRecordNotificationService,
		athleteInviteService
	}
}
