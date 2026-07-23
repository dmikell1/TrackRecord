import { and, eq, inArray, type SQL } from 'drizzle-orm'
import { inject, injectable, singleton } from 'tsyringe'

import { pushDeviceTokens } from '@packages/database/schema'
import { getDb } from '@packages/database/createPostgresConnection'
import { PushPlatform } from '@packages/enums/push'
import { BaseRepository } from '@packages/repositories/BaseRepository'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import type { PushDeviceTokenInterface } from '@packages/types/pushDeviceToken'

export type PushDeviceTokenFilter = {
	id?: string
	userId?: string
	token?: string
	platform?: PushPlatform
}

type PushDeviceTokenRow = typeof pushDeviceTokens.$inferSelect

@injectable()
@singleton()
@ReportErrors()
export class PushDeviceTokenRepository extends BaseRepository<
	typeof pushDeviceTokens,
	PushDeviceTokenInterface,
	PushDeviceTokenFilter
> {
	constructor(@inject(ReportingService) reportingService: ReportingService) {
		super(reportingService, pushDeviceTokens)
	}

	protected mapRow(row: PushDeviceTokenRow): PushDeviceTokenInterface {
		return {
			id: row.id,
			userId: row.userId,
			token: row.token,
			platform: row.platform as PushPlatform,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt
		}
	}

	protected buildConditions({ filter }: { filter: PushDeviceTokenFilter }): SQL[] {
		const parts: SQL[] = []
		if (filter.id !== undefined) {
			parts.push(eq(pushDeviceTokens.id, filter.id))
		}
		if (filter.userId !== undefined) {
			parts.push(eq(pushDeviceTokens.userId, filter.userId))
		}
		if (filter.token !== undefined) {
			parts.push(eq(pushDeviceTokens.token, filter.token))
		}
		if (filter.platform !== undefined) {
			parts.push(eq(pushDeviceTokens.platform, filter.platform))
		}
		return parts
	}

	public async upsertToken({ data }: {
		data: {
			userId: string
			token: string
			platform: PushPlatform
		}
	}): Promise<PushDeviceTokenInterface> {
		return this.upsertReturning({
			values: {
				userId: data.userId,
				token: data.token,
				platform: data.platform
			},
			conflictTarget: pushDeviceTokens.token,
			updateSet: {
				userId: data.userId,
				platform: data.platform
			}
		})
	}

	public async findByUserId({
		userId
	}: {
		userId: string
	}): Promise<PushDeviceTokenInterface[]> {
		return this.find({ filter: { userId } })
	}

	public async deleteByToken({ token }: { token: string }): Promise<boolean> {
		try {
			const db = getDb()
			await db.delete(pushDeviceTokens).where(eq(pushDeviceTokens.token, token))
			return true
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async deleteByTokens({ tokens }: { tokens: string[] }): Promise<boolean> {
		if (tokens.length === 0) {
			return true
		}

		try {
			const db = getDb()
			await db.delete(pushDeviceTokens).where(inArray(pushDeviceTokens.token, tokens))
			return true
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async deleteByUserAndToken({
		userId,
		token
	}: {
		userId: string
		token: string
	}): Promise<boolean> {
		try {
			const db = getDb()
			await db
				.delete(pushDeviceTokens)
				.where(and(eq(pushDeviceTokens.userId, userId), eq(pushDeviceTokens.token, token)))
			return true
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}
}
