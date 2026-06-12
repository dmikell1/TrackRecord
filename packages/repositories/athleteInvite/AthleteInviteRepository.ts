import { eq, type SQL } from 'drizzle-orm'
import { inject, injectable, singleton } from 'tsyringe'

import { athleteInvites } from '@packages/database/schema'
import { BaseRepository } from '@packages/repositories/BaseRepository'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import type { AthleteInviteInterface } from '@packages/types/athleteInvite'

export type AthleteInviteFilter = {
	id?: string
	teamId?: string
	token?: string
	email?: string
	status?: string
}

type AthleteInviteRow = typeof athleteInvites.$inferSelect

@injectable()
@singleton()
@ReportErrors()
export class AthleteInviteRepository extends BaseRepository<
	typeof athleteInvites,
	AthleteInviteInterface,
	AthleteInviteFilter
> {
	constructor(@inject(ReportingService) reportingService: ReportingService) {
		super(reportingService, athleteInvites)
	}

	protected mapRow(row: AthleteInviteRow): AthleteInviteInterface {
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

	protected buildConditions({ filter }: { filter: AthleteInviteFilter }): SQL[] {
		const parts: SQL[] = []
		if (filter.id !== undefined) parts.push(eq(athleteInvites.id, filter.id))
		if (filter.teamId !== undefined) parts.push(eq(athleteInvites.teamId, filter.teamId))
		if (filter.token !== undefined) parts.push(eq(athleteInvites.token, filter.token))
		if (filter.email !== undefined) parts.push(eq(athleteInvites.email, filter.email.toLowerCase()))
		if (filter.status !== undefined) parts.push(eq(athleteInvites.status, filter.status))
		return parts
	}

	public async create({ data }: {
		data: Pick<AthleteInviteInterface, 'teamId' | 'email' | 'token' | 'expiresAt'>
	}): Promise<AthleteInviteInterface> {
		return super.insertReturning({
			values: {
				teamId: data.teamId,
				email: data.email.toLowerCase(),
				token: data.token,
				expiresAt: data.expiresAt
			}
		})
	}
}
