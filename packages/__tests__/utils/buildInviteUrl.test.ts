import { buildAthleteInviteUrl, buildParentalConsentUrl } from '@packages/utils/buildInviteUrl'
import { env } from '@packages/utils/validateEnvs'

describe('buildInviteUrl', () => {
	it('builds athlete invite URLs on TRACKRECORD_APP_URL', () => {
		const url = buildAthleteInviteUrl({ token: 'invite-token' })
		expect(url).toBe(
			`${env.TRACKRECORD_APP_URL.replace(/\/$/, '')}/join/invite-token`
		)
	})

	it('builds parental consent URLs on TRACKRECORD_APP_URL', () => {
		const url = buildParentalConsentUrl({ token: 'consent-token' })
		expect(url).toBe(
			`${env.TRACKRECORD_APP_URL.replace(/\/$/, '')}/parental-consent/consent-token`
		)
		expect(url).not.toContain('localhost:3000')
		expect(url).not.toContain('trackrecord.app')
	})
})
