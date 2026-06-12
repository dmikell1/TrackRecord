import { desc, eq, ilike, type SQL } from 'drizzle-orm'
import { inject, injectable, singleton } from 'tsyringe'

import { getDb } from '@packages/database/createPostgresConnection'
import { trainingSessions } from '@packages/database/schema'
import { BaseRepository } from '@packages/repositories/BaseRepository'
import { VideoRepository } from '@packages/repositories/video/VideoRepository'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import type { TrainingSessionInterface } from '@packages/types/trainingSession'

export type TrainingSessionFilter = {
	id?: string
	teamId?: string
	companyId?: string
	type?: string
	nameSearch?: string
}

type TrainingSessionRow = typeof trainingSessions.$inferSelect

@injectable()
@singleton()
@ReportErrors()
export class TrainingSessionRepository extends BaseRepository<
	typeof trainingSessions,
	TrainingSessionInterface,
	TrainingSessionFilter
> {
	constructor(
		@inject(ReportingService) reportingService: ReportingService,
		@inject(VideoRepository) private videoRepository: VideoRepository
	) {
		super(reportingService, trainingSessions)
	}

	protected mapRow(row: TrainingSessionRow): TrainingSessionInterface {
		return {
			id: row.id,
			teamId: row.teamId,
			companyId: row.companyId,
			name: row.name,
			date: row.date,
			type: row.type,
			createdByUserId: row.createdByUserId,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt
		}
	}

	protected buildConditions({ filter }: { filter: TrainingSessionFilter }): SQL[] {
		const parts: SQL[] = []
		if (filter.id !== undefined) parts.push(eq(trainingSessions.id, filter.id))
		if (filter.teamId !== undefined) parts.push(eq(trainingSessions.teamId, filter.teamId))
		if (filter.companyId !== undefined) parts.push(eq(trainingSessions.companyId, filter.companyId))
		if (filter.type !== undefined) parts.push(eq(trainingSessions.type, filter.type))
		if (filter.nameSearch !== undefined) parts.push(ilike(trainingSessions.name, `%${filter.nameSearch}%`))
		return parts
	}

	public async create({ data }: {
		data: Pick<TrainingSessionInterface, 'teamId' | 'companyId' | 'name' | 'date' | 'type' | 'createdByUserId'>
	}): Promise<TrainingSessionInterface> {
		return super.insertReturning({ values: data })
	}

	public async find({
		filter,
		limit,
		offset
	}: {
		filter: TrainingSessionFilter
		limit?: number
		offset?: number
	}): Promise<TrainingSessionInterface[]> {
		try {
			const db = getDb()
			const parts = this.buildConditions({ filter })
			const whereClause = this.combineWhere({ parts })
			let query = db
				.select()
				.from(trainingSessions)
				.orderBy(desc(trainingSessions.date), desc(trainingSessions.createdAt))
				.$dynamic()

			if (whereClause !== undefined) {
				query = query.where(whereClause)
			}
			if (limit !== undefined) {
				query = query.limit(limit)
			}
			if (offset !== undefined) {
				query = query.offset(offset)
			}

			const rows = await query
			return rows.map(row => this.mapRow(row))
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async findOne({ filter, loadVideos }: {
		filter: TrainingSessionFilter
		loadVideos?: boolean
	}): Promise<TrainingSessionInterface | null> {
		const session = await super.findOne({ filter })
		if (!session || !loadVideos) return session
		const videos = await this.videoRepository.find({ filter: { sessionId: session.id } })
		return { ...session, videos }
	}
}
