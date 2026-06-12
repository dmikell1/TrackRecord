import type { Context } from '@packages/types'
import type { AthleteInviteInterface } from '@packages/types/athleteInvite'

interface AthleteInviteArgs {
	token: string
}

export const athleteInvite = async (
	_parent: unknown,
	args: AthleteInviteArgs,
	{ athleteInviteService, reportingService }: Context
): Promise<AthleteInviteInterface | null> => {
	reportingService.startTrace({ op: 'athleteInvite', name: 'athleteInvite' })
	try {
		return await athleteInviteService.findAthleteInvite({ filter: { token: args.token } })
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
