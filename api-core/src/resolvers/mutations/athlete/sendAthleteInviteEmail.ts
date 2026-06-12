import type { Context } from '@packages/types'

interface SendAthleteInviteEmailArgs {
	team: string
	inviteId: string
}

export const sendAthleteInviteEmail = async (
	_parent: unknown,
	{ team, inviteId }: SendAthleteInviteEmailArgs,
	{ athleteInviteService, reportingService }: Context
): Promise<boolean> => {
	reportingService.startTrace({
		op: 'sendAthleteInviteEmail',
		name: 'sendAthleteInviteEmail'
	})
	try {
		return await athleteInviteService.sendAthleteInviteEmail({ teamId: team, inviteId })
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
