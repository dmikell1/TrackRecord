import { injectable, inject, singleton } from 'tsyringe'

import { isTimedEvent } from '@packages/constants/trackEventCatalog'
import { SessionType } from '@packages/enums'
import { TrainingSessionRepository } from '@packages/repositories/trainingSession/TrainingSessionRepository'
import type { VideoFilter } from '@packages/repositories/video/VideoRepository'
import { VideoRepository } from '@packages/repositories/video/VideoRepository'
import { VideoPerformanceRepository } from '@packages/repositories/videoPerformance/VideoPerformanceRepository'
import { EntitlementService } from '@packages/services/billing/EntitlementService'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import type { VideoInterface, VideoResult } from '@packages/types/video'
import type { VideoPerformanceInterface } from '@packages/types/videoPerformance'

import {
	pickPRPerformanceFromChronologicalAttempts,
	pickPRVideoIdFromChronologicalAttempts
} from './recalculateAthleteEventPRFlags'
import {
	getBestComparableValue,
	getComparableResultValue,
	isBetterResult
} from './videoResultUtils'

function getSessionProgressionLabel({
	videos
}: {
	videos: VideoInterface[]
}): string {
	const hasClearedMark = videos.some(
		video => getComparableResultValue({ result: video.result }) !== null
	)

	if (hasClearedMark) {
		return ''
	}

	const hasResult = videos.some(
		video => video.result !== null && video.result !== undefined
	)
	if (!hasResult) {
		return '—'
	}

	const allFouls = videos.every(
		video =>
			video.result === null ||
			video.result === undefined ||
			video.result.type === 'Foul' ||
			video.result.type === 'DNF' ||
			video.result.type === 'DQ'
	)

	return allFouls ? 'Foul' : 'NH'
}

@injectable()
@singleton()
@ReportErrors()
export class VideoService {
	constructor(
		@inject(VideoRepository) private videoRepository: VideoRepository,
		@inject(VideoPerformanceRepository)
		private videoPerformanceRepository: VideoPerformanceRepository,
		@inject(TrainingSessionRepository)
		private trainingSessionRepository: TrainingSessionRepository,
		@inject(EntitlementService)
		private entitlementService: EntitlementService,
		@inject(ReportingService) private reportingService: ReportingService
	) {}

	private async getMeetSessionIds({
		teamId
	}: {
		teamId: string
	}): Promise<Set<string>> {
		const meetSessions = await this.trainingSessionRepository.find({
			filter: { teamId, type: SessionType.Meet }
		})

		return new Set(meetSessions.map(session => session.id))
	}

	private async clearPreviousPRFlags({
		teamId,
		athleteId,
		event
	}: {
		teamId: string
		athleteId: string
		event: string
	}): Promise<void> {
		await this.videoRepository.clearPRForAthleteEvent({
			athleteId,
			event,
			teamId
		})
		await this.videoPerformanceRepository.clearPRForAthleteEvent({
			athleteId,
			event,
			teamId
		})
	}

	private async clearRunningVideoPRFlagsForAthleteEvent({
		teamId,
		athleteId,
		event
	}: {
		teamId: string
		athleteId: string
		event: string
	}): Promise<void> {
		const performances = await this.videoPerformanceRepository.find({
			filter: { athleteId, event, teamId }
		})
		const videoIds = [...new Set(performances.map(performance => performance.videoId))]

		await Promise.all(
			videoIds.map(videoId =>
				this.videoRepository.update({
					filter: { id: videoId, teamId },
					data: { isPR: false }
				})
			)
		)
	}

