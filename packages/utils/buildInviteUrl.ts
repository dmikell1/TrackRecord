import { env } from '@packages/utils/validateEnvs'

export const buildAthleteInviteUrl = ({ token }: { token: string }): string => {
	const baseUrl = env.TRACKRECORD_APP_URL.replace(/\/$/, '')
	return `${baseUrl}/join/${token}`
}
