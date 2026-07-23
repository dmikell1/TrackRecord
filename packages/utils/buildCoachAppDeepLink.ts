/**
 * Deep links into the TrackRecord mobile app (Expo scheme: trackrecord).
 * Prefer these for coach lifecycle CTAs — TRACKRECORD_APP_URL is the marketing
 * site and only serves /join and /parental-consent web flows.
 */

const COACH_APP_SCHEME = 'trackrecord'

export const buildCoachAppDeepLink = ({
	path
}: {
	path: string
}): string => {
	const normalized = path.replace(/^\//, '').replace(/\/$/, '')
	if (normalized.length === 0) {
		return `${COACH_APP_SCHEME}://home`
	}
	return `${COACH_APP_SCHEME}://${normalized}`
}

/** Coach home / open app. */
export const buildCoachHomeDeepLink = (): string => {
	return buildCoachAppDeepLink({ path: 'home' })
}

/** Athletes tab — add / manage roster. */
export const buildCoachAthletesDeepLink = (): string => {
	return buildCoachAppDeepLink({ path: 'athletes' })
}

/** Settings — plan / manage subscription. */
export const buildCoachSettingsDeepLink = (): string => {
	return buildCoachAppDeepLink({ path: 'settings' })
}

/**
 * Apple subscription management (works from email without opening the app).
 * In-app Settings still uses RevenueCat managementURL when available.
 */
export const APPLE_SUBSCRIPTIONS_URL =
	'https://apps.apple.com/account/subscriptions'
