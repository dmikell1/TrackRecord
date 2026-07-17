/* eslint-disable @typescript-eslint/no-require-imports, no-console */
/**
 * Jest globalSetup runs in a separate Node.js process where Jest's
 * moduleNameMapper is NOT active.  We must register tsconfig-paths before
 * any `@packages/*` module is loaded.
 *
 * All side-effectful setup (dotenv, tsconfig-paths) must use synchronous
 * require() calls placed BEFORE TypeScript import statements, because
 * ts-jest compiles `import` to CommonJS `require` and HOISTS them.
 * That means any `import`-based alias would fail before our runtime
 * tsconfig-paths hook fires — so we avoid top-level aliased imports here
 * and instead use require() inline inside the async function.
 */

// 1. Register path aliases so @packages/* resolves correctly
require('tsconfig-paths').register({
	baseUrl: process.cwd(),
	paths: {
		'@packages/*': ['packages/*'],
		'@api-core/*': ['api-core/*'],
		'@test-utils/*': ['test-utils/*'],
		'@builders/*': ['test-utils/builders/*']
	}
})

// 2. Load test-local env overrides, then fall back to .env defaults
require('dotenv').config({ path: '.env.test.local', override: true })
require('dotenv').config({ path: '.env' })

// 3. reflect-metadata must be imported before tsyringe resolves anything
require('reflect-metadata')

export default async function globalSetup(): Promise<void> {
	// Deferred requires — path aliases are now active
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const { closePostgresConnection, connectToPostgresDatabase } = require(
		'@packages/database/createPostgresConnection'
	) as typeof import('@packages/database/createPostgresConnection')

	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const { env } = require('@packages/utils/validateEnvs') as typeof import(
		'@packages/utils/validateEnvs'
	)

	console.log('🧪 Initialising global test setup...')
	try {
		await connectToPostgresDatabase({
			dbString: env.TEST_DATABASE_URL
		})
		await closePostgresConnection()
		console.log('🧪 Global test setup complete — schema synced.')
	} catch (err) {
		console.error('🧪 Global test setup failed:', err)
		throw err
	}
}
