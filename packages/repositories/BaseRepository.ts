import {
	and,
	type AnyColumn,
	getTableColumns,
	type InferInsertModel,
	type InferSelectModel,
	sql,
	type SQL
} from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import { inject } from 'tsyringe'

import { getDb } from '@packages/database/createPostgresConnection'
import { ReportingService } from '@packages/services/logging/ReportingService'

/**
 * CRUD + upsert + count for single-table Drizzle entities with `id` and standard timestamps.
 * Subclasses supply `mapRow`, `buildConditions`, and call `insertReturning` / `upsertReturning`
 * from typed `create` / `upsert` public methods.
 */
export abstract class BaseRepository<
	TTable extends PgTable,
	TInterface,
	TFilter
> {
	constructor(
		@inject(ReportingService)
		protected reportingService: ReportingService,
		protected readonly table: TTable
	) {}

	protected abstract mapRow(row: InferSelectModel<TTable>): TInterface

	protected abstract buildConditions({
		filter
	}: {
		filter: TFilter
	}): SQL[]

	protected combineWhere({ parts }: { parts: SQL[] }): SQL | undefined {
		if (parts.length === 0) {
			return undefined
		}
		return and(...parts)
	}

	protected tableHasUpdatedAtColumn(): boolean {
		return 'updatedAt' in getTableColumns(this.table)
	}

	/** Drizzle loses concrete table inference on generic `TTable`; narrow at I/O boundary. */
	protected get pgTable(): PgTable {
		return this.table as unknown as PgTable
	}

	protected async insertReturning({
		values
	}: {
		values: InferInsertModel<TTable>
	}): Promise<TInterface> {
		try {
			const db = getDb()
			const [row] = await db
				.insert(this.pgTable)
				.values(values as never)
				.returning()
			if (!row) {
				throw new Error('Insert returned no row')
			}
			return this.mapRow(row as InferSelectModel<TTable>)
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	/**
	 * INSERT … ON CONFLICT DO UPDATE returning the persisted row.
	 *
	 * @param values         - Full insert payload.
	 * @param conflictTarget - Column(s) that form the unique constraint driving the conflict
	 *                         (e.g. `users.email`, `[table.teamId, table.userId]`).
	 * @param updateSet      - Fields to update on conflict.  When omitted, every field from
	 *                         `values` except `id` and `createdAt` is updated automatically,
	 *                         plus `updatedAt` is refreshed if the table has that column.
	 */
	protected async upsertReturning({
		values,
		conflictTarget,
		updateSet
	}: {
		values: InferInsertModel<TTable>
		conflictTarget: AnyColumn | AnyColumn[] | SQL
		updateSet?: Partial<
			Omit<InferInsertModel<TTable>, 'id' | 'createdAt' | 'updatedAt'>
		>
	}): Promise<TInterface> {
		try {
			const db = getDb()

			// Build SET payload for the conflict branch.
			const setPayload: Record<string, unknown> = updateSet
				? { ...updateSet }
				: Object.fromEntries(
						Object.entries(
							values as Record<string, unknown>
						).filter(([key]) => key !== 'id' && key !== 'createdAt')
					)

			// Always refresh updatedAt on conflict when the column exists.
			if (this.tableHasUpdatedAtColumn()) {
				setPayload.updatedAt = new Date()
			}

			const target = Array.isArray(conflictTarget)
				? conflictTarget
				: [conflictTarget]

			const [row] = await db
				.insert(this.pgTable)
				.values(values as never)
				.onConflictDoUpdate({
					target: target as never,
					set: setPayload as never
				})
				.returning()

			if (!row) {
				throw new Error('Upsert returned no row')
			}
			return this.mapRow(row as InferSelectModel<TTable>)
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async findOne({
		filter
	}: {
		filter: TFilter
	}): Promise<TInterface | null> {
		try {
			const parts = this.buildConditions({ filter })
			const whereClause = this.combineWhere({ parts })
			if (whereClause === undefined) {
				return null
			}
			const db = getDb()
			const rows = await db
				.select()
				.from(this.pgTable)
				.where(whereClause)
				.limit(1)
			const row = rows[0]
			return row ? this.mapRow(row as InferSelectModel<TTable>) : null
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async find({
		filter,
		limit,
		offset
	}: {
		filter: TFilter
		limit?: number
		offset?: number
	}): Promise<TInterface[]> {
		try {
			const db = getDb()
			const parts = this.buildConditions({ filter })
			const whereClause = this.combineWhere({ parts })
			let query = db.select().from(this.pgTable).$dynamic()
			if (whereClause !== undefined) {
				query = query.where(whereClause)
			}
			if (limit !== undefined) {
				query = query.limit(limit)
			}
			if (offset !== undefined) {
				query = query.offset(offset)
			}
			const rows = await query
			return rows.map((r) =>
				this.mapRow(r as InferSelectModel<TTable>)
			)
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async findOneOrFail({
		filter
	}: {
		filter: TFilter
	}): Promise<TInterface> {
		const item = await this.findOne({ filter })
		if (!item) {
			throw new Error('Entity not found')
		}
		return item
	}

	public async update({
		filter,
		data
	}: {
		filter: TFilter
		data: Partial<
			Omit<InferSelectModel<TTable>, 'id' | 'createdAt' | 'updatedAt'>
		>
	}): Promise<TInterface | null> {
		try {
			const parts = this.buildConditions({ filter })
			const whereClause = this.combineWhere({ parts })
			if (whereClause === undefined) {
				throw new Error('update requires filter')
			}
			const db = getDb()
			const setPayload: Record<string, unknown> = { ...data }
			if (this.tableHasUpdatedAtColumn()) {
				setPayload.updatedAt = new Date()
			}
			const [row] = await db
				.update(this.pgTable)
				.set(setPayload as never)
				.where(whereClause)
				.returning()
			return row ? this.mapRow(row as InferSelectModel<TTable>) : null
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async delete({ filter }: { filter: TFilter }): Promise<boolean> {
		try {
			const parts = this.buildConditions({ filter })
			const whereClause = this.combineWhere({ parts })
			if (whereClause === undefined) {
				throw new Error('delete requires filter')
			}
			const db = getDb()
			const removed = await db
				.delete(this.pgTable)
				.where(whereClause)
				.returning()
			return removed.length > 0
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async count({ filter }: { filter: TFilter }): Promise<number> {
		try {
			const db = getDb()
			const parts = this.buildConditions({ filter })
			const whereClause = this.combineWhere({ parts })
			let query = db
				.select({ c: sql<number>`count(*)::int` })
				.from(this.pgTable)
				.$dynamic()
			if (whereClause !== undefined) {
				query = query.where(whereClause)
			}
			const rows = await query
			return rows[0]?.c ?? 0
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}
}
