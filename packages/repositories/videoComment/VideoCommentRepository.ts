import { asc, count, eq, inArray, type SQL } from 'drizzle-orm'
import { inject, injectable, singleton } from 'tsyringe'

import { getDb } from '@packages/database/createPostgresConnection'
import { videoComments } from '@packages/database/schema'
import { BaseRepository } from '@packages/repositories/BaseRepository'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import type { VideoCommentInterface } from '@packages/types/videoComment'

export type VideoCommentFilter = {
	id?: string
	videoId?: string
	userId?: string
}

type VideoCommentRow = typeof videoComments.$inferSelect

@injectable()
@singleton()
@ReportErrors()
export class VideoCommentRepository extends BaseRepository<
	typeof videoComments,
	VideoCommentInterface,
	VideoCommentFilter
> {
	constructor(@inject(ReportingService) reportingService: ReportingService) {
		super(reportingService, videoComments)
	}

	protected mapRow(row: VideoCommentRow): VideoCommentInterface {
		return {
			id: row.id,
			videoId: row.videoId,
			userId: row.userId,
			text: row.text,
			stampSeconds: row.stampSeconds,
			createdAt: row.createdAt
		}
	}

	protected buildConditions({ filter }: { filter: VideoCommentFilter }): SQL[] {
		const parts: SQL[] = []
		if (filter.id !== undefined) parts.push(eq(videoComments.id, filter.id))
		if (filter.videoId !== undefined) parts.push(eq(videoComments.videoId, filter.videoId))
		if (filter.userId !== undefined) parts.push(eq(videoComments.userId, filter.userId))
		return parts
	}

	public async create({ data }: {
		data: Pick<VideoCommentInterface, 'videoId' | 'userId' | 'text'> &
			Partial<Pick<VideoCommentInterface, 'stampSeconds'>>
	}): Promise<VideoCommentInterface> {
		return super.insertReturning({
			values: {
				videoId: data.videoId,
				userId: data.userId,
				text: data.text,
				stampSeconds: data.stampSeconds ?? null
			}
		})
	}

	public async countByVideoIds({
		videoIds
	}: {
		videoIds: string[]
	}): Promise<Map<string, number>> {
		if (videoIds.length === 0) {
			return new Map()
		}

		try {
			const db = getDb()
			const rows = await db
				.select({
					videoId: videoComments.videoId,
					commentCount: count()
				})
				.from(videoComments)
				.where(inArray(videoComments.videoId, videoIds))
				.groupBy(videoComments.videoId)

			const counts = new Map<string, number>()
			for (const row of rows) {
				counts.set(row.videoId, Number(row.commentCount))
			}
			return counts
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async find({ filter }: { filter: VideoCommentFilter }): Promise<VideoCommentInterface[]> {
		try {
			const db = getDb()
			const parts = this.buildConditions({ filter })
			const whereClause = this.combineWhere({ parts })
			let query = db
				.select()
				.from(videoComments)
				.orderBy(asc(videoComments.createdAt))
				.$dynamic()
			if (whereClause !== undefined) {
				query = query.where(whereClause)
			}
			const rows = await query
			return rows.map((row) => this.mapRow(row))
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}
}