	private async recalculatePRFlagsForAthleteEvent({
		teamId,
		athleteId,
		event
	}: {
		teamId: string
		athleteId: string
		event: string
	}): Promise<void> {
		await this.clearPreviousPRFlags({ teamId, athleteId, event })

		const meetSessionIds = await this.getMeetSessionIds({ teamId })

		if (isTimedEvent({ event })) {
			await this.clearRunningVideoPRFlagsForAthleteEvent({
				teamId,
				athleteId,
				event
			})

			const performances = await this.videoPerformanceRepository.find({
				filter: { athleteId, event, teamId }
			})
			const performanceVideoIds = [
				...new Set(performances.map(performance => performance.videoId))
			]
			const performanceVideos =
				performanceVideoIds.length > 0
					? await this.videoRepository.findByIds({
							ids: performanceVideoIds,
							teamId
						})
					: []
			const meetVideosById = new Map(
				performanceVideos
					.filter(video => meetSessionIds.has(video.sessionId))
					.map(video => [video.id, video])
			)

			const attempts = performances
				.map(performance => {
					const video = meetVideosById.get(performance.videoId)
					if (video === undefined) {
						return null
					}

					const value = getComparableResultValue({ result: performance.result })
					if (value === null) {
						return null
					}

					return {
						performanceId: performance.id,
						videoId: performance.videoId,
						sortDate: video.recordedAt ?? video.createdAt,
						value
					}
				})
				.filter(
					(
						attempt
					): attempt is {
						performanceId: string
						videoId: string
						sortDate: Date
						value: number
					} => attempt !== null
				)

			const prPerformance = pickPRPerformanceFromChronologicalAttempts({
				attempts,
				event
			})

			if (prPerformance === null) {
				return
			}

			await this.videoPerformanceRepository.update({
				filter: { id: prPerformance.performanceId, teamId },
				data: { isPR: true }
			})
			await this.videoRepository.update({
				filter: { id: prPerformance.videoId, teamId },
				data: { isPR: true }
			})

			return
		}

		const fieldVideos = (
			await this.videoRepository.find({
				filter: { athleteId, event, teamId }
			})
		).filter(video => meetSessionIds.has(video.sessionId))

		const attempts = fieldVideos
			.map(video => {
				const value = getComparableResultValue({ result: video.result })
				if (value === null) {
					return null
				}

				return {
					videoId: video.id,
					sortDate: video.recordedAt ?? video.createdAt,
					value
				}
			})
			.filter(
				(
					attempt
				): attempt is { videoId: string; sortDate: Date; value: number } =>
					attempt !== null
			)

		const prVideoId = pickPRVideoIdFromChronologicalAttempts({
			attempts,
			event
		})

		if (prVideoId === null) {
			return
		}

		await this.videoRepository.update({
			filter: { id: prVideoId, teamId },
			data: { isPR: true }
		})
	}

	private async refreshPRAfterTaggedChange({
		teamId,
		sessionId,
		athleteId,
		event
	}: {
		teamId: string
		sessionId: string
		athleteId: string
		event: string
	}): Promise<void> {
		const isPractice = await this.isPracticeSession({ sessionId })
		if (isPractice) {
			return
		}

		await this.recalculatePRFlagsForAthleteEvent({
			teamId,
			athleteId,
			event
		})
	}

	private async isPracticeSession({
		sessionId
	}: {
		sessionId: string
	}): Promise<boolean> {
		const session = await this.trainingSessionRepository.findOne({
			filter: { id: sessionId }
		})

		return session?.type === SessionType.Practice
	}

	private async assertCompanyCanWriteForSession({
		sessionId,
		teamId
	}: {
		sessionId: string
		teamId: string
	}): Promise<void> {
		const session = await this.trainingSessionRepository.findOne({
			filter: { id: sessionId, teamId }
		})
		if (!session) {
			throw new Error('Training session not found')
		}
		await this.entitlementService.assertCanWrite({
			companyId: session.companyId
		})
	}

	public async createVideo({
		data
	}: {
		data: Pick<VideoInterface, 'sessionId' | 'teamId' | 'videoUrl' | 'orientation'> &
			Partial<
				Pick<
					VideoInterface,
					| 'athleteId'
					| 'event'
					| 'result'
					| 'thumbUrl'
					| 'durationMs'
					| 'recordedAt'
				>
			>
	}): Promise<VideoInterface> {
		await this.assertCompanyCanWriteForSession({
			sessionId: data.sessionId,
			teamId: data.teamId
		})

		if (data.event && isTimedEvent({ event: data.event })) {
			throw new Error('Use createRunningVideo for timed events')
		}

		const video = await this.videoRepository.create({
			data: { ...data, isPR: false }
		})

		if (
			data.athleteId !== null &&
			data.athleteId !== undefined &&
			data.event !== null &&
			data.event !== undefined
		) {
			await this.refreshPRAfterTaggedChange({
				teamId: data.teamId,
				sessionId: data.sessionId,
				athleteId: data.athleteId,
				event: data.event
			})

			const refreshed = await this.videoRepository.findOne({
				filter: { id: video.id, teamId: data.teamId }
			})

			return refreshed ?? video
		}

		return video
	}

