import {
	EMAIL_BRAND,
	buildEmailCtaButton,
	buildEmailHead,
	buildEmailWordmarkRow,
	escapeHtml
} from '@packages/services/email/emailBrand'

export type CoachLifecycleEmailContent = {
	subject: string
	text: string
	html: string
}

const buildShell = ({
	title,
	preheader,
	bodyRows,
	footerNote
}: {
	title: string
	preheader: string
	bodyRows: string
	footerNote?: string
}): string => {
	const { cream, white, cardBorder, footerText } = EMAIL_BRAND
	const safePreheader = escapeHtml({ value: preheader })
	const footer =
		footerNote !== undefined
			? `${escapeHtml({ value: footerNote })}<br>`
			: ''

	return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
${buildEmailHead({ title })}
</head>
<body class="email-body" style="margin:0; padding:0; background-color:${cream}; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:${cream};">${safePreheader}</div>
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;</div>
  <table role="presentation" class="email-outer" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${cream};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="email-card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:${white}; border:1px solid ${cardBorder}; border-radius:8px; overflow:hidden;">
          ${buildEmailWordmarkRow()}
          ${bodyRows}
        </table>
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">
          <tr>
            <td align="center" class="email-footer" style="padding:20px 40px; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:18px; color:${footerText};">
              ${footer}TrackRecord, Inc.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

const greetingRow = ({ firstName }: { firstName: string }): string => {
	const { black } = EMAIL_BRAND
	const trimmed = firstName.trim()
	const htmlGreeting = trimmed
		? `Hey ${escapeHtml({ value: trimmed })},`
		: 'Hey,'

	return `<tr>
            <td class="email-text" style="padding:32px 40px 0 40px; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:24px; color:${black};">
              ${htmlGreeting}
            </td>
          </tr>`
}

const textRow = ({
	html,
	paddingTop = '16px'
}: {
	html: string
	paddingTop?: string
}): string => {
	const { black } = EMAIL_BRAND

	return `<tr>
            <td class="email-text" style="padding:${paddingTop} 40px 0 40px; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:24px; color:${black};">
              ${html}
            </td>
          </tr>`
}

const dividerAndSignOff = (): string => {
	const { cardBorder, black } = EMAIL_BRAND

	return `<tr>
            <td style="padding:28px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="email-divider" style="border-top:1px solid ${cardBorder}; font-size:0; line-height:0;">&nbsp;</td></tr></table>
            </td>
          </tr>
          <tr>
            <td class="email-text" style="padding:20px 40px 32px 40px; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:22px; color:${black};">
              See you on the track,<br>
              The TrackRecord Team
            </td>
          </tr>`
}

const textGreeting = ({ firstName }: { firstName: string }): string => {
	const trimmed = firstName.trim()
	return trimmed ? `Hey ${trimmed},` : 'Hey,'
}

/**
 * Day 0 — welcome after coach signup.
 */
export const buildCoachWelcomeEmail = ({
	firstName,
	appUrl
}: {
	firstName: string
	appUrl: string
}): CoachLifecycleEmailContent => {
	const { black } = EMAIL_BRAND
	const subject = 'Welcome to TrackRecord'
	const greeting = textGreeting({ firstName })

	const text = `${greeting}

You're in. TrackRecord is built to do two things well: log real results fast, and show your athletes exactly how they're progressing.

To get going, do these three things:
1. Add an athlete — even just a name and event is enough to start.
2. Create a session — practice or meet, whatever you're logging.
3. Upload or record your first videos — attach them to that session and you're set.

Open TrackRecord: ${appUrl}

See you on the track,
The TrackRecord Team`

	const listRow = `<tr>
            <td style="padding:8px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="email-text" style="padding:10px 0; font-family:Arial, Helvetica, sans-serif; font-size:15px; line-height:22px; color:${black}; border-bottom:1px solid #EFEDE4;"><strong>1. Add an athlete</strong> — even just a name and event is enough to start.</td></tr>
                <tr><td class="email-text" style="padding:10px 0; font-family:Arial, Helvetica, sans-serif; font-size:15px; line-height:22px; color:${black}; border-bottom:1px solid #EFEDE4;"><strong>2. Create a session</strong> — practice or meet, whatever you're logging.</td></tr>
                <tr><td class="email-text" style="padding:10px 0; font-family:Arial, Helvetica, sans-serif; font-size:15px; line-height:22px; color:${black};"><strong>3. Upload or record your first videos</strong> — attach them to that session and you're set.</td></tr>
              </table>
            </td>
          </tr>`

	const html = buildShell({
		title: 'Welcome to TrackRecord',
		preheader:
			"You're in. Here's how to log your first session in minutes.",
		bodyRows: [
			greetingRow({ firstName }),
			textRow({
				html: "You're in. TrackRecord is built to do two things well: log real results fast, and show your athletes exactly how they're progressing."
			}),
			textRow({
				html: 'To get going, do these three things:',
				paddingTop: '20px'
			}),
			listRow,
			buildEmailCtaButton({ href: appUrl, label: 'Open TrackRecord' }),
			dividerAndSignOff()
		].join('\n')
	})

	return { subject, text, html }
}

/**
 * Day 1–2 — activation nudge when no athlete / session yet.
 */
export const buildCoachActivationNudgeEmail = ({
	firstName,
	appUrl
}: {
	firstName: string
	appUrl: string
}): CoachLifecycleEmailContent => {
	const subject = 'Two minutes to your first logged session'
	const greeting = textGreeting({ firstName })

	const text = `${greeting}

Looks like you haven't added an athlete or logged a session yet — no worries, it takes less time than a warmup lap.

Add one athlete, record one jump, throw, or run, and you'll see exactly how TrackRecord turns a phone video into a real result you can track over the season.

Add an athlete: ${appUrl}

See you on the track,
The TrackRecord Team`

	const html = buildShell({
		title: 'Two minutes to your first logged session',
		preheader:
			'Add one athlete, record one result — see it turn into a tracked mark.',
		bodyRows: [
			greetingRow({ firstName }),
			textRow({
				html: "Looks like you haven't added an athlete or logged a session yet — no worries, it takes less time than a warmup lap."
			}),
			textRow({
				html: "Add one athlete, record one jump, throw, or run, and you'll see exactly how TrackRecord turns a phone video into a real result you can track over the season."
			}),
			buildEmailCtaButton({ href: appUrl, label: 'Add an athlete' }),
			dividerAndSignOff()
		].join('\n')
	})

	return { subject, text, html }
}

/**
 * Day 5–6 — feature highlight (video + results together).
 */
export const buildCoachFeatureHighlightEmail = ({
	firstName,
	appUrl
}: {
	firstName: string
	appUrl: string
}): CoachLifecycleEmailContent => {
	const subject = 'Your videos and results, finally together'
	const greeting = textGreeting({ firstName })

	const text = `${greeting}

Video is valuable — but a camera roll full of unlabeled clips is frustrating to dig through, for you and your athletes. TrackRecord pairs every video with its result. Every event gets its own entry format built for how it's actually measured — a high jump entry doesn't look like a sprint entry.

Athletes always have access to the videos they're tagged in, right alongside the mark — so they're not asking you which rep was which. They can just see for themselves.

Log a session: ${appUrl}

See you on the track,
The TrackRecord Team`

	const html = buildShell({
		title: 'Your videos and results, finally together',
		preheader:
			'Every clip, paired with its result — no more digging through the camera roll.',
		bodyRows: [
			greetingRow({ firstName }),
			textRow({
				html: "Video is valuable — but a camera roll full of unlabeled clips is frustrating to dig through, for you and your athletes. TrackRecord pairs every video with its result. Every event gets its own entry format built for how it's actually measured — a high jump entry doesn't look like a sprint entry."
			}),
			textRow({
				html: "Athletes always have access to the videos they're tagged in, right alongside the mark — so they're not asking you which rep was which. They can just see for themselves."
			}),
			buildEmailCtaButton({ href: appUrl, label: 'Log a session' }),
			dividerAndSignOff()
		].join('\n')
	})

	return { subject, text, html }
}

/**
 * Day 12 — trial ending soon.
 */
export const buildCoachTrialEndingSoonEmail = ({
	firstName,
	trialEndDate,
	planName,
	billingUrl
}: {
	firstName: string
	trialEndDate: string
	planName: string
	billingUrl: string
}): CoachLifecycleEmailContent => {
	const { black } = EMAIL_BRAND
	const safeTrialEndDate = escapeHtml({ value: trialEndDate })
	const safePlanName = escapeHtml({ value: planName })
	const subject = `Your trial ends ${trialEndDate}`
	const greeting = textGreeting({ firstName })

	const text = `${greeting}

Your TrackRecord trial wraps up on ${trialEndDate}. After that, your card on file will be charged for ${planName} unless you cancel first.

Here's what you've been using it for:
- Video storage with event-specific mark logging — every clip tied to the right athlete, event, and result
- PR detection and progress — automatic PR flags and progression charts across the season
- Free athlete video access and communication — your athletes can view their videos and comment at no cost to them

All of that stays intact when you continue.

Manage my subscription: ${billingUrl}

See you on the track,
The TrackRecord Team`

	const listRow = `<tr>
            <td style="padding:8px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td class="email-text" style="padding:10px 0; font-family:Arial, Helvetica, sans-serif; font-size:15px; line-height:22px; color:${black}; border-bottom:1px solid #EFEDE4;"><strong>Video storage with event-specific mark logging</strong> — every clip tied to the right athlete, event, and result</td></tr>
                <tr><td class="email-text" style="padding:10px 0; font-family:Arial, Helvetica, sans-serif; font-size:15px; line-height:22px; color:${black}; border-bottom:1px solid #EFEDE4;"><strong>PR detection and progress</strong> — automatic PR flags and progression charts across the season</td></tr>
                <tr><td class="email-text" style="padding:10px 0; font-family:Arial, Helvetica, sans-serif; font-size:15px; line-height:22px; color:${black};"><strong>Free athlete video access and communication</strong> — your athletes can view their videos and comment at no cost to them</td></tr>
              </table>
            </td>
          </tr>`

	const html = buildShell({
		title: `Your trial ends ${trialEndDate}`,
		preheader:
			"Here's what you'd keep — and what happens if you don't act.",
		bodyRows: [
			greetingRow({ firstName }),
			textRow({
				html: `Your TrackRecord trial wraps up on <strong>${safeTrialEndDate}</strong>. After that, your card on file will be charged for <strong>${safePlanName}</strong> unless you cancel first.`
			}),
			textRow({
				html: "Here's what you've been using it for:",
				paddingTop: '20px'
			}),
			listRow,
			textRow({
				html: 'All of that stays intact when you continue.',
				paddingTop: '20px'
			}),
			buildEmailCtaButton({
				href: billingUrl,
				label: 'Manage my subscription'
			}),
			dividerAndSignOff()
		].join('\n')
	})

	return { subject, text, html }
}

/**
 * Day 14 — converted to paid.
 */
export const buildCoachTrialConvertedEmail = ({
	firstName,
	planName,
	appUrl
}: {
	firstName: string
	planName: string
	appUrl: string
}): CoachLifecycleEmailContent => {
	const safePlanName = escapeHtml({ value: planName })
	const subject = `You're on TrackRecord ${planName}`
	const greeting = textGreeting({ firstName })

	const text = `${greeting}

You're officially on ${planName}. Your roster, sessions, and video history carry right over — nothing to redo.

A receipt for this charge is on its way to your inbox, and you can view or update billing anytime from your account settings.

Open TrackRecord: ${appUrl}

See you on the track,
The TrackRecord Team`

	const html = buildShell({
		title: `You're on TrackRecord ${planName}`,
		preheader:
			'Your roster, sessions, and video history carry right over — nothing to redo.',
		bodyRows: [
			greetingRow({ firstName }),
			textRow({
				html: `You're officially on <strong>${safePlanName}</strong>. Your roster, sessions, and video history carry right over — nothing to redo.`
			}),
			textRow({
				html: 'A receipt for this charge is on its way to your inbox, and you can view or update billing anytime from your account settings.'
			}),
			buildEmailCtaButton({ href: appUrl, label: 'Open TrackRecord' }),
			dividerAndSignOff()
		].join('\n')
	})

	return { subject, text, html }
}

/**
 * Day 14 — trial ended without conversion.
 */
export const buildCoachTrialNotConvertedEmail = ({
	firstName,
	billingUrl
}: {
	firstName: string
	billingUrl: string
}): CoachLifecycleEmailContent => {
	const subject = 'Your TrackRecord trial has ended'
	const greeting = textGreeting({ firstName })

	const text = `${greeting}

Your trial wrapped up, so your account's now in read-only mode — your athletes and sessions are still there, just paused.

If you want to pick back up, you can resubscribe anytime and everything will be exactly where you left it.

Resubscribe: ${billingUrl}

See you on the track,
The TrackRecord Team`

	const html = buildShell({
		title: 'Your TrackRecord trial has ended',
		preheader: 'Your athletes and sessions are still there, just paused.',
		bodyRows: [
			greetingRow({ firstName }),
			textRow({
				html: "Your trial wrapped up, so your account's now in read-only mode — your athletes and sessions are still there, just paused."
			}),
			textRow({
				html: 'If you want to pick back up, you can resubscribe anytime and everything will be exactly where you left it.'
			}),
			buildEmailCtaButton({ href: billingUrl, label: 'Resubscribe' }),
			dividerAndSignOff()
		].join('\n')
	})

	return { subject, text, html }
}
