import { timestamp } from 'drizzle-orm/pg-core'

/** Default `created_at` / `updated_at` for entity tables (junction tables, etc.). */
export const standardTimestamps = {
	createdAt: timestamp('created_at', { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.defaultNow()
		.notNull()
} as const
