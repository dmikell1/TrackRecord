import type { Context } from '@packages/types'

interface ResendParentalConsentEmailArgs {
	team: string
	athleteId: string
}

export const resendParentalConsentEmail = async (
	_parent: unknown,
	{ team, athleteId }: ResendParentalConsentEmailArgs,
	{ req, athleteInviteService, reportingService }: Context
): Promise<boolean> => {
	reportingService.startTrace({
		op: 'resendParentalConsentEmail',
		name: 'resendParentalConsentEmail'
	})
	try {
		if (!req.session.userId) {
			throw new Error('User not authenticated')
		}

		return await athleteInviteService.resendParentalConsentEmail({
			teamId: team,
			athleteId,
			userId: req.session.userId
		})
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
