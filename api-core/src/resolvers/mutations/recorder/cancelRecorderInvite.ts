import type { Context } from '@packages/types'

export const cancelRecorderInvite = async (
	_parent: unknown,
	{ id, team }: { id: string; team: string },
	{ recorderInviteService, reportingService }: Context
): Promise<boolean> => {
	reportingService.startTrace({
		op: 'cancelRecorderInvite',
		name: 'cancelRecorderInvite'
	})
	try {
		return await recorderInviteService.cancelRecorderInvite({
			teamId: team,
			inviteId: id
		})
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
