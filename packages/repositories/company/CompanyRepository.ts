import { eq, type SQL } from 'drizzle-orm'
import { inject, injectable, singleton } from 'tsyringe'

import { getDb } from '@packages/database/createPostgresConnection'
import {
	companies,
	companyUsers,
	teams,
	teamUsers,
	userRoles,
	users
} from '@packages/database/schema'
import { UserRoles, UserStatus } from '@packages/enums'
import { BaseRepository } from '@packages/repositories/BaseRepository'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import type { CompanyInterface } from '@packages/types/company'
import type { TeamInterface } from '@packages/types/team'
import type { UserInterface } from '@packages/types/user'

export type CompanyFilter = {
	id?: string
	ownerId?: string
	name?: string
}

type CompanyRow = typeof companies.$inferSelect

@injectable()
@singleton()
@ReportErrors()
export class CompanyRepository extends BaseRepository<
	typeof companies,
	CompanyInterface,
	CompanyFilter
> {
	constructor(@inject(ReportingService) reportingService: ReportingService) {
		super(reportingService, companies)
	}

	protected mapRow(row: CompanyRow): CompanyInterface {
		return {
			id: row.id,
			ownerId: row.ownerId,
			name: row.name,
			settings: row.settings ?? {},
			createdAt: row.createdAt,
			updatedAt: row.updatedAt
		}
	}

	protected buildConditions({
		filter
	}: {
		filter: CompanyFilter
	}): SQL[] {
		const parts: SQL[] = []
		if (filter.id !== undefined) {
			parts.push(eq(companies.id, filter.id))
		}
		if (filter.ownerId !== undefined) {
			parts.push(eq(companies.ownerId, filter.ownerId))
		}
		if (filter.name !== undefined) {
			parts.push(eq(companies.name, filter.name))
		}
		return parts
	}

	public async createCompanyTeamAndLinks({
		ownerId,
		name,
		settings
	}: {
		ownerId: string
		name: string
		settings?: { timezoneName?: string }
	}): Promise<{ company: CompanyInterface; team: TeamInterface }> {
		try {
			const db = getDb()
			return await db.transaction(async (tx) => {
				const [companyRow] = await tx
					.insert(companies)
					.values({
						ownerId,
						name,
						settings: settings ?? {}
					})
					.returning()

				if (!companyRow) {
					throw new Error('Failed to create company')
				}

				const [teamRow] = await tx
					.insert(teams)
					.values({
						name,
						ownerId,
						companyId: companyRow.id
					})
					.returning()

				if (!teamRow) {
					throw new Error('Failed to create team')
				}

				await tx.insert(companyUsers).values({
					companyId: companyRow.id,
					userId: ownerId
				})

				await tx.insert(teamUsers).values({
					teamId: teamRow.id,
					userId: ownerId
				})

				await tx.insert(userRoles).values({
					userId: ownerId,
					companyId: companyRow.id,
					role: UserRoles.Owner
				})

				const company = this.mapRow(companyRow)
				const team: TeamInterface = {
					id: teamRow.id,
					name: teamRow.name,
					ownerId: teamRow.ownerId,
					companyId: teamRow.companyId,
					settings: teamRow.settings ?? {},
					createdAt: teamRow.createdAt,
					updatedAt: teamRow.updatedAt
				}

				return {
					company: {
						...company,
						teams: [team],
						users: []
					},
					team
				}
			})
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async hydrateCompanyMembers({
		companyId,
		ownerId
	}: {
		companyId: string
		ownerId: string
	}): Promise<{ users: CompanyInterface['users']; teams: TeamInterface[] }> {
		const db = getDb()
		const ownerRows = await db
			.select()
			.from(users)
			.where(eq(users.id, ownerId))
			.limit(1)
		const owner = ownerRows[0]
		if (!owner) {
			throw new Error('Owner not found')
		}

		const ownerUser: UserInterface = {
			id: owner.id,
			clerkId: owner.clerkId,
			firstName: owner.firstName,
			lastName: owner.lastName,
			email: owner.email,
			avatar: owner.avatar,
			status: owner.status as UserStatus,
			invitedById: owner.invitedById,
			createdAt: owner.createdAt,
			updatedAt: owner.updatedAt
		}

		const teamRows = await db
			.select({ team: teams })
			.from(teams)
			.where(eq(teams.companyId, companyId))

		const mappedTeams: TeamInterface[] = teamRows.map((r) => ({
			id: r.team.id,
			name: r.team.name,
			ownerId: r.team.ownerId,
			companyId: r.team.companyId,
			settings: r.team.settings ?? {},
			createdAt: r.team.createdAt,
			updatedAt: r.team.updatedAt
		}))

		return {
			users: [ownerUser],
			teams: mappedTeams
		}
	}

	public async create({
		data
	}: {
		data: Pick<CompanyInterface, 'ownerId' | 'name' | 'settings'>
	}): Promise<CompanyInterface> {
		return super.insertReturning({
			values: {
				ownerId: data.ownerId,
				name: data.name,
				settings: data.settings ?? {}
			}
		})
	}

	public async update({
		filter,
		data
	}: {
		filter: CompanyFilter
		data: Partial<Pick<CompanyInterface, 'name' | 'settings'>>
	}): Promise<CompanyInterface | null> {
		return super.update({ filter, data })
	}
}
