import { and, count, eq, inArray, ne, type SQL } from 'drizzle-orm'
import { inject, injectable, singleton } from 'tsyringe'

import { videos } from '@packages/database/schema'
import { getDb } from '@packages/database/createPostgresConnection'
import { BaseRepository } from '@packages/repositories/BaseRepository'
import { VideoCommentRepository } from '@packages/repositories/videoComment/VideoCommentRepository'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import type { VideoInterface, VideoResult } from '@packages/types/video'

export type VideoFilter = {
	id?: string
	sessionId?: string
	teamId?: string
	athleteId?: string
	event?: string
}

type VideoRow = typeof videos.$inferSelect

@injectable()
@singleton()
@ReportErrors()
export class VideoRepository extends BaseRepository<
	typeof videos,
	VideoInterface,
	VideoFilter
> {
	constructor(
		@inject(ReportingService) reportingService: ReportingService,
		@inject(VideoCommentRepository) private videoCommentRepository: VideoCommentRepository
	) {
		super(reportingService, videos)
	}

	protected mapRow(row: VideoRow): VideoInterface {
		return {
			id: row.id,
			sessionId: row.sessionId,
			teamId: row.teamId,
			athleteId: row.athleteId,
			event: row.event,
			result: row.result as VideoResult | null,
			isPR: row.isPR,
			videoUrl: row.videoUrl,
			thumbUrl: row.thumbUrl,
			orientation: row.orientation,
			durationMs: row.durationMs,
			recordedAt: row.recordedAt,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt
		}
	}

	protected buildConditions({ filter }: { filter: VideoFilter }): SQL[] {
		const parts: SQL[] = []
		if (filter.id !== undefined) parts.push(eq(videos.id, filter.id))
		if (filter.sessionId !== undefined) parts.push(eq(videos.sessionId, filter.sessionId))
		if (filter.teamId !== undefined) parts.push(eq(videos.teamId, filter.teamId))
		if (filter.athleteId !== undefined) parts.push(eq(videos.athleteId, filter.athleteId))
		if (filter.event !== undefined) parts.push(eq(videos.event, filter.event))
		return parts
	}

	private async withCommentCounts({
		videos: videoList
	}: {
		videos: VideoInterface[]
	}): Promise<VideoInterface[]> {
		if (videoList.length === 0) {
			return videoList
		}

		const counts = await this.videoCommentRepository.countByVideoIds({
			videoIds: videoList.map((video) => video.id)
		})

		return videoList.map((video) => ({
			...video,
			commentCount: counts.get(video.id) ?? 0
		}))
	}

	public async find({
		filter,
		limit,
		offset,
		includeCommentCounts = true
	}: {
		filter: VideoFilter
		limit?: number
		offset?: number
		includeCommentCounts?: boolean
	}): Promise<VideoInterface[]> {
		const videoList = await super.find({ filter, limit, offset })
		if (!includeCommentCounts) {
			return videoList
		}
		return this.withCommentCounts({ videos: videoList })
	}

	public async create({ data }: {
		data: Pick<VideoInterface, 'sessionId' | 'teamId' | 'videoUrl' | 'orientation'> &
			Partial<
				Pick<
					VideoInterface,
					| 'athleteId'
					| 'event'
					| 'result'
					| 'isPR'
					| 'thumbUrl'
					| 'durationMs'
					| 'recordedAt'
				>
			>
	}): Promise<VideoInterface> {
		const video = await super.insertReturning({
			values: {
				sessionId: data.sessionId,
				teamId: data.teamId,
				athleteId: data.athleteId ?? null,
				event: data.event ?? null,
				videoUrl: data.videoUrl,
				orientation: data.orientation,
				result: data.result ?? null,
				isPR: data.isPR ?? false,
				thumbUrl: data.thumbUrl ?? null,
				durationMs: data.durationMs ?? null,
				recordedAt: data.recordedAt ?? new Date()
			}
		})
		return { ...video, commentCount: 0 }
	}

	public async findOne({ filter, loadComments }: {
		filter: VideoFilter
		loadComments?: boolean
	}): Promise<VideoInterface | null> {
		const video = await super.findOne({ filter })
		if (!video) {
			return null
		}

		if (loadComments) {
			const comments = await this.videoCommentRepository.find({
				filter: { videoId: video.id }
			})
			return { ...video, comments, commentCount: comments.length }
		}

		const [withCommentCount] = await this.withCommentCounts({ videos: [video] })
		return withCommentCount ?? null
	}

	public async update({
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
				| 'isPR'
			>
		>
	}): Promise<VideoInterface | null> {
		const updated = await super.update({ filter, data })
		if (!updated) {
			return null
		}

		const [withCommentCount] = await this.withCommentCounts({ videos: [updated] })
		return withCommentCount ?? null
	}

	public async deleteByAthleteId({
		athleteId,
		teamId
	}: {
		athleteId: string
		teamId: string
	}): Promise<void> {
		try {
			const db = getDb()
			await db
				.delete(videos)
				.where(and(eq(videos.athleteId, athleteId), eq(videos.teamId, teamId)))
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async clearPRForAthleteEvent({
		athleteId,
		event,
		teamId,
		excludeVideoId
	}: {
		athleteId: string
		event: string
		teamId: string
		excludeVideoId?: string
	}): Promise<void> {
		try {
			const db = getDb()
			const conditions: SQL[] = [
				eq(videos.athleteId, athleteId),
				eq(videos.event, event),
				eq(videos.teamId, teamId),
				eq(videos.isPR, true)
			]

			if (excludeVideoId !== undefined) {
				conditions.push(ne(videos.id, excludeVideoId))
			}

			await db
				.update(videos)
				.set({ isPR: false, updatedAt: new Date() })
				.where(and(...conditions))
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async countBySessionIds({
		sessionIds,
		teamId
	}: {
		sessionIds: string[]
		teamId: string
	}): Promise<Map<string, number>> {
		if (sessionIds.length === 0) {
			return new Map()
		}

		try {
			const db = getDb()
			const rows = await db
				.select({
					sessionId: videos.sessionId,
					videoCount: count()
				})
				.from(videos)
				.where(
					and(inArray(videos.sessionId, sessionIds), eq(videos.teamId, teamId))
				)
				.groupBy(videos.sessionId)

			const counts = new Map<string, number>()
			for (const row of rows) {
				counts.set(row.sessionId, Number(row.videoCount))
			}
			return counts
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async findByIds({
		ids,
		teamId
	}: {
		ids: string[]
		teamId: string
	}): Promise<VideoInterface[]> {
		if (ids.length === 0) {
			return []
		}

		try {
			const db = getDb()
			const rows = await db
				.select()
				.from(videos)
				.where(and(inArray(videos.id, ids), eq(videos.teamId, teamId)))

			return this.withCommentCounts({
				videos: rows.map(row => this.mapRow(row))
			})
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async moveToSession({ ids, sessionId, teamId }: {
		ids: string[]
		sessionId: string
		teamId: string
	}): Promise<VideoInterface[]> {
		try {
			const db = getDb()
			const rows = await db
				.update(videos)
				.set({ sessionId, updatedAt: new Date() })
				.where(and(inArray(videos.id, ids), eq(videos.teamId, teamId)))
				.returning()
			const movedVideos = rows.map((r) => this.mapRow(r))
			return this.withCommentCounts({ videos: movedVideos })
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}
}