	public async createRunningVideo({
		data
	}: {
		data: Pick<VideoInterface, 'sessionId' | 'teamId' | 'videoUrl' | 'orientation'> &
			Partial<Pick<VideoInterface, 'event' | 'thumbUrl' | 'durationMs' | 'recordedAt'>> & {
				performances: Array<{
					athleteId: string
					result: VideoResult | null | undefined
				}>
			}
	}): Promise<VideoInterface> {
		await this.assertCompanyCanWriteForSession({
			sessionId: data.sessionId,
			teamId: data.teamId
		})

		const isPractice = await this.isPracticeSession({
			sessionId: data.sessionId
		})

		if (data.event && !isTimedEvent({ event: data.event })) {
			throw new Error('Running videos require a timed event')
		}

		if (!isPractice) {
			if (!data.event || !isTimedEvent({ event: data.event })) {
				throw new Error('Running videos require a timed event')
			}

			if (data.performances.length === 0) {
				throw new Error('Add at least one athlete result')
			}
		}

		if (data.performances.length > 0) {
			const athleteIds = data.performances.map(
				performance => performance.athleteId
			)
			if (new Set(athleteIds).size !== athleteIds.length) {
				throw new Error('Each athlete can only appear once per video')
			}

			if (!isPractice) {
				for (const performance of data.performances) {
					if (
						performance.result === null ||
						performance.result === undefined
					) {
						throw new Error('Add at least one athlete result')
					}
				}
			}
		}

		if (data.performances.length === 0) {
			const video = await this.videoRepository.create({
				data: {
					sessionId: data.sessionId,
					teamId: data.teamId,
					videoUrl: data.videoUrl,
					orientation: data.orientation,
					event: data.event ?? null,
					thumbUrl: data.thumbUrl,
					durationMs: data.durationMs,
					recordedAt: data.recordedAt,
					isPR: false
				}
			})

			return { ...video, performances: [] }
		}

		const performancesWithPR = data.performances.map(performance => ({
			...performance,
			isPR: false
		}))

		const video = await this.videoRepository.create({
			data: {
				sessionId: data.sessionId,
				teamId: data.teamId,
				videoUrl: data.videoUrl,
				orientation: data.orientation,
				event: data.event ?? null,
				thumbUrl: data.thumbUrl,
				durationMs: data.durationMs,
				recordedAt: data.recordedAt,
				isPR: false
			}
		})

		const performances = await this.videoPerformanceRepository.createMany({
			performances: performancesWithPR.map(performance => ({
				videoId: video.id,
				teamId: data.teamId,
				athleteId: performance.athleteId,
				event: data.event ?? null,
				result: performance.result ?? null,
				isPR: performance.isPR
			}))
		})

		if (!isPractice && data.event !== null && data.event !== undefined) {
			const athleteIds = [
				...new Set(data.performances.map(performance => performance.athleteId))
			]

			await Promise.all(
				athleteIds.map(athleteId =>
					this.refreshPRAfterTaggedChange({
						teamId: data.teamId,
						sessionId: data.sessionId,
						athleteId,
						event: data.event!
					})
				)
			)

			const refreshedVideo = await this.videoRepository.findOne({
				filter: { id: video.id, teamId: data.teamId }
			})
			const refreshedPerformances = await this.videoPerformanceRepository.find({
				filter: { videoId: video.id, teamId: data.teamId }
			})

			return {
				...(refreshedVideo ?? video),
				performances: refreshedPerformances
			}
		}

		return { ...video, performances }
	}

