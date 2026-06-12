import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { env } from '@packages/utils/validateEnvs'

import { INIT_SQL } from '@packages/database/initSql'
import { schema } from '@packages/database/schema'

export const POSTGRES_URL = env.DATABASE_URL

let sql: postgres.Sql | undefined
let db: ReturnType<typeof drizzle<typeof schema>> | undefined

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
	if (!db) {
		throw new Error('PostgreSQL not connected; call connectToPostgresDatabase first')
	}
	return db
}

export async function connectToPostgresDatabase({
	connectionString,
	syncSchema = false
}: {
	connectionString: string
	syncSchema?: boolean
}): Promise<void> {
	sql = postgres(connectionString, { max: 10 })
	if (syncSchema) {
		await sql.unsafe(INIT_SQL)
	}
	db = drizzle(sql, { schema })
}

export async function disconnectPostgresDatabase(): Promise<void> {
	await sql?.end({ timeout: 5 })
	sql = undefined
	db = undefined
}
