import { and, eq, gte, sql, type SQL } from 'drizzle-orm'
import { inject, injectable, singleton } from 'tsyringe'

import { getDb } from '@packages/database/createPostgresConnection'
import { recorderInvites, teams } from '@packages/database/schema'
import { RecorderInviteStatus } from '@packages/enums/trackRecord'
import { BaseRepository } from '@packages/repositories/BaseRepository'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import type { RecorderInviteInterface } from '@packages/types/recorderInvite'

export type RecorderInviteFilter = {
	id?: string
	teamId?: string
	token?: string
	email?: string
	status?: string
	acceptedByUserId?: string
}

type RecorderInviteRow = typeof recorderInvites.$inferSelect

@injectable()
@singleton()
@ReportErrors()
export class RecorderInviteRepository extends BaseRepository<
	typeof recorderInvites,
	RecorderInviteInterface,
	RecorderInviteFilter
> {
	constructor(@inject(ReportingService) reportingService: ReportingService) {
		super(reportingService, recorderInvites)
	}

	protected mapRow(row: RecorderInviteRow): RecorderInviteInterface {
		return {
			id: row.id,
			teamId: row.teamId,
			email: row.email,
			token: row.token,
			status: row.status,
			expiresAt: row.expiresAt,
			acceptedByUserId: row.acceptedByUserId,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt
		}
	}

	protected buildConditions({
		filter
	}: {
		filter: RecorderInviteFilter
	}): SQL[] {
		const parts: SQL[] = []
		if (filter.id !== undefined) {
			parts.push(eq(recorderInvites.id, filter.id))
		}
		if (filter.teamId !== undefined) {
			parts.push(eq(recorderInvites.teamId, filter.teamId))
		}
		if (filter.token !== undefined) {
			parts.push(eq(recorderInvites.token, filter.token))
		}
		if (filter.email !== undefined) {
			parts.push(eq(recorderInvites.email, filter.email.toLowerCase()))
		}
		if (filter.status !== undefined) {
			parts.push(eq(recorderInvites.status, filter.status))
		}
		if (filter.acceptedByUserId !== undefined) {
			parts.push(
				eq(recorderInvites.acceptedByUserId, filter.acceptedByUserId)
			)
		}
		return parts
	}

	public async create({
		data
	}: {
		data: Pick<
			RecorderInviteInterface,
			'teamId' | 'email' | 'token' | 'expiresAt'
		>
	}): Promise<RecorderInviteInterface> {
		return super.insertReturning({
			values: {
				teamId: data.teamId,
				email: data.email.toLowerCase(),
				token: data.token,
				expiresAt: data.expiresAt
			}
		})
	}

	public async countActivePendingByCompanyId({
		companyId
	}: {
		companyId: string
	}): Promise<number> {
		try {
			const db = getDb()
			const rows = await db
				.select({ c: sql<number>`count(*)::int` })
				.from(recorderInvites)
				.innerJoin(teams, eq(recorderInvites.teamId, teams.id))
				.where(
					and(
						eq(teams.companyId, companyId),
						eq(recorderInvites.status, RecorderInviteStatus.Pending),
						gte(recorderInvites.expiresAt, new Date())
					)
				)
			return rows[0]?.c ?? 0
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}
}
