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
	const subject = `You're invited to join ${teamName} on TrackRecord`
	const greeting = athleteFirstName.trim() ? `Hi ${athleteFirstName},` : 'Hi,'

	const text = `${greeting}

${coachName} invited you to join ${teamName} on TrackRecord.

Join your team: ${inviteUrl}

This invite expires in ${expiresInDays} days.

— TrackRecord`

	const html = `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #282a2b; line-height: 1.5;">
<p>${greeting}</p>
<p><strong>${coachName}</strong> invited you to join <strong>${teamName}</strong> on TrackRecord.</p>
<p><a href="${inviteUrl}" style="display: inline-block; background: #9A7C00; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">Join team</a></p>
<p style="color: #6b7280; font-size: 14px;">Or copy this link: ${inviteUrl}</p>
<p style="color: #6b7280; font-size: 14px;">This invite expires in ${expiresInDays} days.</p>
<p style="color: #6b7280; font-size: 14px;">— TrackRecord</p>
</body>
</html>`

	return { subject, text, html }
}
