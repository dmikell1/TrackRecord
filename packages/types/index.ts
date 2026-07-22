import { Response } from 'express'

import { CompanyService } from '@packages/services/company/CompanyService'
import { TeamService } from '@packages/services/team/TeamService'
import { UserService } from '@packages/services/user/UserService'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { AthleteService } from '@packages/services/athlete/AthleteService'
import { TrainingSessionService } from '@packages/services/trainingSession/TrainingSessionService'
import { VideoService } from '@packages/services/video/VideoService'
import { VideoCommentService } from '@packages/services/videoComment/VideoCommentService'
import { TrackRecordNotificationService } from '@packages/services/notification/TrackRecordNotificationService'
import { AthleteInviteService } from '@packages/services/athleteInvite/AthleteInviteService'
import { RecorderInviteService } from '@packages/services/recorderInvite/RecorderInviteService'
import type { UserInterface } from '@packages/types/user'

export interface Context {
	req: {
		/** Set by setUserIdFromToken — preferred over session for Bearer auth. */
		authClerkId?: string
		authUserId?: string
		session: {
			userId: string
			user: UserInterface
			clerkId?: string
			emailVerified?: boolean
		}
	}
	res: Response
	userService: UserService
	teamService: TeamService
	companyService: CompanyService
	reportingService: ReportingService
	athleteService: AthleteService
	trainingSessionService: TrainingSessionService
	videoService: VideoService
	videoCommentService: VideoCommentService
	trackRecordNotificationService: TrackRecordNotificationService
	athleteInviteService: AthleteInviteService
	recorderInviteService: RecorderInviteService
}

export type { UserInterface } from './user'
export type {
	CompanyInterface,
	CompanySettingsInterface,
	CompanySubscriptionEntitlements
} from './company'
export type { TeamInterface } from './team'
export type { AthleteInterface, ParentalConsentInfoInterface } from './athlete'
export type { TrainingSessionInterface } from './trainingSession'
export type { VideoInterface, VideoResult } from './video'
export type { VideoCommentInterface } from './videoComment'
export type { TrackRecordNotificationInterface } from './trackRecordNotification'
export type { AthleteInviteInterface } from './athleteInvite'
export type { RecorderInviteInterface } from './recorderInvite'
export type { TeamRecorderEntryInterface } from './teamRecorder'
export type { JoinInfoInterface } from './join'
export type { AIEngine, AIModel, AIMessage } from './ai'
export { AIInteractionType } from './AIInteraction'
