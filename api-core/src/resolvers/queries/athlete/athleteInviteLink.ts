import type { Context } from '@packages/types'

interface AthleteInviteLinkArgs {
	team: string
	athleteId: string
}

export const athleteInviteLink = async (
	_parent: unknown,
	{ team, athleteId }: AthleteInviteLinkArgs,
	{ athleteInviteService, reportingService }: Context
): Promise<string> => {
	reportingService.startTrace({
		op: 'athleteInviteLink',
		name: 'athleteInviteLink'
	})
	try {
		return await athleteInviteService.getAthleteInviteLink({ teamId: team, athleteId })
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