	public async updateVideoPerformances({
		videoId,
		teamId,
		event,
		performances
	}: {
		videoId: string
		teamId: string
		event?: string | null
		performances: Array<{
			athleteId: string
			result: VideoResult | null | undefined
		}>
	}): Promise<VideoInterface> {
		const existing = await this.findVideoOrFail({
			filter: { id: videoId, teamId }
		})

		await this.assertCompanyCanWriteForSession({
			sessionId: existing.sessionId,
			teamId
		})

		const isPractice = await this.isPracticeSession({
			sessionId: existing.sessionId
		})

		if (event && !isTimedEvent({ event })) {
			throw new Error('Performances are only supported for timed events')
		}

		if (!isPractice) {
			if (!event || !isTimedEvent({ event })) {
				throw new Error('Performances are only supported for timed events')
			}

			if (performances.length === 0) {
				throw new Error('Add at least one athlete result')
			}
		}

		if (performances.length > 0) {
			const athleteIds = performances.map(performance => performance.athleteId)
			if (new Set(athleteIds).size !== athleteIds.length) {
				throw new Error('Each athlete can only appear once per video')
			}

			if (!isPractice) {
				for (const performance of performances) {
					if (
						performance.result === null ||
						performance.result === undefined
					) {
						throw new Error('Add at least one athlete result')
					}
				}
			}
		}

		if (performances.length === 0) {
			await this.videoRepository.update({
				filter: { id: videoId, teamId },
				data: {
					event: event ?? null,
					athleteId: null,
					result: null,
					isPR: false
				}
			})
			await this.videoPerformanceRepository.deleteByVideoId({
				videoId,
				teamId
			})

			return {
				...existing,
				event: event ?? null,
				athleteId: null,
				result: null,
				isPR: false,
				performances: []
			}
		}

		const performancesWithPR = performances.map(performance => ({
			...performance,
			isPR: false
		}))

		await this.videoRepository.update({
			filter: { id: videoId, teamId },
			data: {
				event: event ?? null,
				athleteId: null,
				result: null,
				isPR: false
			}
		})

		const savedPerformances = await this.videoPerformanceRepository.replaceForVideo({
			videoId,
			teamId,
			performances: performancesWithPR.map(performance => ({
				athleteId: performance.athleteId,
				event: event ?? null,
				result: performance.result ?? null,
				isPR: performance.isPR
			}))
		})

		if (!isPractice && event !== null && event !== undefined) {
			const athleteIds = [
				...new Set(performances.map(performance => performance.athleteId))
			]

			await Promise.all(
				athleteIds.map(athleteId =>
					this.refreshPRAfterTaggedChange({
						teamId,
						sessionId: existing.sessionId,
						athleteId,
						event
					})
				)
			)

			const refreshedVideo = await this.videoRepository.findOne({
				filter: { id: videoId, teamId }
			})
			const refreshedPerformances = await this.videoPerformanceRepository.find({
				filter: { videoId, teamId }
			})

			return {
				...(refreshedVideo ?? existing),
				event: event ?? null,
				athleteId: null,
				result: null,
				isPR: refreshedVideo?.isPR ?? false,
				performances: refreshedPerformances
			}
		}

		return {
			...existing,
			event: event ?? null,
			athleteId: null,
			result: null,
			isPR: false,
			performances: savedPerformances
		}
	}

	public async findVideo({
		filter,
		loadComments,
		loadPerformances
	}: {
		filter: VideoFilter
		loadComments?: boolean
		loadPerformances?: boolean
	}): Promise<VideoInterface | null> {
		const video = await this.videoRepository.findOne({ filter, loadComments })
		if (!video) {
			return null
		}

		if (!loadPerformances) {
			return video
		}

		const performances = await this.videoPerformanceRepository.find({
			filter: { videoId: video.id, teamId: video.teamId }
		})

		return { ...video, performances }
	}

	public async findVideoOrFail({
		filter,
		loadPerformances
	}: {
		filter: VideoFilter
		loadPerformances?: boolean
	}): Promise<VideoInterface> {
		const video = await this.findVideo({ filter, loadPerformances })
		if (!video) {
			const error = new Error(`No video found with filter: ${JSON.stringify(filter)}`)
			this.reportingService.reportError({ error })
			throw error
		}
		return video
	}

