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
import { BaseRepository } from '@packages/repositories/BaseRepository'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { UserRoles as UserRolesEnum } from '@packages/enums'
import type { CompanyInterface } from '@packages/types/company'
import type { TeamInterface } from '@packages/types/team'
import type { UserInterface } from '@packages/types/user'

export type UserFilter = {
	id?: string
	email?: string
	clerkId?: string
}

export type UserRelationLoad = {
	loadCompanies?: boolean
	loadTeams?: boolean
	loadRoles?: boolean
}

type UserRow = typeof users.$inferSelect

@injectable()
@singleton()
@ReportErrors()
export class UserRepository extends BaseRepository<
	typeof users,
	UserInterface,
	UserFilter
> {
	constructor(@inject(ReportingService) reportingService: ReportingService) {
		super(reportingService, users)
	}

	protected mapRow(row: UserRow): UserInterface {
		return {
			id: row.id,
			clerkId: row.clerkId,
			firstName: row.firstName,
			lastName: row.lastName,
			email: row.email,
			avatar: row.avatar,
			status: row.status as UserInterface['status'],
			invitedById: row.invitedById,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt
		}
	}

	protected buildConditions({
		filter
	}: {
		filter: UserFilter
	}): SQL[] {
		const parts: SQL[] = []
		if (filter.id !== undefined) {
			parts.push(eq(users.id, filter.id))
		}
		if (filter.email !== undefined) {
			parts.push(eq(users.email, filter.email.toLowerCase()))
		}
		if (filter.clerkId !== undefined) {
			parts.push(eq(users.clerkId, filter.clerkId))
		}
		return parts
	}

	private async loadCompaniesForUser({
		userId
	}: {
		userId: string
	}): Promise<CompanyInterface[]> {
		const db = getDb()
		const rows = await db
			.select({ company: companies })
			.from(companyUsers)
			.innerJoin(companies, eq(companyUsers.companyId, companies.id))
			.where(eq(companyUsers.userId, userId))

		return rows.map((r) => ({
			id: r.company.id,
			ownerId: r.company.ownerId,
			name: r.company.name,
			settings: r.company.settings,
			createdAt: r.company.createdAt,
			updatedAt: r.company.updatedAt
		}))
	}

	private async loadTeamsForUser({
		userId
	}: {
		userId: string
	}): Promise<TeamInterface[]> {
		const db = getDb()
		const rows = await db
			.select({ team: teams })
			.from(teamUsers)
			.innerJoin(teams, eq(teamUsers.teamId, teams.id))
			.where(eq(teamUsers.userId, userId))

		return rows.map((r) => ({
			id: r.team.id,
			name: r.team.name,
			ownerId: r.team.ownerId,
			companyId: r.team.companyId,
			settings: r.team.settings ?? {},
			createdAt: r.team.createdAt,
			updatedAt: r.team.updatedAt
		}))
	}

	private async loadRolesForUser({
		userId
	}: {
		userId: string
	}): Promise<NonNullable<UserInterface['roles']>> {
		const db = getDb()
		const rows = await db
			.select({ userRole: userRoles, company: companies })
			.from(userRoles)
			.innerJoin(companies, eq(userRoles.companyId, companies.id))
			.where(eq(userRoles.userId, userId))

		return rows.map((r) => ({
			role: r.userRole.role as UserRolesEnum,
			companyId: r.userRole.companyId,
			company: {
				id: r.company.id,
				ownerId: r.company.ownerId,
				name: r.company.name,
				settings: r.company.settings,
				createdAt: r.company.createdAt,
				updatedAt: r.company.updatedAt
			}
		}))
	}

	public async create({
		data
	}: {
		data: Pick<
			UserInterface,
			| 'firstName'
			| 'lastName'
			| 'email'
			| 'avatar'
			| 'status'
		> &
			Partial<
				Pick<UserInterface, 'clerkId' | 'invitedById' | 'createdAt' | 'updatedAt'>
			>
	}): Promise<UserInterface> {
		return super.insertReturning({
			values: {
				firstName: data.firstName,
				lastName: data.lastName,
				email: data.email.toLowerCase(),
				avatar: data.avatar,
				status: data.status,
				...(data.clerkId !== undefined && data.clerkId !== null
					? { clerkId: data.clerkId }
					: {}),
				...(data.invitedById !== undefined && data.invitedById !== null
					? { invitedById: data.invitedById }
					: {})
			}
		})
	}

	public async findOne({
		filter,
		relations
	}: {
		filter: UserFilter
		relations?: UserRelationLoad
	}): Promise<UserInterface | null> {
		try {
			const db = getDb()
			const parts = this.buildConditions({ filter })
			const whereClause = this.combineWhere({ parts })

			let query = db.select().from(users).$dynamic()
			if (whereClause !== undefined) {
				query = query.where(whereClause)
			}

			const rows = await query.limit(1)
			const row = rows[0]
			if (!row) {
				return null
			}

			let result = this.mapRow(row)
			if (relations?.loadCompanies === true) {
				result = {
					...result,
					companies: await this.loadCompaniesForUser({ userId: row.id })
				}
			}
			if (relations?.loadTeams === true) {
				result = {
					...result,
					teams: await this.loadTeamsForUser({ userId: row.id })
				}
			}
			if (relations?.loadRoles === true) {
				result = {
					...result,
					roles: await this.loadRolesForUser({ userId: row.id })
				}
			}
			return result
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async find({
		filter,
		relations
	}: {
		filter: UserFilter
		relations?: UserRelationLoad
	}): Promise<UserInterface[]> {
		try {
			const db = getDb()
			const parts = this.buildConditions({ filter })
			const whereClause = this.combineWhere({ parts })

			let query = db.select().from(users).$dynamic()
			if (whereClause !== undefined) {
				query = query.where(whereClause)
			}

			const rows = await query
			const mapped = await Promise.all(
				rows.map(async (row) => {
					let u = this.mapRow(row)
					if (relations?.loadCompanies === true) {
						u = {
							...u,
							companies: await this.loadCompaniesForUser({ userId: row.id })
						}
					}
					if (relations?.loadTeams === true) {
						u = {
							...u,
							teams: await this.loadTeamsForUser({ userId: row.id })
						}
					}
					if (relations?.loadRoles === true) {
						u = {
							...u,
							roles: await this.loadRolesForUser({ userId: row.id })
						}
					}
					return u
				})
			)
			return mapped
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async findOneOrFail({
		filter,
		relations
	}: {
		filter: UserFilter
		relations?: UserRelationLoad
	}): Promise<UserInterface> {
		const item = await this.findOne({ filter, relations })
		if (!item) {
			throw new Error('Entity not found')
		}
		return item
	}

	public async update({
		filter,
		data
	}: {
		filter: UserFilter
		data: Partial<
			Pick<
				UserInterface,
				| 'firstName'
				| 'lastName'
				| 'email'
				| 'avatar'
				| 'status'
				| 'clerkId'
			>
		>
	}): Promise<UserInterface | null> {
		const normalizedEmail =
			data.email !== undefined ? data.email.toLowerCase() : undefined
		return super.update({
			filter,
			data: {
				...data,
				...(normalizedEmail !== undefined && { email: normalizedEmail })
			}
		})
	}

	public async findByEmail({
		email
	}: {
		email: string
	}): Promise<UserInterface | null> {
		return this.findOne({
			filter: { email: email.toLowerCase() }
		})
	}

	public async findByClerkId({
		clerkId
	}: {
		clerkId: string
	}): Promise<UserInterface | null> {
		return this.findOne({ filter: { clerkId } })
	}
}
