import { injectable, inject, singleton } from 'tsyringe'

import { isTimedEvent } from '@packages/constants/trackEventCatalog'
import { SessionType } from '@packages/enums'
import { TrainingSessionRepository } from '@packages/repositories/trainingSession/TrainingSessionRepository'
import type { VideoFilter } from '@packages/repositories/video/VideoRepository'
import { VideoRepository } from '@packages/repositories/video/VideoRepository'
import { VideoPerformanceRepository } from '@packages/repositories/videoPerformance/VideoPerformanceRepository'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import type { VideoInterface, VideoResult } from '@packages/types/video'
import type { VideoPerformanceInterface } from '@packages/types/videoPerformance'

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

	private async detectPR({
		teamId,
		athleteId,
		event,
		result,
		excludeVideoId
	}: {
		teamId: string
		athleteId: string
		event: string
		result: VideoResult | null | undefined
		excludeVideoId?: string
	}): Promise<boolean> {
		const newValue = getComparableResultValue({ result })
		if (newValue === null) {
			return false
		}

		const meetSessionIds = await this.getMeetSessionIds({ teamId })

		const previousVideos = (
			await this.videoRepository.find({
				filter: { athleteId, event, teamId }
			})
		).filter(
			video =>
				meetSessionIds.has(video.sessionId) && video.id !== excludeVideoId
		)
		const previousPerformances = await this.videoPerformanceRepository.find({
			filter: { athleteId, event, teamId }
		})
		const performanceVideoIds = [
			...new Set(previousPerformances.map(performance => performance.videoId))
		]
		const performanceVideos =
			performanceVideoIds.length > 0
				? await this.videoRepository.findByIds({
						ids: performanceVideoIds,
						teamId
					})
				: []
		const meetPerformanceVideoIds = new Set(
			performanceVideos
				.filter(video => meetSessionIds.has(video.sessionId))
				.map(video => video.id)
		)

		const previousValues = [
			...previousVideos.map(video =>
				getComparableResultValue({ result: video.result })
			),
			...previousPerformances
				.filter(
					performance =>
						meetPerformanceVideoIds.has(performance.videoId) &&
						performance.videoId !== excludeVideoId
				)
				.map(performance =>
					getComparableResultValue({ result: performance.result })
				)
		].filter((value): value is number => value !== null)

		const previousBest = getBestComparableValue({
			values: previousValues,
			event
		})

		if (previousBest === null) {
			return true
		}

		return isBetterResult({
			newValue,
			previousValue: previousBest,
			event
		})
	}

	private async clearPreviousPRFlags({
		teamId,
		athleteId,
		event,
		excludeVideoId
	}: {
		teamId: string
		athleteId: string
		event: string
		excludeVideoId?: string
	}): Promise<void> {
		await this.videoRepository.clearPRForAthleteEvent({
			athleteId,
			event,
			teamId,
			excludeVideoId
		})
		await this.videoPerformanceRepository.clearPRForAthleteEvent({
			athleteId,
			event,
			teamId,
			excludeVideoId
		})
	}

	private async resolvePRForTaggedResult({
		teamId,
		sessionId,
		athleteId,
		event,
		result,
		excludeVideoId
	}: {
		teamId: string
		sessionId: string
		athleteId: string
		event: string
		result: VideoResult | null | undefined
		excludeVideoId?: string
	}): Promise<boolean> {
		const isPractice = await this.isPracticeSession({ sessionId })
		if (isPractice) {
			return false
		}

		const isPR = await this.detectPR({
			teamId,
			athleteId,
			event,
			result,
			excludeVideoId
		})

		if (isPR) {
			await this.clearPreviousPRFlags({
				teamId,
				athleteId,
				event,
				excludeVideoId
			})
		}

		return isPR
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
		if (data.event && isTimedEvent({ event: data.event })) {
			throw new Error('Use createRunningVideo for timed events')
		}

		const isPR =
			data.athleteId !== null &&
			data.athleteId !== undefined &&
			data.event !== null &&
			data.event !== undefined
				? await this.resolvePRForTaggedResult({
						teamId: data.teamId,
						sessionId: data.sessionId,
						athleteId: data.athleteId,
						event: data.event,
						result: data.result
					})
				: false
		return this.videoRepository.create({ data: { ...data, isPR } })
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

		const performancesWithPR = await Promise.all(
			data.performances.map(async performance => ({
				...performance,
				isPR:
					!isPractice &&
					performance.result !== null &&
					performance.result !== undefined &&
					data.event !== null &&
					data.event !== undefined
						? await this.resolvePRForTaggedResult({
								teamId: data.teamId,
								sessionId: data.sessionId,
								athleteId: performance.athleteId,
								event: data.event,
								result: performance.result
							})
						: false
			}))
		)

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
				isPR: performancesWithPR.some(performance => performance.isPR)
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

		const performancesWithPR = await Promise.all(
			performances.map(async performance => ({
				...performance,
				isPR:
					!isPractice &&
					performance.result !== null &&
					performance.result !== undefined &&
					event !== null &&
					event !== undefined
						? await this.resolvePRForTaggedResult({
								teamId,
								sessionId: existing.sessionId,
								athleteId: performance.athleteId,
								event,
								result: performance.result,
								excludeVideoId: videoId
							})
						: false
			}))
		)

		await this.videoRepository.update({
			filter: { id: videoId, teamId },
			data: {
				event: event ?? null,
				athleteId: null,
				result: null,
				isPR: performancesWithPR.some(performance => performance.isPR)
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

		return {
			...existing,
			event: event ?? null,
			athleteId: null,
			result: null,
			isPR: performancesWithPR.some(performance => performance.isPR),
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

	public async findVideos({ filter }: { filter: VideoFilter }): Promise<VideoInterface[]> {
		if (filter.athleteId) {
			const performanceVideoIds =
				await this.videoPerformanceRepository.findVideoIdsByAthlete({
					athleteId: filter.athleteId,
					teamId: filter.teamId!,
					...(filter.event !== undefined && { event: filter.event })
				})

			const directVideos = await this.videoRepository.find({
				filter: {
					...filter,
					athleteId: filter.athleteId
				}
			})

			if (performanceVideoIds.length === 0) {
				return directVideos
			}

			const performanceVideos = await this.videoRepository.find({
				filter: {
					teamId: filter.teamId,
					sessionId: filter.sessionId,
					event: filter.event
				}
			})

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

			return [...merged.values()]
		}

		return this.videoRepository.find({ filter })
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

		if (existing && data.event && isTimedEvent({ event: data.event })) {
			throw new Error('Use updateVideoPerformances for timed events')
		}

		let isPR: boolean | undefined
		if (existing) {
			const athleteId =
				data.athleteId !== undefined ? data.athleteId : existing.athleteId
			const event = data.event !== undefined ? data.event : existing.event
			const result = data.result !== undefined ? data.result : existing.result
			const taggingChanged =
				data.result !== undefined ||
				data.athleteId !== undefined ||
				data.event !== undefined

			if (taggingChanged) {
				isPR =
					athleteId !== null &&
					event !== null &&
					result !== null &&
					result !== undefined
						? await this.resolvePRForTaggedResult({
								teamId: existing.teamId,
								sessionId: existing.sessionId,
								athleteId,
								event,
								result,
								excludeVideoId: existing.id
							})
						: false
			}
		}
		return this.videoRepository.update({
			filter,
			data: { ...data, ...(isPR !== undefined && { isPR }) }
		})
	}

	public async deleteVideo({ filter }: { filter: VideoFilter }): Promise<boolean> {
		if (filter.id && filter.teamId) {
			await this.videoPerformanceRepository.deleteByVideoId({
				videoId: filter.id,
				teamId: filter.teamId
			})
		}

		return this.videoRepository.delete({ filter })
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
		const meetSessions = await this.trainingSessionRepository.find({
			filter: { teamId, type: SessionType.Meet }
		})
		const meetSessionById = new Map(
			meetSessions.map(session => [session.id, session])
		)

		const fieldVideos = await this.videoRepository.find({
			filter: { athleteId, event, teamId }
		})
		const performances = await this.videoPerformanceRepository.find({
			filter: { athleteId, event, teamId }
		})
		const performanceVideoIds = [
			...new Set(performances.map(performance => performance.videoId))
		]
		const runningVideos =
			performanceVideoIds.length > 0
				? await this.videoRepository.find({
						filter: { teamId }
					})
				: []
		const runningVideoById = new Map(
			runningVideos
				.filter(video => performanceVideoIds.includes(video.id))
				.map(video => [video.id, video])
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
