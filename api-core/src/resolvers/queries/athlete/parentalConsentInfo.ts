import type { Context } from '@packages/types'
import type { ParentalConsentInfoInterface } from '@packages/types/athlete'

interface ParentalConsentInfoArgs {
	token: string
}

export const parentalConsentInfo = async (
	_parent: unknown,
	{ token }: ParentalConsentInfoArgs,
	{ athleteInviteService, reportingService }: Context
): Promise<ParentalConsentInfoInterface | null> => {
	reportingService.startTrace({
		op: 'parentalConsentInfo',
		name: 'parentalConsentInfo'
	})
	try {
		return await athleteInviteService.getParentalConsentInfo({ token })
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
