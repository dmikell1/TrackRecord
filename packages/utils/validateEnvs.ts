import { z } from 'zod'

const envSchema = z
	.object({
		// GENERAL
		PORT: z
			.string()
			.default('4010')
			.transform((val) => parseInt(val, 10))
			.pipe(z.number().int().positive()),
		PROSPECTING_PORT: z
			.string()
			.default('4002')
			.transform((val) => parseInt(val, 10))
			.pipe(z.number().int().positive()),
		ENVIRONMENT_NAME: z.string().default('local'),
		APPLICATION_URL: z.string().default('https://local.getprojectshub.com'),
		CHANCE_SEED: z.string().default('chance_seed'),
		DASHBOARD: z.string().default('false'),
		SESSION_SECRET: z.string().default('secret'),
		// RESEND
		RESEND_API_KEY: z.string().default(''),
		RESEND_FROM_EMAIL: z.string().default('invites@trackrecord.app'),
		RESEND_FROM_NAME: z.string().default('TrackRecord'),
		TRACKRECORD_APP_URL: z.string().default('https://trackrecord.app'),
		// POSTGRES (Drizzle)
		DATABASE_URL: z
			.string()
			.default('postgres://localhost:5432/trackrecord'),
		TEST_DATABASE_URL: z
			.string()
			.default('postgres://localhost:5432/trackrecord_test'),
		// REDIS
		REDIS_URL: z.string().default('redis://localhost:6379'),
		// TRACKING
		SENTRY_CONFIG: z.string().default(''),
		ENVIRONMENT: z.string().default('local'),
		LOG_LEVEL: z.string().default('info'),
		// CLERK
		CLERK_P_SECRET: z.string().default(''),
		CLERK_SECRET_KEY: z.string().default(''),
		// REVENUECAT
		REVENUECAT_WEBHOOK_SECRET: z.string().default(''),
		REVENUECAT_SECRET_API_KEY: z.string().default(''),
		// AI API KEYS
		OPENAI_API_KEY: z.string().default(''),
		ANTHROPIC_API_KEY: z.string().default(''),
		GEMINI_API_KEY: z.string().default(''),
		// CLOUDFLARE R2
		CLOUDFLARE_R2_BUCKET: z.string().default('athlete-videos'),
		CLOUDFLARE_R2_ACCOUNT_ID: z.string().default(''),
		CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().default(''),
		CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().default(''),
		CLOUDFLARE_R2_PUBLIC_URL: z.string().default(''),
		// CORS
		FRONTEND_URL: z.string().default('http://localhost:3000'),
		WEBSITE_URL: z.string().default('http://localhost:3001'),
		// POSTGRES
		POSTGRES_URL: z.string().optional(),
		POSTGRES_USER: z.string().default('postgres'),
		POSTGRES_PASSWORD: z.string().default('postgres'),
		POSTGRES_HOST: z.string().default('localhost'),
		POSTGRES_DB: z.string().default('salesaxis'),
		POSTGRES_PORT: z
			.string()
			.default('5432')
			.transform((val) => parseInt(val, 10))
			.pipe(z.number().int().positive()),
		AUTO_RUN_MIGRATIONS: z
			.string()
			.default('true')
			.transform((val) => val === 'true'),
		DB_POOL_SIZE: z
			.string()
			.default('10')
			.transform((val) => parseInt(val, 10))
			.pipe(z.number().int().positive())
	})

const parseEnv = (): z.infer<typeof envSchema> => {
	try {
		return envSchema.parse(process.env)
	} catch (error) {
		if (error instanceof z.ZodError) {
			const missingVars = error.issues
				.map((err) => `${err.path.join('.')}: ${err.message}`)
				.join('\n')
			throw new Error(
				`Environment validation failed:\n${missingVars}\n\nPlease check your environment variables.`
			)
		}
		throw error
	}
}

export const env = parseEnv()

// Do not crash the process for a missing webhook secret — that blocked Control Plane
// rollouts and left the previous revision (without Company.subscription) serving traffic.
// The webhook handler already rejects unsigned requests when the secret is empty.
if (
	env.ENVIRONMENT_NAME === 'production' &&
	env.REVENUECAT_WEBHOOK_SECRET.trim().length === 0
) {
	// eslint-disable-next-line no-console -- boot-time ops warning before logger is ready
	console.warn(
		'[env] REVENUECAT_WEBHOOK_SECRET is empty in production. Set it in Control Plane and match RevenueCat webhook Authorization: Bearer <secret>.'
	)
}
