export const buildRecorderInviteEmail = ({
	teamName,
	coachName,
	inviteUrl,
	expiresInDays
}: {
	teamName: string
	coachName: string
	inviteUrl: string
	expiresInDays: number
}): { subject: string; text: string; html: string } => {
	const subject = `You're invited as a recorder helper on ${teamName}`
	const greeting = 'Hi,'

	const text = `${greeting}

${coachName} invited you to join ${teamName} on TrackRecord as a recorder helper.

As a recorder, you can capture and upload videos and view team sessions and athletes.

Join your team: ${inviteUrl}

This invite expires in ${expiresInDays} days.

— TrackRecord`

	const html = `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #282a2b; line-height: 1.5;">
<p>${greeting}</p>
<p><strong>${coachName}</strong> invited you to join <strong>${teamName}</strong> on TrackRecord as a recorder helper.</p>
<p>As a recorder, you can capture and upload videos and view team sessions and athletes.</p>
<p><a href="${inviteUrl}" style="display: inline-block; background: #9A7C00; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">Join as recorder</a></p>
<p style="color: #6b7280; font-size: 14px;">Or copy this link: ${inviteUrl}</p>
<p style="color: #6b7280; font-size: 14px;">This invite expires in ${expiresInDays} days.</p>
<p style="color: #6b7280; font-size: 14px;">— TrackRecord</p>
</body>
</html>`

	return { subject, text, html }
}