	public async reconcilePRFlagsForAthlete({
		teamId,
		athleteId
	}: {
		teamId: string
		athleteId: string
	}): Promise<void> {
		const directVideos = await this.videoRepository.find({
			filter: { athleteId, teamId }
		})
		const performances = await this.videoPerformanceRepository.find({
			filter: { athleteId, teamId }
		})
		const events = new Set(
			[
				...directVideos.map(video => video.event),
				...performances.map(performance => performance.event)
			].filter((event): event is string => event !== null && event !== undefined)
		)

		await Promise.all(
			[...events].map(event =>
				this.recalculatePRFlagsForAthleteEvent({
					teamId,
					athleteId,
					event
				})
			)
		)
	}

	private async attachPerformancesToVideos({
		videos: videoList,
		teamId
	}: {
		videos: VideoInterface[]
		teamId: string
	}): Promise<VideoInterface[]> {
		if (videoList.length === 0) {
			return videoList
		}

		const performances =
			await this.videoPerformanceRepository.findByVideoIds({
				videoIds: videoList.map(video => video.id),
				teamId
			})

		const performancesByVideoId = new Map<string, VideoPerformanceInterface[]>()
		for (const performance of performances) {
			const existing = performancesByVideoId.get(performance.videoId) ?? []
			existing.push(performance)
			performancesByVideoId.set(performance.videoId, existing)
		}

		return videoList.map(video => ({
			...video,
			performances: performancesByVideoId.get(video.id) ?? []
		}))
	}

	public async findVideos({ filter }: { filter: VideoFilter }): Promise<VideoInterface[]> {
		if (filter.athleteId) {
			const teamId = filter.teamId!
			const performanceVideoIds =
				await this.videoPerformanceRepository.findVideoIdsByAthlete({
					athleteId: filter.athleteId,
					teamId,
					...(filter.event !== undefined && { event: filter.event })
				})

			const directVideos = await this.videoRepository.find({
				filter: {
					...filter,
					athleteId: filter.athleteId
				}
			})

			if (performanceVideoIds.length === 0) {
				return this.attachPerformancesToVideos({
					videos: directVideos,
					teamId
				})
			}

			const performanceVideosRaw = await this.videoRepository.findByIds({
				ids: performanceVideoIds,
				teamId
			})

			const performanceVideos = performanceVideosRaw.filter(
				video =>
					filter.sessionId === undefined ||
					video.sessionId === filter.sessionId
			)

			const performanceVideoIdSet = new Set(performanceVideoIds)
			const merged = new Map<string, VideoInterface>()
			for (const video of [...directVideos, ...performanceVideos]) {
				if (
					performanceVideoIdSet.has(video.id) ||
					video.athleteId === filter.athleteId
				) {
					merged.set(video.id, video)
				}
			}

			return this.attachPerformancesToVideos({
				videos: [...merged.values()],
				teamId
			})
		}

		const videos = await this.videoRepository.find({ filter })
		if (filter.teamId === undefined) {
			return videos
		}

		return this.attachPerformancesToVideos({
			videos,
			teamId: filter.teamId
		})
	}

	public async countBySession({
		sessionId,
		teamId
	}: {
		sessionId: string
		teamId: string
	}): Promise<number> {
		return this.videoRepository.count({
			filter: { sessionId, teamId }
		})
	}

	public async countBySessionIds({
		sessionIds,
		teamId
	}: {
		sessionIds: string[]
		teamId: string
	}): Promise<Map<string, number>> {
		return this.videoRepository.countBySessionIds({ sessionIds, teamId })
	}

