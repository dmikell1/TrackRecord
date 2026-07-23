/**
 * Send all coach lifecycle email templates to an inbox for visual QA.
 *
 * Safe: does NOT touch coach_lifecycle_email_jobs or enrollment state.
 * Only calls Resend with sample placeholder data.
 *
 * Usage (from trackrecord-api):
 *   pnpm lifecycle:preview --email=you@example.com
 *   pnpm lifecycle:preview --email=you@example.com --firstName=Devyn
 */

import 'reflect-metadata'

import { addDays, format } from 'date-fns'
import { container } from 'tsyringe'

import {
	buildCoachActivationNudgeEmail,
	buildCoachFeatureHighlightEmail,
	buildCoachTrialConvertedEmail,
	buildCoachTrialEndingSoonEmail,
	buildCoachTrialNotConvertedEmail,
	buildCoachWelcomeEmail
} from '@packages/services/email/coachLifecycleEmailTemplate'
import { EmailService } from '@packages/services/email/EmailService'
import {
	APPLE_SUBSCRIPTIONS_URL,
	buildCoachAthletesDeepLink,
	buildCoachHomeDeepLink,
	buildCoachSettingsDeepLink
} from '@packages/utils/buildCoachAppDeepLink'

const DEFAULT_EMAIL = 'devyn.mikell@gmail.com'

const parseArg = ({
	flag,
	argv
}: {
	flag: string
	argv: string[]
}): string | undefined => {
	const prefix = `${flag}=`
	const match = argv.find(arg => arg.startsWith(prefix))
	if (!match) {
		return undefined
	}
	return match.slice(prefix.length).trim() || undefined
}

const printHelp = (): void => {
	// eslint-disable-next-line no-console
	console.log(`
Send preview copies of all coach lifecycle emails via Resend.

  pnpm lifecycle:preview --email=you@example.com
  pnpm lifecycle:preview --email=you@example.com --firstName=Devyn

Does not write lifecycle job rows or change subscription/signup state.
Subjects are prefixed with [PREVIEW] so they are easy to spot.
`)
}

const main = async (): Promise<void> => {
	const argv = process.argv.slice(2)
	if (argv.includes('--help') || argv.includes('-h')) {
		printHelp()
		return
	}

	const to =
		parseArg({ flag: '--email', argv }) ??
		process.env.SEED_COACH_EMAIL ??
		DEFAULT_EMAIL
	const firstName = parseArg({ flag: '--firstName', argv }) ?? 'Devyn'
	const homeUrl = buildCoachHomeDeepLink()
	const athletesUrl = buildCoachAthletesDeepLink()
	const settingsUrl = buildCoachSettingsDeepLink()
	const trialEndDate = format(addDays(new Date(), 2), 'MMMM d, yyyy')
	const planName = 'Pro'

	const emails = [
		{
			label: 'Day 0 — welcome',
			content: buildCoachWelcomeEmail({ firstName, appUrl: homeUrl })
		},
		{
			label: 'Day 1–2 — activation nudge',
			content: buildCoachActivationNudgeEmail({
				firstName,
				appUrl: athletesUrl
			})
		},
		{
			label: 'Day 5 — feature highlight',
			content: buildCoachFeatureHighlightEmail({
				firstName,
				appUrl: homeUrl
			})
		},
		{
			label: 'Day 12 — trial ending soon',
			content: buildCoachTrialEndingSoonEmail({
				firstName,
				trialEndDate,
				planName,
				billingUrl: settingsUrl
			})
		},
		{
			label: 'Day 14 — converted',
			content: buildCoachTrialConvertedEmail({
				firstName,
				planName,
				appUrl: homeUrl
			})
		},
		{
			label: 'Day 14 — not converted',
			content: buildCoachTrialNotConvertedEmail({
				firstName,
				billingUrl: APPLE_SUBSCRIPTIONS_URL
			})
		}
	]

	const emailService = container.resolve(EmailService)

	// eslint-disable-next-line no-console
	console.log(`Sending ${emails.length} preview emails to ${to}…`)

	for (const email of emails) {
		const subject = `[PREVIEW] ${email.content.subject}`
		await emailService.sendEmail({
			to,
			subject,
			text: email.content.text,
			html: email.content.html
		})
		// eslint-disable-next-line no-console
		console.log(`  ✓ ${email.label} — ${subject}`)
	}

	// eslint-disable-next-line no-console
	console.log('Done. Check your inbox (and spam).')
}

void main().catch((error: unknown) => {
	// eslint-disable-next-line no-console
	console.error(error)
	process.exit(1)
})
