import { env } from '@packages/utils/validateEnvs'

export const isDevelopment =
	env.ENVIRONMENT_NAME === 'local' || env.ENVIRONMENT_NAME === 'testing'

export const isProduction = env.ENVIRONMENT_NAME === 'production'