	public async updateVideo({
		filter,
		data
	}: {
		filter: VideoFilter
		data: Partial<
			Pick<
				VideoInterface,
				| 'athleteId'
				| 'event'
				| 'result'
				| 'videoUrl'
				| 'thumbUrl'
				| 'durationMs'
			>
		>
	}): Promise<VideoInterface | null> {
		const existing = filter.id
			? await this.videoRepository.findOne({ filter })
			: null

		if (existing) {
			await this.assertCompanyCanWriteForSession({
				sessionId: existing.sessionId,
				teamId: existing.teamId
			})
		}

		if (existing && data.event && isTimedEvent({ event: data.event })) {
			throw new Error('Use updateVideoPerformances for timed events')
		}

		const taggingChanged =
			data.result !== undefined ||
			data.athleteId !== undefined ||
			data.event !== undefined
		const previousAthleteId = existing?.athleteId
		const previousEvent = existing?.event

		const updated = await this.videoRepository.update({
			filter,
			data: {
				...data,
				...(existing !== null && taggingChanged && { isPR: false })
			}
		})

		if (existing !== null && updated !== null && taggingChanged) {
			const nextAthleteId =
				data.athleteId !== undefined ? data.athleteId : existing.athleteId
			const nextEvent = data.event !== undefined ? data.event : existing.event

			if (
				previousAthleteId !== null &&
				previousAthleteId !== undefined &&
				previousEvent !== null &&
				previousEvent !== undefined &&
				(previousAthleteId !== nextAthleteId || previousEvent !== nextEvent)
			) {
				await this.refreshPRAfterTaggedChange({
					teamId: existing.teamId,
					sessionId: existing.sessionId,
					athleteId: previousAthleteId,
					event: previousEvent
				})
			}

			if (
				nextAthleteId !== null &&
				nextAthleteId !== undefined &&
				nextEvent !== null &&
				nextEvent !== undefined
			) {
				await this.refreshPRAfterTaggedChange({
					teamId: existing.teamId,
					sessionId: existing.sessionId,
					athleteId: nextAthleteId,
					event: nextEvent
				})

				const refreshed = await this.videoRepository.findOne({ filter })
				return refreshed ?? updated
			}
		}

		return updated
	}

	public async deleteVideo({ filter }: { filter: VideoFilter }): Promise<boolean> {
		const existing =
			filter.id !== undefined && filter.teamId !== undefined
				? await this.videoRepository.findOne({ filter })
				: null
		const performances =
			filter.id !== undefined && filter.teamId !== undefined
				? await this.videoPerformanceRepository.find({
						filter: { videoId: filter.id, teamId: filter.teamId }
					})
				: []

		if (filter.id && filter.teamId) {
			await this.videoPerformanceRepository.deleteByVideoId({
				videoId: filter.id,
				teamId: filter.teamId
			})
		}

		const deleted = await this.videoRepository.delete({ filter })

		if (deleted && existing !== null) {
			if (
				existing.athleteId !== null &&
				existing.athleteId !== undefined &&
				existing.event !== null &&
				existing.event !== undefined
			) {
				await this.refreshPRAfterTaggedChange({
					teamId: existing.teamId,
					sessionId: existing.sessionId,
					athleteId: existing.athleteId,
					event: existing.event
				})
			}

			await Promise.all(
				performances.map(performance =>
					performance.event !== null && performance.event !== undefined
						? this.refreshPRAfterTaggedChange({
								teamId: performance.teamId,
								sessionId: existing.sessionId,
								athleteId: performance.athleteId,
								event: performance.event
							})
						: Promise.resolve()
				)
			)
		}

		return deleted
	}

	public async moveVideos({
		ids,
		sessionId,
		teamId
	}: {
		ids: string[]
		sessionId: string
		teamId: string
	}): Promise<VideoInterface[]> {
		return this.videoRepository.moveToSession({ ids, sessionId, teamId })
	}

	public async getPerformancesForVideo({
		videoId,
		teamId
	}: {
		videoId: string
		teamId: string
	}): Promise<VideoPerformanceInterface[]> {
		return this.videoPerformanceRepository.find({
			filter: { videoId, teamId }
		})
	}

