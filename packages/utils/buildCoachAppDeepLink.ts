/**
 * HTTPS links for coach lifecycle email CTAs.
 *
 * Email clients (Gmail, Outlook, etc.) often strip custom schemes like
 * `trackrecord://`, which makes buttons non-clickable. Use marketing-site
 * `/open/{path}` URLs instead — those pages redirect into the app.
 */

import { env } from '@packages/utils/validateEnvs'

const buildOpenAppHttpsLink = ({ path }: { path: string }): string => {
	const baseUrl = env.TRACKRECORD_APP_URL.replace(/\/$/, '')
	const normalized = path.replace(/^\//, '').replace(/\/$/, '') || 'home'
	return `${baseUrl}/open/${normalized}`
}

/** Coach home / open app. */
export const buildCoachHomeDeepLink = (): string => {
	return buildOpenAppHttpsLink({ path: 'home' })
}

/** Athletes tab — add / manage roster. */
export const buildCoachAthletesDeepLink = (): string => {
	return buildOpenAppHttpsLink({ path: 'athletes' })
}

/** Settings — plan / manage subscription. */
export const buildCoachSettingsDeepLink = (): string => {
	return buildOpenAppHttpsLink({ path: 'settings' })
}

/**
 * Apple subscription management (works from email without opening the app).
 * In-app Settings still uses RevenueCat managementURL when available.
 */
export const APPLE_SUBSCRIPTIONS_URL =
	'https://apps.apple.com/account/subscriptions'
