import { injectable, inject, singleton } from 'tsyringe'

import { NotificationType } from '@packages/enums/notifications'
import { AthleteRepository } from '@packages/repositories/athlete/AthleteRepository'
import type { VideoCommentFilter } from '@packages/repositories/videoComment/VideoCommentRepository'
import { VideoCommentRepository } from '@packages/repositories/videoComment/VideoCommentRepository'
import { VideoRepository } from '@packages/repositories/video/VideoRepository'
import { VideoPerformanceRepository } from '@packages/repositories/videoPerformance/VideoPerformanceRepository'
import { TeamRepository } from '@packages/repositories/team/TeamRepository'
import { EntitlementService } from '@packages/services/billing/EntitlementService'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { TrackRecordNotificationService } from '@packages/services/notification/TrackRecordNotificationService'
import type { AthleteInterface } from '@packages/types/athlete'
import type { TeamInterface } from '@packages/types/team'
import type { VideoInterface } from '@packages/types/video'
import type { VideoCommentInterface } from '@packages/types/videoComment'
import { athleteCanInteract } from '@packages/utils/coppaAge'
import { formatTrackEventLabel } from '@packages/utils/formatTrackEventLabel'

@injectable()
@singleton()
@ReportErrors()
export class VideoCommentService {
	constructor(
		@inject(VideoCommentRepository) private videoCommentRepository: VideoCommentRepository,
		@inject(VideoRepository) private videoRepository: VideoRepository,
		@inject(VideoPerformanceRepository)
		private videoPerformanceRepository: VideoPerformanceRepository,
		@inject(AthleteRepository) private athleteRepository: AthleteRepository,
		@inject(TeamRepository) private teamRepository: TeamRepository,
		@inject(TrackRecordNotificationService)
		private trackRecordNotificationService: TrackRecordNotificationService,
		@inject(EntitlementService) private entitlementService: EntitlementService,
		@inject(ReportingService) private reportingService: ReportingService
	) {}

	public async createVideoComment({ data, teamId }: {
		data: Pick<VideoCommentInterface, 'videoId' | 'userId' | 'text'> &
			Partial<Pick<VideoCommentInterface, 'stampSeconds'>>
		teamId: string
	}): Promise<VideoCommentInterface> {
		const video = await this.videoRepository.findOne({
			filter: { id: data.videoId, teamId }
		})
		if (!video) {
			throw new Error('Video not found or does not belong to this team')
		}

		const team = await this.teamRepository.findOne({ filter: { id: teamId } })
		if (!team) {
			throw new Error('Team not found')
		}
		await this.entitlementService.assertCanWrite({ companyId: team.companyId })

		const commenterAthlete = await this.athleteRepository.findOne({
			filter: { teamId, userId: data.userId }
		})
		if (
			commenterAthlete &&
			!athleteCanInteract({
				parentalConsentStatus: commenterAthlete.parentalConsentStatus
			})
		) {
			throw new Error(
				'Parental consent is required before commenting. Ask a parent or guardian to approve your account.'
			)
		}

		const comment = await this.videoCommentRepository.create({ data })

		// Notify in the background so the mutation returns as soon as the comment is saved.
		void this.deliverCommentNotifications({
			video,
			comment,
			team,
			commenterUserId: data.userId
		}).catch(error => {
			this.reportingService.reportError({ error: error as Error })
		})

		return comment
	}

	private async deliverCommentNotifications({
		video,
		comment,
		team,
		commenterUserId
	}: {
		video: VideoInterface
		comment: VideoCommentInterface
		team: TeamInterface
		commenterUserId: string
	}): Promise<void> {
		const athletes = await this.resolveVideoAthletes({
			video,
			teamId: video.teamId
		})

		await this.notifyCommentRecipients({
			video,
			comment,
			athletes,
			team,
			commenterUserId
		})
	}

	private async resolveVideoAthletes({
		video,
		teamId
	}: {
		video: VideoInterface
		teamId: string
	}): Promise<AthleteInterface[]> {
		if (video.athleteId !== null && video.athleteId !== undefined) {
			const athlete = await this.athleteRepository.findOne({
				filter: { id: video.athleteId, teamId }
			})
			return athlete ? [athlete] : []
		}

		const performances = await this.videoPerformanceRepository.find({
			filter: { videoId: video.id, teamId }
		})
		const athleteIds = [...new Set(performances.map(performance => performance.athleteId))]
		const athletes: AthleteInterface[] = []

		for (const athleteId of athleteIds) {
			const athlete = await this.athleteRepository.findOne({
				filter: { id: athleteId, teamId }
			})
			if (athlete) {
				athletes.push(athlete)
			}
		}

		return athletes
	}

	private async notifyCommentRecipients({
		video,
		comment,
		athletes,
		team,
		commenterUserId
	}: {
		video: VideoInterface
		comment: VideoCommentInterface
		athletes: AthleteInterface[]
		team: TeamInterface | null
		commenterUserId: string
	}): Promise<void> {
		const eventLabel = formatTrackEventLabel({ event: video.event })
		const commenterAthlete =
			athletes.find(
				athlete =>
					athlete.userId !== null &&
					athlete.userId !== undefined &&
					athlete.userId === commenterUserId
			) ?? null

		if (commenterAthlete) {
			const coachUserId = team?.ownerId ?? null
			if (!coachUserId || coachUserId === commenterUserId) {
				return
			}

			await this.trackRecordNotificationService.createNotification({
				data: {
					userId: coachUserId,
					teamId: video.teamId,
					type: NotificationType.Comment,
					text: `${commenterAthlete.firstName} ${commenterAthlete.lastName} commented on their ${eventLabel} video.`,
					payload: {
						videoId: video.id,
						commentId: comment.id,
						athleteId: commenterAthlete.id,
						event: video.event,
						athleteName: `${commenterAthlete.firstName} ${commenterAthlete.lastName}`
					}
				}
			}).catch((error) => {
				this.reportingService.reportError({ error: error as Error })
			})
			return
		}

		for (const athlete of athletes) {
			const athleteUserId = athlete.userId ?? null
			if (!athleteUserId || athleteUserId === commenterUserId) {
				continue
			}

			await this.trackRecordNotificationService.createNotification({
				data: {
					userId: athleteUserId,
					teamId: video.teamId,
					type: NotificationType.Comment,
					text: `Coach left a note on your ${eventLabel} video.`,
					payload: {
						videoId: video.id,
						commentId: comment.id,
						athleteId: athlete.id,
						event: video.event,
						athleteName: `${athlete.firstName} ${athlete.lastName}`
					}
				}
			}).catch((error) => {
				this.reportingService.reportError({ error: error as Error })
			})
		}
	}

	public async findVideoComments({ filter }: { filter: VideoCommentFilter }): Promise<VideoCommentInterface[]> {
		return this.videoCommentRepository.find({ filter })
	}

	public async deleteVideoComment({ filter }: { filter: VideoCommentFilter }): Promise<boolean> {
		return this.videoCommentRepository.delete({ filter })
	}
}