	public async getAthleteProgression({
		athleteId,
		event,
		teamId,
		startDate,
		endDate
	}: {
		athleteId: string
		event: string
		teamId: string
		startDate?: Date
		endDate?: Date
	}): Promise<{
		points: Array<{
			date: Date
			bestResult: number | null
			label: string
			sessionId: string
			sessionName: string
		}>
		stats: {
			pr: number | null
			recentResult: number | null
			totalAttempts: number
			prDate: Date | null
		}
	}> {
		const [meetSessions, fieldVideos, performances] = await Promise.all([
			this.trainingSessionRepository.find({
				filter: { teamId, type: SessionType.Meet }
			}),
			this.videoRepository.find({
				filter: { athleteId, event, teamId },
				includeCommentCounts: false
			}),
			this.videoPerformanceRepository.find({
				filter: { athleteId, event, teamId }
			})
		])
		const meetSessionById = new Map(
			meetSessions.map(session => [session.id, session])
		)

		const performanceVideoIds = [
			...new Set(performances.map(performance => performance.videoId))
		]
		const runningVideos = await this.videoRepository.findByIds({
			ids: performanceVideoIds,
			teamId
		})
		const runningVideoById = new Map(
			runningVideos.map(video => [video.id, video])
		)

		type AttemptEntry = {
			sessionId: string
			createdAt: Date
			value: number | null
			result: VideoResult | null
		}

		const attempts: AttemptEntry[] = [
			...fieldVideos.map(video => ({
				sessionId: video.sessionId,
				createdAt: video.createdAt,
				value: getComparableResultValue({ result: video.result }),
				result: video.result
			})),
			...performances.map(performance => ({
				sessionId:
					runningVideoById.get(performance.videoId)?.sessionId ??
					performance.videoId,
				createdAt:
					runningVideoById.get(performance.videoId)?.createdAt ??
					performance.createdAt,
				value: getComparableResultValue({ result: performance.result }),
				result: performance.result
			}))
		]

		const filtered = attempts.filter(attempt => {
			if (!meetSessionById.has(attempt.sessionId)) {
				return false
			}

			const session = meetSessionById.get(attempt.sessionId)
			const sessionDate = session?.date ?? attempt.createdAt

			if (startDate && sessionDate < startDate) {
				return false
			}
			if (endDate && sessionDate > endDate) {
				return false
			}

			return true
		})

		const attemptsBySession = new Map<string, AttemptEntry[]>()
		for (const attempt of filtered) {
			const sessionAttempts = attemptsBySession.get(attempt.sessionId) ?? []
			sessionAttempts.push(attempt)
			attemptsBySession.set(attempt.sessionId, sessionAttempts)
		}

		const points = [...attemptsBySession.entries()]
			.map(([sessionId, sessionAttempts]) => {
				const session = meetSessionById.get(sessionId)
				const values = sessionAttempts
					.map(attempt => attempt.value)
					.filter((value): value is number => value !== null)
				const bestResult = getBestComparableValue({ values, event })

				const labelVideos: VideoInterface[] = sessionAttempts.map(attempt => ({
					id: sessionId,
					sessionId,
					teamId,
					athleteId,
					event,
					result: attempt.result,
					isPR: false,
					videoUrl: '',
					thumbUrl: null,
					orientation: 'landscape',
					durationMs: null,
					recordedAt: attempt.createdAt,
					createdAt: attempt.createdAt,
					updatedAt: attempt.createdAt
				}))

				return {
					date: session?.date ?? sessionAttempts[0]!.createdAt,
					bestResult,
					label: getSessionProgressionLabel({ videos: labelVideos }),
					sessionId,
					sessionName: session?.name ?? sessionId
				}
			})
			.sort((left, right) => left.date.getTime() - right.date.getTime())

		const sessionBests = points.filter(
			(point): point is typeof point & { bestResult: number } =>
				point.bestResult !== null
		)
		const prEntry = sessionBests.reduce<{ mark: number; date: Date } | null>(
			(best, point) => {
				if (
					best === null ||
					isBetterResult({
						newValue: point.bestResult,
						previousValue: best.mark,
						event
					})
				) {
					return { mark: point.bestResult, date: point.date }
				}

				return best
			},
			null
		)
		const recentMark =
			sessionBests.length > 0
				? sessionBests[sessionBests.length - 1]!.bestResult
				: null

		return {
			points,
			stats: {
				pr: prEntry?.mark ?? null,
				recentResult: recentMark,
				totalAttempts: filtered.length,
				prDate: prEntry?.date ?? null
			}
		}
	}
}
