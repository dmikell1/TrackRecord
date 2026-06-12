import type { Context } from '@packages/types'

interface TeamInviteLinkArgs {
	team: string
}

export const teamInviteLink = async (
	_parent: unknown,
	{ team }: TeamInviteLinkArgs,
	{ teamService, reportingService }: Context
): Promise<string> => {
	reportingService.startTrace({ op: 'teamInviteLink', name: 'teamInviteLink' })
	try {
		return await teamService.getOrCreateInviteToken({ teamId: team })
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
