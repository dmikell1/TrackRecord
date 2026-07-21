import {
	EMAIL_BRAND,
	buildEmailCtaButton,
	buildEmailFallbackLink,
	buildEmailHead,
	buildEmailWordmarkRow,
	escapeHtml
} from '@packages/services/email/emailBrand'

export const buildParentalConsentEmail = ({
	parentEmail: _parentEmail,
	athleteFirstName,
	athleteLastName,
	teamName,
	consentUrl
}: {
	parentEmail: string
	athleteFirstName: string
	athleteLastName: string
	teamName: string
	consentUrl: string
}): { subject: string; text: string; html: string } => {
	const athleteName =
		`${athleteFirstName} ${athleteLastName}`.trim() || 'your child'
	const subject = `Please approve ${athleteName}'s TrackRecord account`

	const safeAthleteName = escapeHtml({ value: athleteName })
	const safeTeamName = escapeHtml({ value: teamName })

	const text = `Hi,

${athleteName} has joined ${teamName} on TrackRecord, an app coaches use to record training videos and track results.

Because they're a minor, we need a parent or guardian to approve their account before they can comment on videos or use other interactive features.

Approve account: ${consentUrl}

If the button doesn't work, copy and paste this link into your browser:
${consentUrl}

If you did not expect this email, you can safely ignore it.

Thank you,
The TrackRecord Team`

	const { cream, white, cardBorder, black, mutedText, footerText } =
		EMAIL_BRAND

	const html = `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
${buildEmailHead({ title: 'Parent/guardian approval needed on TrackRecord' })}
</head>
<body class="email-body" style="margin:0; padding:0; background-color:${cream}; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:${cream};">
    ${safeAthleteName} joined ${safeTeamName} on TrackRecord and needs your approval to unlock full account features.
  </div>
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;</div>

  <table role="presentation" class="email-outer" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${cream};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="email-card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:${white}; border:1px solid ${cardBorder}; border-radius:8px; overflow:hidden;">

          ${buildEmailWordmarkRow()}

          <tr>
            <td class="email-text" style="padding:32px 40px 0 40px; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:24px; color:${black};">
              Hi,
            </td>
          </tr>

          <tr>
            <td class="email-text" style="padding:16px 40px 0 40px; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:24px; color:${black};">
              <strong>${safeAthleteName}</strong> has joined <strong>${safeTeamName}</strong> on TrackRecord, an app coaches use to record training videos and track results.
            </td>
          </tr>
          <tr>
            <td class="email-text" style="padding:16px 40px 0 40px; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:24px; color:${black};">
              Because they're a minor, we need a parent or guardian to approve their account before they can comment on videos or use other interactive features.
            </td>
          </tr>

          ${buildEmailCtaButton({ href: consentUrl, label: 'Approve account' })}

          ${buildEmailFallbackLink({ href: consentUrl })}

          <tr>
            <td class="email-muted" style="padding:20px 40px 0 40px; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:20px; color:${mutedText};">
              If you did not expect this email, you can safely ignore it.
            </td>
          </tr>

          <tr>
            <td style="padding:28px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="email-divider" style="border-top:1px solid ${cardBorder}; font-size:0; line-height:0;">&nbsp;</td></tr></table>
            </td>
          </tr>

          <tr>
            <td class="email-text" style="padding:20px 40px 32px 40px; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:22px; color:${black};">
              Thank you,<br>
              The TrackRecord Team
            </td>
          </tr>

        </table>

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">
          <tr>
            <td align="center" class="email-footer" style="padding:20px 40px; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:18px; color:${footerText};">
              You're receiving this email because ${safeAthleteName} joined a team on TrackRecord and listed you as parent or guardian.<br>
              TrackRecord, Inc.
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`

	return { subject, text, html }
}
