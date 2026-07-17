import type { Context } from '@packages/types'
import type { RecorderInviteInterface } from '@packages/types/recorderInvite'

interface ResendRecorderInviteArgs {
	team: string
	inviteId: string
}

export const resendRecorderInvite = async (
	_parent: unknown,
	{ team, inviteId }: ResendRecorderInviteArgs,
	{ recorderInviteService, reportingService }: Context
): Promise<RecorderInviteInterface> => {
	reportingService.startTrace({
		op: 'resendRecorderInvite',
		name: 'resendRecorderInvite'
	})
	try {
		return await recorderInviteService.resendRecorderInvite({
			teamId: team,
			inviteId
		})
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
