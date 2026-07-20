import type { Context } from '@packages/types'
import type { AthleteInterface } from '@packages/types/athlete'

interface GrantParentalConsentArgs {
	token: string
}

export const grantParentalConsent = async (
	_parent: unknown,
	{ token }: GrantParentalConsentArgs,
	{ athleteInviteService, reportingService }: Context
): Promise<AthleteInterface> => {
	reportingService.startTrace({
		op: 'grantParentalConsent',
		name: 'grantParentalConsent'
	})
	try {
		return await athleteInviteService.grantParentalConsent({ token })
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
