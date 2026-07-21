import { EMAIL_BRAND } from '@packages/services/email/emailBrand'
import { buildAthleteInviteEmail } from '@packages/services/email/athleteInviteEmailTemplate'
import { buildParentalConsentEmail } from '@packages/services/email/parentalConsentEmailTemplate'
import { buildRecorderInviteEmail } from '@packages/services/email/recorderInviteEmailTemplate'

describe('email templates branding', () => {
	it('keeps light-only color scheme and lime CTA on parental consent email', () => {
		const { html } = buildParentalConsentEmail({
			parentEmail: 'parent@example.com',
			athleteFirstName: 'Cait',
			athleteLastName: 'Test',
			teamName: 'Marian Jumps',
			consentUrl: 'https://trackrecordhq.com/parental-consent/abc'
		})

		expect(html).toContain('color-scheme" content="light only"')
		expect(html).toContain(`background-color:${EMAIL_BRAND.lime}`)
		expect(html).toContain(`color:${EMAIL_BRAND.lime}`)
		expect(html).toContain(
			'https://trackrecordhq.com/parental-consent/abc'
		)
		expect(html).toContain('Approve account')
	})

	it('keeps lime branding on athlete and recorder invite emails', () => {
		const athlete = buildAthleteInviteEmail({
			athleteFirstName: 'Alex',
			teamName: 'Sprint Club',
			coachName: 'Coach Kim',
			inviteUrl: 'https://trackrecordhq.com/join/xyz',
			expiresInDays: 7
		})
		const recorder = buildRecorderInviteEmail({
			teamName: 'Sprint Club',
			coachName: 'Coach Kim',
			inviteUrl: 'https://trackrecordhq.com/join/xyz',
			expiresInDays: 7
		})

		expect(athlete.html).toContain('color-scheme" content="light only"')
		expect(athlete.html).toContain(EMAIL_BRAND.lime)
		expect(recorder.html).toContain('color-scheme" content="light only"')
		expect(recorder.html).toContain(EMAIL_BRAND.lime)
	})
})
