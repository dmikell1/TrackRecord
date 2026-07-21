import { env } from '@packages/utils/validateEnvs'

export const buildAthleteInviteUrl = ({ token }: { token: string }): string => {
	const baseUrl = env.TRACKRECORD_APP_URL.replace(/\/$/, '')
	return `${baseUrl}/join/${token}`
}

export const buildRecorderInviteUrl = ({
	token
}: {
	token: string
}): string => {
	const baseUrl = env.TRACKRECORD_APP_URL.replace(/\/$/, '')
	return `${baseUrl}/join/${token}`
}

export const buildParentalConsentUrl = ({
	token
}: {
	token: string
}): string => {
	// Same public host as /join — marketing site serves /parental-consent/[token]
	const baseUrl = env.TRACKRECORD_APP_URL.replace(/\/$/, '')
	return `${baseUrl}/parental-consent/${token}`
}
