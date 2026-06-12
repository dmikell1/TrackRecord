import { sql } from 'drizzle-orm'

import { getDb } from '@packages/database/createPostgresConnection'

/** Clears app tables between integration tests (PostgreSQL). */
export async function truncateAllApplicationTables(): Promise<void> {
	await getDb().execute(
		sql.raw(
			'TRUNCATE TABLE session, user_roles, team_users, company_users, teams, companies, users RESTART IDENTITY CASCADE'
		)
	)
}
