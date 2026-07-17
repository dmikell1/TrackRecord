/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Same constraint as globalSetup.ts — moduleNameMapper is inactive here.
 * Register tsconfig-paths synchronously before any aliased require().
 */

require('tsconfig-paths').register({
	baseUrl: process.cwd(),
	paths: {
		'@packages/*': ['packages/*'],
		'@api-core/*': ['api-core/*'],
		'@test-utils/*': ['test-utils/*'],
		'@builders/*': ['test-utils/builders/*']
	}
})

require('dotenv').config({ path: '.env.test.local', override: true })
require('dotenv').config({ path: '.env' })

require('reflect-metadata')

export default async function globalTeardown(): Promise<void> {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const { closePostgresConnection } = require(
		'@packages/database/createPostgresConnection'
	) as typeof import('@packages/database/createPostgresConnection')

	await closePostgresConnection()
}
