import { and, desc, eq, inArray, type SQL } from 'drizzle-orm'
import { inject, injectable, singleton } from 'tsyringe'

import { trackRecordNotifications } from '@packages/database/schema'
import { getDb } from '@packages/database/createPostgresConnection'
import { BaseRepository } from '@packages/repositories/BaseRepository'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import type { TrackRecordNotificationInterface } from '@packages/types/trackRecordNotification'

export type TrackRecordNotificationFilter = {
	id?: string
	userId?: string
	teamId?: string
	read?: boolean
}

type NotificationRow = typeof trackRecordNotifications.$inferSelect

@injectable()
@singleton()
@ReportErrors()
export class TrackRecordNotificationRepository extends BaseRepository<
	typeof trackRecordNotifications,
	TrackRecordNotificationInterface,
	TrackRecordNotificationFilter
> {
	constructor(@inject(ReportingService) reportingService: ReportingService) {
		super(reportingService, trackRecordNotifications)
	}

	protected mapRow(row: NotificationRow): TrackRecordNotificationInterface {
		return {
			id: row.id,
			userId: row.userId,
			teamId: row.teamId,
			type: row.type,
			text: row.text,
			read: row.read,
			payload: row.payload as Record<string, unknown> | null,
			createdAt: row.createdAt
		}
	}

	protected buildConditions({ filter }: { filter: TrackRecordNotificationFilter }): SQL[] {
		const parts: SQL[] = []
		if (filter.id !== undefined) parts.push(eq(trackRecordNotifications.id, filter.id))
		if (filter.userId !== undefined) parts.push(eq(trackRecordNotifications.userId, filter.userId))
		if (filter.teamId !== undefined) parts.push(eq(trackRecordNotifications.teamId, filter.teamId))
		if (filter.read !== undefined) parts.push(eq(trackRecordNotifications.read, filter.read))
		return parts
	}

	public async create({ data }: {
		data: Pick<TrackRecordNotificationInterface, 'userId' | 'teamId' | 'type' | 'text'> &
			Partial<Pick<TrackRecordNotificationInterface, 'payload'>>
	}): Promise<TrackRecordNotificationInterface> {
		return super.insertReturning({
			values: {
				userId: data.userId,
				teamId: data.teamId,
				type: data.type,
				text: data.text,
				payload: data.payload ?? null
			}
		})
	}

	public async find({ filter, limit }: {
		filter: TrackRecordNotificationFilter
		limit?: number
	}): Promise<TrackRecordNotificationInterface[]> {
		try {
			const db = getDb()
			const parts = this.buildConditions({ filter })
			const whereClause = this.combineWhere({ parts })
			let query = db
				.select()
				.from(trackRecordNotifications)
				.orderBy(desc(trackRecordNotifications.createdAt))
				.$dynamic()
			if (whereClause !== undefined) {
				query = query.where(whereClause)
			}
			if (limit !== undefined) {
				query = query.limit(limit)
			}
			const rows = await query
			return rows.map((row) => this.mapRow(row))
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async markRead({ ids, userId, teamId }: {
		ids: string[]
		userId: string
		teamId: string
	}): Promise<boolean> {
		try {
			const db = getDb()
			await db
				.update(trackRecordNotifications)
				.set({ read: true })
				.where(
					and(
						inArray(trackRecordNotifications.id, ids),
						eq(trackRecordNotifications.userId, userId),
						eq(trackRecordNotifications.teamId, teamId)
					)
				)
			return true
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async markAllRead({ userId, teamId }: { userId: string; teamId: string }): Promise<boolean> {
		try {
			const db = getDb()
			await db
				.update(trackRecordNotifications)
				.set({ read: true })
				.where(and(eq(trackRecordNotifications.userId, userId), eq(trackRecordNotifications.teamId, teamId)))
			return true
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}
}
