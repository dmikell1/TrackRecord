import type { Config } from 'jest'

const config: Config = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	coverageDirectory: './coverage',
	clearMocks: true,
	reporters: ['default'],
	testTimeout: 20000,
	testMatch: ['<rootDir>/**/*.test.ts', '<rootDir>/**/*.spec.ts'],
	globalSetup: '<rootDir>/test-utils/jest/globalSetup.ts',
	globalTeardown: '<rootDir>/test-utils/jest/globalTeardown.ts',
	setupFiles: ['<rootDir>/test-utils/jest/setup.ts'],
	modulePathIgnorePatterns: ['<rootDir>/build'],
	// Measure coverage only for core business logic.
	// Exclude:
	//   - type-only files (no executable code)
	//   - queue/Redis infrastructure (requires Redis at runtime)
	//   - AI/Slack service clients (require external APIs)
	//   - HTTP/API client modules (axios, Gemini, etc.)
	//   - Express middleware (require req/res objects)
	//   - logger/Sentry configuration modules
	//   - database schema declarations and test helpers
	//   - api-core layer (resolvers/controllers — not unit-tested yet)
	collectCoverageFrom: [
		'<rootDir>/packages/**/*.ts',
		// type-only files
		'!<rootDir>/packages/types/**',
		// HTTP / AI / external-API clients
		'!<rootDir>/packages/clients/**',
		// queue infrastructure — requires Redis
		'!<rootDir>/packages/services/queue/**',
		// external-API service clients — Slack, AI providers
		'!<rootDir>/packages/services/communication/**',
		'!<rootDir>/packages/services/AIInteractionService.ts',
		// Express middleware — requires req/res objects
		'!<rootDir>/packages/middlewares/**',
		// logging/monitoring infrastructure
		'!<rootDir>/packages/services/logging/logger.ts',
		'!<rootDir>/packages/utils/sentry.ts',
		'!<rootDir>/packages/utils/tracing.ts',
		// Drizzle schema declarations (no runtime logic)
		'!<rootDir>/packages/database/schema.ts',
		// test helpers, build artefacts, barrel files
		'!<rootDir>/**/*.test.ts',
		'!<rootDir>/**/*.spec.ts',
		'!<rootDir>/**/*.d.ts',
		'!<rootDir>/**/index.ts'
	],
	coveragePathIgnorePatterns: [
		'/node_modules/',
		'/build/',
		'/test-utils/',
		'/coverage/'
	],
	collectCoverage: true,
	coverageThreshold: {
		global: {
			branches: 50,
			functions: 65,
			lines: 65,
			statements: 65
		}
	},
	moduleNameMapper: {
		// Handle module aliases (must match tsconfig.json paths)
		'^@api-core(.*)$': '<rootDir>/api-core$1',
		'^@packages(.*)$': '<rootDir>/packages$1',
		'^@test-utils(.*)$': '<rootDir>/test-utils$1',
		'^@builders(.*)$': '<rootDir>/test-utils/builders$1'
	},
	// Integration tests share one Postgres database — run files serially to
	// prevent parallel TRUNCATE/INSERT operations from causing deadlocks.
	maxWorkers: 1,
	verbose: true
}

export default config
