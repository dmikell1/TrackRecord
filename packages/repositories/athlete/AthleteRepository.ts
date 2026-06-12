import { and, eq, inArray, isNull, type SQL } from 'drizzle-orm'
import { inject, injectable, singleton } from 'tsyringe'

import { getDb } from '@packages/database/createPostgresConnection'
import { athletes } from '@packages/database/schema'
import { BaseRepository } from '@packages/repositories/BaseRepository'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import type { AthleteInterface } from '@packages/types/athlete'

export type AthleteFilter = {
	id?: string
	teamId?: string
	companyId?: string
	userId?: string
	email?: string
	includeDeleted?: boolean
}

type AthleteRow = typeof athletes.$inferSelect

@injectable()
@singleton()
@ReportErrors()
export class AthleteRepository extends BaseRepository<
	typeof athletes,
	AthleteInterface,
	AthleteFilter
> {
	constructor(@inject(ReportingService) reportingService: ReportingService) {
		super(reportingService, athletes)
	}

	protected mapRow(row: AthleteRow): AthleteInterface {
		return {
			id: row.id,
			teamId: row.teamId,
			companyId: row.companyId,
			userId: row.userId,
			firstName: row.firstName,
			lastName: row.lastName,
			email: row.email,
			phone: row.phone,
			color: row.color,
			deletedAt: row.deletedAt,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt
		}
	}

	protected buildConditions({ filter }: { filter: AthleteFilter }): SQL[] {
		const parts: SQL[] = []
		if (filter.id !== undefined) parts.push(eq(athletes.id, filter.id))
		if (filter.teamId !== undefined) parts.push(eq(athletes.teamId, filter.teamId))
		if (filter.companyId !== undefined) parts.push(eq(athletes.companyId, filter.companyId))
		if (filter.userId !== undefined) parts.push(eq(athletes.userId, filter.userId))
		if (filter.email !== undefined) parts.push(eq(athletes.email, filter.email.toLowerCase()))
		if (filter.includeDeleted !== true) parts.push(isNull(athletes.deletedAt))
		return parts
	}

	public async create({ data }: {
		data: Pick<AthleteInterface, 'teamId' | 'companyId' | 'firstName' | 'lastName' | 'email' | 'color'> &
			Partial<Pick<AthleteInterface, 'userId' | 'phone'>>
	}): Promise<AthleteInterface> {
		return super.insertReturning({
			values: {
				teamId: data.teamId,
				companyId: data.companyId,
				firstName: data.firstName,
				lastName: data.lastName,
				email: data.email.toLowerCase(),
				color: data.color,
				...(data.userId !== undefined && { userId: data.userId }),
				...(data.phone !== undefined && { phone: data.phone })
			}
		})
	}

	public async findByEmailsInTeam({
		teamId,
		emails
	}: {
		teamId: string
		emails: string[]
	}): Promise<AthleteInterface[]> {
		if (emails.length === 0) {
			return []
		}

		try {
			const normalizedEmails = [
				...new Set(emails.map(email => email.toLowerCase()))
			]
			const db = getDb()
			const rows = await db
				.select()
				.from(athletes)
				.where(
					and(
						eq(athletes.teamId, teamId),
						isNull(athletes.deletedAt),
						inArray(athletes.email, normalizedEmails)
					)
				)

			return rows.map(row => this.mapRow(row))
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async createMany({
		data
	}: {
		data: Array<
			Pick<
				AthleteInterface,
				'teamId' | 'companyId' | 'firstName' | 'lastName' | 'email' | 'color'
			> &
				Partial<Pick<AthleteInterface, 'userId' | 'phone'>>
		>
	}): Promise<AthleteInterface[]> {
		if (data.length === 0) {
			return []
		}

		try {
			const db = getDb()
			const values = data.map(athlete => ({
				teamId: athlete.teamId,
				companyId: athlete.companyId,
				firstName: athlete.firstName,
				lastName: athlete.lastName,
				email: athlete.email.toLowerCase(),
				color: athlete.color,
				...(athlete.userId !== undefined && { userId: athlete.userId }),
				...(athlete.phone !== undefined && { phone: athlete.phone })
			}))
			const rows = await db.insert(athletes).values(values).returning()

			return rows.map(row => this.mapRow(row))
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async softDelete({ id, teamId }: { id: string; teamId: string }): Promise<AthleteInterface | null> {
		try {
			const db = getDb()
			const [row] = await db
				.update(athletes)
				.set({ deletedAt: new Date() })
				.where(and(eq(athletes.id, id), eq(athletes.teamId, teamId)))
				.returning()
			return row ? this.mapRow(row) : null
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async linkUser({ id, userId }: { id: string; userId: string }): Promise<AthleteInterface | null> {
		return super.update({ filter: { id }, data: { userId } })
	}
}
