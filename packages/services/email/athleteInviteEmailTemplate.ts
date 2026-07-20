const escapeHtml = ({ value }: { value: string }): string => {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

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
	const safeInviteUrl = escapeHtml({ value: inviteUrl })
	const htmlGreeting = trimmedFirstName ? `Hi ${safeFirstName},` : 'Hi,'

	const text = `${greeting}

${coachName} has invited you to join ${teamName} on TrackRecord to track workouts, meet results, and training plans together.

Join team: ${inviteUrl}

If the button doesn't work, copy and paste this link into your browser:
${inviteUrl}

This invite link expires in ${expiresInDays} days.

See you on the track,
The TrackRecord Team`

	const html = `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>You're invited to join a team on TrackRecord</title>
<!--[if mso]>
<style>
  table {border-collapse:collapse;}
  .fallback-font { font-family: Arial, sans-serif !important; }
</style>
<![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#F4F2EA; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#F4F2EA;">
    ${safeCoachName} invited you to join ${safeTeamName} on TrackRecord. Accept below to get started.
  </div>
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F2EA;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#ffffff; border:1px solid #E4E1D6; border-radius:8px; overflow:hidden;">

          <tr>
            <td align="left" bgcolor="#0D0D0D" style="padding:22px 40px;">
              <span style="font-family:Arial, Helvetica, sans-serif; font-size:20px; font-weight:700; letter-spacing:0.5px; color:#FFFFFF;">TRACK<span style="color:#7A7A7A;">/</span><span style="color:#D7F229;">RECORD</span></span>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 40px 0 40px; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:24px; color:#0D0D0D;">
              ${htmlGreeting}
            </td>
          </tr>

          <tr>
            <td style="padding:16px 40px 0 40px; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:24px; color:#0D0D0D;">
              <strong>${safeCoachName}</strong> has invited you to join <strong>${safeTeamName}</strong> on TrackRecord to track workouts, meet results, and training plans together.
            </td>
          </tr>

          <tr>
            <td align="left" style="padding:28px 40px 0 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#D7F229" style="border-radius:999px;">
                    <a href="${safeInviteUrl}" target="_blank" style="display:block; padding:14px 30px; font-family:Arial, Helvetica, sans-serif; font-size:16px; font-weight:700; color:#0D0D0D; text-decoration:none; border-radius:999px;">Join team</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 40px 0 40px; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:20px; color:#6B6B62;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${safeInviteUrl}" target="_blank" style="color:#4A5A1E; text-decoration:underline; word-break:break-all;">${safeInviteUrl}</a>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 40px 0 40px; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:20px; color:#6B6B62;">
              This invite link expires in ${expiresInDays} days.
            </td>
          </tr>

          <tr>
            <td style="padding:28px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid #E4E1D6; font-size:0; line-height:0;">&nbsp;</td></tr></table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 40px 32px 40px; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:22px; color:#0D0D0D;">
              See you on the track,<br>
              The TrackRecord Team
            </td>
          </tr>

        </table>

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">
          <tr>
            <td align="center" style="padding:20px 40px; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:18px; color:#9A9A90;">
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
