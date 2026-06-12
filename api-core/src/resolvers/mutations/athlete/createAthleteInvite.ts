import type { Context } from '@packages/types'
import type { AthleteInviteInterface } from '@packages/types/athleteInvite'

interface CreateAthleteInviteArgs {
	data: {
		team: string
		email: string
	}
}

export const createAthleteInvite = async (
	_parent: unknown,
	{ data }: CreateAthleteInviteArgs,
	{ athleteInviteService, reportingService }: Context
): Promise<AthleteInviteInterface> => {
	reportingService.startTrace({ op: 'createAthleteInvite', name: 'createAthleteInvite' })
	try {
		return await athleteInviteService.createAthleteInvite({ teamId: data.team, email: data.email })
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
