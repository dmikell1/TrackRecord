import path from 'path'

import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg, { Pool } from 'pg'

import { isDevelopment } from '@packages/utils/isDevelopment'
import { env } from '@packages/utils/validateEnvs'

import { schema } from '@packages/database/schema'

// Force PostgreSQL `timestamp without time zone` (OID 1114) to be parsed as UTC.
// Without this, the pg driver uses the Node.js process timezone which causes
// incorrect times when the server isn't running in UTC (e.g. local development).
pg.types.setTypeParser(1114, (str: string) => new Date(str + '+00'))

export const POSTGRES_URL = isDevelopment
    ? (env.POSTGRES_URL ?? 'postgresql://localhost:5432/salesaxis')
    : `postgresql://${encodeURIComponent(env.POSTGRES_USER)}:${encodeURIComponent(env.POSTGRES_PASSWORD)}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${env.POSTGRES_DB}`

const MAX_RETRY_ATTEMPTS = 5
const RETRY_DELAY_MS = 3000

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

let pool: Pool | null = null
let dbInstance: ReturnType<typeof drizzle> | null = null

export const connectToPostgresDatabase = async ({
    dbString,
    maxRetries = MAX_RETRY_ATTEMPTS
}: {
    dbString: string
    maxRetries?: number
}): Promise<void> => {
    let retryCount = 0

    while (retryCount < maxRetries) {
        try {
            // Connect directly using the provided connection string
            pool = new Pool({
                connectionString: dbString,
                max: env.DB_POOL_SIZE || 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 5000
            })

            // Ensure all sessions use UTC so NOW() and timestamp handling are consistent
            pool.on('connect', (client) => {
                client.query("SET timezone = 'UTC'")
            })

            // Test connection
            await pool.query('SELECT 1')

            dbInstance = drizzle(pool, { schema })

            // Auto-run migrations if enabled (runs in all environments, like TypeORM migrationsRun: true)
            if (env.AUTO_RUN_MIGRATIONS) {
                const migrationsFolder = path.join(
                    process.cwd(),
                    'packages/database/migrations'
                )
                console.log(
                    `Running database migrations from: ${migrationsFolder}`
                )
                await migrate(dbInstance, { migrationsFolder })
                console.log('Database migrations completed successfully')
            }

            console.log(
                `Connected to PostgreSQL database successfully`
            )

            pool.on('error', (error: Error) => {
                console.error('PostgreSQL connection error:', error)
            })

            return
        } catch (error) {
            retryCount++
            const errorMessage =
                error instanceof Error ? error.message : String(error)

            if (retryCount >= maxRetries) {
                console.error(
                    `Failed to connect to PostgreSQL after ${maxRetries} attempts:`,
                    errorMessage
                )
                console.error(`\nConnection string: ${dbString}`)
                process.exit(1)
            }

            console.warn(
                `PostgreSQL connection attempt ${retryCount}/${maxRetries} failed: ${errorMessage}. Retrying in ${RETRY_DELAY_MS}ms...`
            )

            await delay(RETRY_DELAY_MS * retryCount)
        }
    }
}

export const getDb = (): ReturnType<typeof drizzle> => {
    if (!dbInstance) {
        throw new Error(
            'Database not initialized. Call connectToPostgresDatabase first.'
        )
    }
    return dbInstance
}

export const getPool = (): Pool => {
    if (!pool) {
        throw new Error(
            'Database not initialized. Call connectToPostgresDatabase first.'
        )
    }
    return pool
}
export const closePostgresConnection = async (): Promise<void> => {
    if (pool) {
        await pool.end()
        pool = null
        dbInstance = null
        console.log('PostgreSQL connection closed')
    }
}
