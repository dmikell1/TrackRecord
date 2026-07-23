import { EMAIL_BRAND } from '@packages/services/email/emailBrand'
import { buildAthleteInviteEmail } from '@packages/services/email/athleteInviteEmailTemplate'
import {
	buildCoachActivationNudgeEmail,
	buildCoachFeatureHighlightEmail,
	buildCoachTrialConvertedEmail,
	buildCoachTrialEndingSoonEmail,
	buildCoachTrialNotConvertedEmail,
	buildCoachWelcomeEmail
} from '@packages/services/email/coachLifecycleEmailTemplate'
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

	it('builds coach lifecycle emails with branding and placeholders filled', () => {
		const appUrl = 'https://trackrecordhq.com'
		const billingUrl = 'https://trackrecordhq.com'

		const welcome = buildCoachWelcomeEmail({
			firstName: 'Devyn',
			appUrl
		})
		const activation = buildCoachActivationNudgeEmail({
			firstName: 'Devyn',
			appUrl
		})
		const feature = buildCoachFeatureHighlightEmail({
			firstName: 'Devyn',
			appUrl
		})
		const ending = buildCoachTrialEndingSoonEmail({
			firstName: 'Devyn',
			trialEndDate: 'July 30',
			planName: 'Pro',
			billingUrl
		})
		const converted = buildCoachTrialConvertedEmail({
			firstName: 'Devyn',
			planName: 'Pro',
			appUrl
		})
		const notConverted = buildCoachTrialNotConvertedEmail({
			firstName: 'Devyn',
			billingUrl
		})

		for (const email of [
			welcome,
			activation,
			feature,
			ending,
			converted,
			notConverted
		]) {
			expect(email.html).toContain('color-scheme" content="light only"')
			expect(email.html).toContain(EMAIL_BRAND.lime)
			expect(email.html).toContain('Hey Devyn,')
			expect(email.text).toContain('Hey Devyn,')
			expect(email.subject.length).toBeGreaterThan(0)
		}

		expect(welcome.subject).toBe('Welcome to TrackRecord')
		expect(welcome.html).toContain('Open TrackRecord')
		expect(activation.html).toContain('Add an athlete')
		expect(feature.html).toContain('Log a session')
		expect(ending.html).toContain('July 30')
		expect(ending.html).toContain('Pro')
		expect(ending.html).toContain('Manage my subscription')
		expect(converted.subject).toBe("You're on TrackRecord Pro")
		expect(notConverted.html).toContain('Resubscribe')
	})
})
