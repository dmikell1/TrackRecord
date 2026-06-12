import { env } from '@packages/utils/validateEnvs'

const whitelist = [env.FRONTEND_URL, env.WEBSITE_URL]

export const corsOptions = {
	// Mobile dev (Expo Go) often has no Origin header or a non-whitelisted one.
	origin: env.ENVIRONMENT_NAME === 'local' ? true : whitelist,
	credentials: true
}
