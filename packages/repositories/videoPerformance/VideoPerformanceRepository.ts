import { and, eq, inArray, ne, type SQL } from 'drizzle-orm'
import { inject, injectable, singleton } from 'tsyringe'

import { videoPerformances } from '@packages/database/schema'
import { getDb } from '@packages/database/createPostgresConnection'
import { BaseRepository } from '@packages/repositories/BaseRepository'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import type { VideoPerformanceInterface } from '@packages/types/videoPerformance'
import type { VideoResult } from '@packages/types/video'

export type VideoPerformanceFilter = {
	id?: string
	videoId?: string
	teamId?: string
	athleteId?: string
	event?: string
}

type VideoPerformanceRow = typeof videoPerformances.$inferSelect

@injectable()
@singleton()
@ReportErrors()
export class VideoPerformanceRepository extends BaseRepository<
	typeof videoPerformances,
	VideoPerformanceInterface,
	VideoPerformanceFilter
> {
	constructor(@inject(ReportingService) reportingService: ReportingService) {
		super(reportingService, videoPerformances)
	}

	protected mapRow(row: VideoPerformanceRow): VideoPerformanceInterface {
		return {
			id: row.id,
			videoId: row.videoId,
			teamId: row.teamId,
			athleteId: row.athleteId,
			event: row.event,
			result: row.result as VideoResult | null,
			isPR: row.isPR,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt
		}
	}

	protected buildConditions({
		filter
	}: {
		filter: VideoPerformanceFilter
	}): SQL[] {
		const parts: SQL[] = []
		if (filter.id !== undefined) {
			parts.push(eq(videoPerformances.id, filter.id))
		}
		if (filter.videoId !== undefined) {
			parts.push(eq(videoPerformances.videoId, filter.videoId))
		}
		if (filter.teamId !== undefined) {
			parts.push(eq(videoPerformances.teamId, filter.teamId))
		}
		if (filter.athleteId !== undefined) {
			parts.push(eq(videoPerformances.athleteId, filter.athleteId))
		}
		if (filter.event !== undefined) {
			parts.push(eq(videoPerformances.event, filter.event))
		}
		return parts
	}

	public async findByVideoIds({
		videoIds,
		teamId
	}: {
		videoIds: string[]
		teamId: string
	}): Promise<VideoPerformanceInterface[]> {
		if (videoIds.length === 0) {
			return []
		}

		try {
			const db = getDb()
			const rows = await db
				.select()
				.from(videoPerformances)
				.where(
					and(
						inArray(videoPerformances.videoId, videoIds),
						eq(videoPerformances.teamId, teamId)
					)
				)

			return rows.map(row => this.mapRow(row))
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async findVideoIdsByAthlete({
		athleteId,
		teamId,
		event
	}: {
		athleteId: string
		teamId: string
		event?: string
	}): Promise<string[]> {
		const rows = await this.find({
			filter: {
				athleteId,
				teamId,
				...(event !== undefined && { event })
			}
		})
		return [...new Set(rows.map(row => row.videoId))]
	}

	public async createMany({
		performances
	}: {
		performances: Array<
			Pick<
				VideoPerformanceInterface,
				'videoId' | 'teamId' | 'athleteId' | 'event' | 'result' | 'isPR'
			>
		>
	}): Promise<VideoPerformanceInterface[]> {
		if (performances.length === 0) {
			return []
		}

		const rows = await Promise.all(
			performances.map(performance =>
				this.insertReturning({
					values: {
						videoId: performance.videoId,
						teamId: performance.teamId,
						athleteId: performance.athleteId,
						event: performance.event,
						result: performance.result,
						isPR: performance.isPR
					}
				})
			)
		)

		return rows
	}

	public async deleteByVideoId({
		videoId,
		teamId
	}: {
		videoId: string
		teamId: string
	}): Promise<void> {
		const rows = await this.find({ filter: { videoId, teamId } })
		await Promise.all(
			rows.map(row => this.delete({ filter: { id: row.id, teamId } }))
		)
	}

	public async replaceForVideo({
		videoId,
		teamId,
		performances
	}: {
		videoId: string
		teamId: string
		performances: Array<
			Pick<
				VideoPerformanceInterface,
				'athleteId' | 'event' | 'result' | 'isPR'
			>
		>
	}): Promise<VideoPerformanceInterface[]> {
		await this.deleteByVideoId({ videoId, teamId })
		return this.createMany({
			performances: performances.map(performance => ({
				videoId,
				teamId,
				...performance
			}))
		})
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
				eq(videoPerformances.athleteId, athleteId),
				eq(videoPerformances.event, event),
				eq(videoPerformances.teamId, teamId),
				eq(videoPerformances.isPR, true)
			]

			if (excludeVideoId !== undefined) {
				conditions.push(ne(videoPerformances.videoId, excludeVideoId))
			}

			await db
				.update(videoPerformances)
				.set({ isPR: false, updatedAt: new Date() })
				.where(and(...conditions))
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async deleteByAthleteId({
		athleteId,
		teamId
	}: {
		athleteId: string
		teamId: string
	}): Promise<void> {
		const rows = await this.find({ filter: { athleteId, teamId } })
		await Promise.all(
			rows.map(row => this.delete({ filter: { id: row.id, teamId } }))
		)
	}
}
