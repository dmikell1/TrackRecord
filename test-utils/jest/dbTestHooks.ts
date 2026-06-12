import {
	connectToPostgresDatabase,
	disconnectPostgresDatabase
} from '@packages/database/createPostgresConnection'
import { truncateAllApplicationTables } from '@packages/database/truncateTestTables'
import { env } from '@packages/utils/validateEnvs'

export async function connectIntegrationTestDb(): Promise<void> {
	await connectToPostgresDatabase({
		connectionString: env.TEST_DATABASE_URL,
		syncSchema: false
	})
}

export async function resetIntegrationTestDb(): Promise<void> {
	await truncateAllApplicationTables()
}

export async function disconnectIntegrationTestDb(): Promise<void> {
	await disconnectPostgresDatabase()
}
