import { and, eq, sql, type SQL } from 'drizzle-orm'
import { inject, injectable, singleton } from 'tsyringe'

import { teams, teamUsers } from '@packages/database/schema'
import { getDb } from '@packages/database/createPostgresConnection'
import { BaseRepository } from '@packages/repositories/BaseRepository'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import type { TeamInterface } from '@packages/types/team'

export type TeamFilter = {
	id?: string
	companyId?: string
	ownerId?: string
	name?: string
}

type TeamRow = typeof teams.$inferSelect

@injectable()
@singleton()
@ReportErrors()
export class TeamRepository extends BaseRepository<
	typeof teams,
	TeamInterface,
	TeamFilter
> {
	constructor(@inject(ReportingService) reportingService: ReportingService) {
		super(reportingService, teams)
	}

	protected mapRow(row: TeamRow): TeamInterface {
		return {
			id: row.id,
			name: row.name,
			ownerId: row.ownerId,
			companyId: row.companyId,
			settings: (row.settings as TeamInterface['settings']) ?? {},
			createdAt: row.createdAt,
			updatedAt: row.updatedAt
		}
	}

	protected buildConditions({
		filter
	}: {
		filter: TeamFilter
	}): SQL[] {
		const parts: SQL[] = []
		if (filter.id !== undefined) {
			parts.push(eq(teams.id, filter.id))
		}
		if (filter.companyId !== undefined) {
			parts.push(eq(teams.companyId, filter.companyId))
		}
		if (filter.ownerId !== undefined) {
			parts.push(eq(teams.ownerId, filter.ownerId))
		}
		if (filter.name !== undefined) {
			parts.push(eq(teams.name, filter.name))
		}
		return parts
	}

	public async create({
		data
	}: {
		data: Pick<TeamInterface, 'name' | 'ownerId' | 'companyId'>
	}): Promise<TeamInterface> {
		return super.insertReturning({
			values: {
				name: data.name,
				ownerId: data.ownerId,
				companyId: data.companyId
			}
		})
	}

	public async update({
		filter,
		data
	}: {
		filter: TeamFilter
		data: Partial<Pick<TeamInterface, 'name' | 'settings'>>
	}): Promise<TeamInterface | null> {
		return super.update({ filter, data })
	}

	public async updateSettings({ id, settings }: {
		id: string
		settings: TeamInterface['settings']
	}): Promise<TeamInterface | null> {
		const current = await this.findOne({ filter: { id } })
		if (!current) return null
		const merged = { ...current.settings, ...settings }
		return super.update({ filter: { id }, data: { settings: merged } })
	}

	public async addTeamUser({ teamId, userId }: { teamId: string; userId: string }): Promise<void> {
		const db = getDb()
		await db.insert(teamUsers).values({ teamId, userId }).onConflictDoNothing()
	}

	public async removeTeamUser({
		teamId,
		userId
	}: {
		teamId: string
		userId: string
	}): Promise<void> {
		const db = getDb()
		await db
			.delete(teamUsers)
			.where(and(eq(teamUsers.teamId, teamId), eq(teamUsers.userId, userId)))
	}

	public async findByInviteToken({
		token
	}: {
		token: string
	}): Promise<TeamInterface | null> {
		const db = getDb()
		const rows = await db
			.select()
			.from(teams)
			.where(sql`${teams.settings}->>'inviteToken' = ${token}`)
			.limit(1)

		const row = rows[0]
		if (!row) {
			return null
		}

		return this.mapRow(row)
	}
}
