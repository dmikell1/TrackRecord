import {
	EMAIL_BRAND,
	buildEmailCtaButton,
	buildEmailFallbackLink,
	buildEmailHead,
	buildEmailWordmarkRow,
	escapeHtml
} from '@packages/services/email/emailBrand'

export const buildAthleteInviteEmail = ({
	athleteFirstName,
	teamName,
	coachName,
	inviteUrl,
	expiresInDays
}: {
	athleteFirstName: string
	teamName: string
	coachName: string
	inviteUrl: string
	expiresInDays: number
}): { subject: string; text: string; html: string } => {
	const trimmedFirstName = athleteFirstName.trim()
	const greeting = trimmedFirstName ? `Hi ${trimmedFirstName},` : 'Hi,'
	const subject = `You're invited to join ${teamName} on TrackRecord`

	const safeFirstName = escapeHtml({ value: trimmedFirstName })
	const safeCoachName = escapeHtml({ value: coachName })
	const safeTeamName = escapeHtml({ value: teamName })
	const htmlGreeting = trimmedFirstName ? `Hi ${safeFirstName},` : 'Hi,'

	const text = `${greeting}

${coachName} has invited you to join ${teamName} on TrackRecord to track workouts, meet results, and training plans together.

Join team: ${inviteUrl}

If the button doesn't work, copy and paste this link into your browser:
${inviteUrl}

This invite link expires in ${expiresInDays} days.

See you on the track,
The TrackRecord Team`

	const { cream, white, cardBorder, black, mutedText, footerText } =
		EMAIL_BRAND

	const html = `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
${buildEmailHead({ title: "You're invited to join a team on TrackRecord" })}
</head>
<body class="email-body" style="margin:0; padding:0; background-color:${cream}; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:${cream};">
    ${safeCoachName} invited you to join ${safeTeamName} on TrackRecord. Accept below to get started.
  </div>
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;</div>

  <table role="presentation" class="email-outer" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${cream};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="email-card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:${white}; border:1px solid ${cardBorder}; border-radius:8px; overflow:hidden;">

          ${buildEmailWordmarkRow()}

          <tr>
            <td class="email-text" style="padding:32px 40px 0 40px; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:24px; color:${black};">
              ${htmlGreeting}
            </td>
          </tr>

          <tr>
            <td class="email-text" style="padding:16px 40px 0 40px; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:24px; color:${black};">
              <strong>${safeCoachName}</strong> has invited you to join <strong>${safeTeamName}</strong> on TrackRecord to track workouts, meet results, and training plans together.
            </td>
          </tr>

          ${buildEmailCtaButton({ href: inviteUrl, label: 'Join team' })}

          ${buildEmailFallbackLink({ href: inviteUrl })}

          <tr>
            <td class="email-muted" style="padding:20px 40px 0 40px; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:20px; color:${mutedText};">
              This invite link expires in ${expiresInDays} days.
            </td>
          </tr>

          <tr>
            <td style="padding:28px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="email-divider" style="border-top:1px solid ${cardBorder}; font-size:0; line-height:0;">&nbsp;</td></tr></table>
            </td>
          </tr>

          <tr>
            <td class="email-text" style="padding:20px 40px 32px 40px; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:22px; color:${black};">
              See you on the track,<br>
              The TrackRecord Team
            </td>
          </tr>

        </table>

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">
          <tr>
            <td align="center" class="email-footer" style="padding:20px 40px; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:18px; color:${footerText};">
              You're receiving this email because ${safeCoachName} invited you to a team on TrackRecord.<br>
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
