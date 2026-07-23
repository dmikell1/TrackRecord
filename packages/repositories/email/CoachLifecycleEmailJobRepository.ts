import { and, eq, inArray, lte, type SQL } from 'drizzle-orm'
import { inject, injectable, singleton } from 'tsyringe'

import { getDb } from '@packages/database/createPostgresConnection'
import { coachLifecycleEmailJobs } from '@packages/database/schema'
import {
	CoachLifecycleEmailJobStatus,
	CoachLifecycleEmailStep
} from '@packages/enums'
import { BaseRepository } from '@packages/repositories/BaseRepository'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import type { CoachLifecycleEmailJobInterface } from '@packages/types/coachLifecycleEmailJob'

export type CoachLifecycleEmailJobFilter = {
	id?: string
	userId?: string
	companyId?: string
	teamId?: string
	step?: CoachLifecycleEmailStep
	status?: CoachLifecycleEmailJobStatus
}

type CoachLifecycleEmailJobRow = typeof coachLifecycleEmailJobs.$inferSelect

@injectable()
@singleton()
@ReportErrors()
export class CoachLifecycleEmailJobRepository extends BaseRepository<
	typeof coachLifecycleEmailJobs,
	CoachLifecycleEmailJobInterface,
	CoachLifecycleEmailJobFilter
> {
	constructor(@inject(ReportingService) reportingService: ReportingService) {
		super(reportingService, coachLifecycleEmailJobs)
	}

	protected mapRow(
		row: CoachLifecycleEmailJobRow
	): CoachLifecycleEmailJobInterface {
		return {
			id: row.id,
			userId: row.userId,
			companyId: row.companyId,
			teamId: row.teamId,
			step: row.step as CoachLifecycleEmailStep,
			status: row.status as CoachLifecycleEmailJobStatus,
			scheduledFor: row.scheduledFor,
			sentAt: row.sentAt ?? null,
			skippedAt: row.skippedAt ?? null,
			skipReason: row.skipReason ?? null,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt
		}
	}

	protected buildConditions({
		filter
	}: {
		filter: CoachLifecycleEmailJobFilter
	}): SQL[] {
		const parts: SQL[] = []
		if (filter.id !== undefined) {
			parts.push(eq(coachLifecycleEmailJobs.id, filter.id))
		}
		if (filter.userId !== undefined) {
			parts.push(eq(coachLifecycleEmailJobs.userId, filter.userId))
		}
		if (filter.companyId !== undefined) {
			parts.push(eq(coachLifecycleEmailJobs.companyId, filter.companyId))
		}
		if (filter.teamId !== undefined) {
			parts.push(eq(coachLifecycleEmailJobs.teamId, filter.teamId))
		}
		if (filter.step !== undefined) {
			parts.push(eq(coachLifecycleEmailJobs.step, filter.step))
		}
		if (filter.status !== undefined) {
			parts.push(eq(coachLifecycleEmailJobs.status, filter.status))
		}
		return parts
	}

	public async createJob({
		data
	}: {
		data: {
			userId: string
			companyId: string
			teamId: string
			step: CoachLifecycleEmailStep
			status?: CoachLifecycleEmailJobStatus
			scheduledFor: Date
			sentAt?: Date | null
			skippedAt?: Date | null
			skipReason?: string | null
		}
	}): Promise<CoachLifecycleEmailJobInterface> {
		return this.insertReturning({
			values: {
				userId: data.userId,
				companyId: data.companyId,
				teamId: data.teamId,
				step: data.step,
				status: data.status ?? CoachLifecycleEmailJobStatus.Pending,
				scheduledFor: data.scheduledFor,
				...(data.sentAt !== undefined && { sentAt: data.sentAt }),
				...(data.skippedAt !== undefined && {
					skippedAt: data.skippedAt
				}),
				...(data.skipReason !== undefined && {
					skipReason: data.skipReason
				})
			}
		})
	}

	public async upsertPendingJob({
		data
	}: {
		data: {
			userId: string
			companyId: string
			teamId: string
			step: CoachLifecycleEmailStep
			scheduledFor: Date
		}
	}): Promise<CoachLifecycleEmailJobInterface> {
		return this.upsertReturning({
			values: {
				userId: data.userId,
				companyId: data.companyId,
				teamId: data.teamId,
				step: data.step,
				status: CoachLifecycleEmailJobStatus.Pending,
				scheduledFor: data.scheduledFor,
				sentAt: null,
				skippedAt: null,
				skipReason: null
			},
			conflictTarget: [
				coachLifecycleEmailJobs.userId,
				coachLifecycleEmailJobs.step
			],
			updateSet: {
				companyId: data.companyId,
				teamId: data.teamId,
				status: CoachLifecycleEmailJobStatus.Pending,
				scheduledFor: data.scheduledFor,
				sentAt: null,
				skippedAt: null,
				skipReason: null
			}
		})
	}

	public async findDuePending({
		now,
		limit = 50
	}: {
		now: Date
		limit?: number
	}): Promise<CoachLifecycleEmailJobInterface[]> {
		try {
			const db = getDb()
			const rows = await db
				.select()
				.from(coachLifecycleEmailJobs)
				.where(
					and(
						eq(
							coachLifecycleEmailJobs.status,
							CoachLifecycleEmailJobStatus.Pending
						),
						lte(coachLifecycleEmailJobs.scheduledFor, now)
					)
				)
				.limit(limit)

			return rows.map(row => this.mapRow(row))
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async markSent({
		id
	}: {
		id: string
	}): Promise<CoachLifecycleEmailJobInterface | null> {
		return this.update({
			filter: { id },
			data: {
				status: CoachLifecycleEmailJobStatus.Sent,
				sentAt: new Date(),
				skippedAt: null,
				skipReason: null
			}
		})
	}

	public async markSkipped({
		id,
		reason
	}: {
		id: string
		reason: string
	}): Promise<CoachLifecycleEmailJobInterface | null> {
		return this.update({
			filter: { id },
			data: {
				status: CoachLifecycleEmailJobStatus.Skipped,
				skippedAt: new Date(),
				skipReason: reason
			}
		})
	}

	public async cancelPendingSteps({
		userId,
		steps
	}: {
		userId: string
		steps: CoachLifecycleEmailStep[]
	}): Promise<number> {
		if (steps.length === 0) {
			return 0
		}

		try {
			const db = getDb()
			const result = await db
				.update(coachLifecycleEmailJobs)
				.set({
					status: CoachLifecycleEmailJobStatus.Cancelled,
					updatedAt: new Date()
				})
				.where(
					and(
						eq(coachLifecycleEmailJobs.userId, userId),
						eq(
							coachLifecycleEmailJobs.status,
							CoachLifecycleEmailJobStatus.Pending
						),
						inArray(coachLifecycleEmailJobs.step, steps)
					)
				)
				.returning({ id: coachLifecycleEmailJobs.id })

			return result.length
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}
}
