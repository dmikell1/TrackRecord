import { injectable, inject, singleton } from 'tsyringe'

import { NotificationType } from '@packages/enums/notifications'
import { AthleteRepository } from '@packages/repositories/athlete/AthleteRepository'
import type { VideoCommentFilter } from '@packages/repositories/videoComment/VideoCommentRepository'
import { VideoCommentRepository } from '@packages/repositories/videoComment/VideoCommentRepository'
import { VideoRepository } from '@packages/repositories/video/VideoRepository'
import { TeamRepository } from '@packages/repositories/team/TeamRepository'
import { TrackRecordNotificationRepository } from '@packages/repositories/notification/TrackRecordNotificationRepository'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import type { AthleteInterface } from '@packages/types/athlete'
import type { TeamInterface } from '@packages/types/team'
import type { VideoInterface } from '@packages/types/video'
import type { VideoCommentInterface } from '@packages/types/videoComment'
import { formatTrackEventLabel } from '@packages/utils/formatTrackEventLabel'

@injectable()
@singleton()
@ReportErrors()
export class VideoCommentService {
	constructor(
		@inject(VideoCommentRepository) private videoCommentRepository: VideoCommentRepository,
		@inject(VideoRepository) private videoRepository: VideoRepository,
		@inject(AthleteRepository) private athleteRepository: AthleteRepository,
		@inject(TeamRepository) private teamRepository: TeamRepository,
		@inject(TrackRecordNotificationRepository) private notificationRepository: TrackRecordNotificationRepository,
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

		const comment = await this.videoCommentRepository.create({ data })

		const athlete =
			video.athleteId !== null && video.athleteId !== undefined
				? await this.athleteRepository.findOne({
						filter: { id: video.athleteId, teamId: video.teamId }
					})
				: null
		const team = await this.teamRepository.findOne({ filter: { id: video.teamId } })

		await this.notifyCommentRecipient({
			video,
			comment,
			athlete,
			team,
			commenterUserId: data.userId
		})

		return comment
	}

	private async notifyCommentRecipient({
		video,
		comment,
		athlete,
		team,
		commenterUserId
	}: {
		video: VideoInterface
		comment: VideoCommentInterface
		athlete: AthleteInterface | null
		team: TeamInterface | null
		commenterUserId: string
	}): Promise<void> {
		const eventLabel = formatTrackEventLabel({ event: video.event })
		const payload = {
			videoId: video.id,
			commentId: comment.id,
			athleteId: video.athleteId,
			event: video.event,
			...(athlete !== null && {
				athleteName: `${athlete.firstName} ${athlete.lastName}`
			})
		}

		const athleteCommented =
			athlete?.userId !== undefined &&
			athlete?.userId !== null &&
			athlete.userId === commenterUserId

		if (athleteCommented && athlete) {
			const coachUserId = team?.ownerId ?? null
			if (!coachUserId || coachUserId === commenterUserId) {
				return
			}

			await this.notificationRepository.create({
				data: {
					userId: coachUserId,
					teamId: video.teamId,
					type: NotificationType.Comment,
					text: `${athlete.firstName} ${athlete.lastName} commented on their ${eventLabel} video.`,
					payload
				}
			}).catch((error) => {
				this.reportingService.reportError({ error: error as Error })
			})
			return
		}

		const athleteUserId = athlete?.userId ?? null
		if (!athleteUserId || athleteUserId === commenterUserId) {
			return
		}

		await this.notificationRepository.create({
			data: {
				userId: athleteUserId,
				teamId: video.teamId,
				type: NotificationType.Comment,
				text: `Coach left a note on your ${eventLabel} video.`,
				payload
			}
		}).catch((error) => {
			this.reportingService.reportError({ error: error as Error })
		})
	}

	public async findVideoComments({ filter }: { filter: VideoCommentFilter }): Promise<VideoCommentInterface[]> {
		return this.videoCommentRepository.find({ filter })
	}

	public async deleteVideoComment({ filter }: { filter: VideoCommentFilter }): Promise<boolean> {
		return this.videoCommentRepository.delete({ filter })
	}
}
