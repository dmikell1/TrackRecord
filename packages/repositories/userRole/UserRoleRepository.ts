import { eq, type SQL } from 'drizzle-orm'
import { inject, injectable, singleton } from 'tsyringe'

import { userRoles } from '@packages/database/schema'
import { UserRoles } from '@packages/enums'
import { BaseRepository } from '@packages/repositories/BaseRepository'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'

export type UserRoleFilter = {
	id?: string
	userId?: string
	companyId?: string
	role?: UserRoles
}

export interface UserRoleInterface {
	id: string
	userId: string
	companyId: string
	role: UserRoles
	createdAt?: Date
	updatedAt?: Date
}

type UserRoleRow = typeof userRoles.$inferSelect

@injectable()
@singleton()
@ReportErrors()
export class UserRoleRepository extends BaseRepository<
	typeof userRoles,
	UserRoleInterface,
	UserRoleFilter
> {
	constructor(@inject(ReportingService) reportingService: ReportingService) {
		super(reportingService, userRoles)
	}

	protected mapRow(row: UserRoleRow): UserRoleInterface {
		return {
			id: row.id,
			userId: row.userId,
			companyId: row.companyId,
			role: row.role as UserRoles,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt
		}
	}

	protected buildConditions({
		filter
	}: {
		filter: UserRoleFilter
	}): SQL[] {
		const parts: SQL[] = []
		if (filter.id !== undefined) {
			parts.push(eq(userRoles.id, filter.id))
		}
		if (filter.userId !== undefined) {
			parts.push(eq(userRoles.userId, filter.userId))
		}
		if (filter.companyId !== undefined) {
			parts.push(eq(userRoles.companyId, filter.companyId))
		}
		if (filter.role !== undefined) {
			parts.push(eq(userRoles.role, filter.role))
		}
		return parts
	}

	public async create({
		data
	}: {
		data: Pick<UserRoleInterface, 'userId' | 'companyId' | 'role'>
	}): Promise<UserRoleInterface> {
		return super.insertReturning({
			values: {
				userId: data.userId,
				companyId: data.companyId,
				role: data.role
			}
		})
	}
}
