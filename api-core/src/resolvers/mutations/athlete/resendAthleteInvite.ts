import type { Context } from '@packages/types'
import type { AthleteInviteInterface } from '@packages/types/athleteInvite'

interface ResendAthleteInviteArgs {
	team: string
	athleteId: string
}

export const resendAthleteInvite = async (
	_parent: unknown,
	{ team, athleteId }: ResendAthleteInviteArgs,
	{ athleteInviteService, reportingService }: Context
): Promise<AthleteInviteInterface> => {
	reportingService.startTrace({
		op: 'resendAthleteInvite',
		name: 'resendAthleteInvite'
	})
	try {
		return await athleteInviteService.resendAthleteInvite({ teamId: team, athleteId })
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
