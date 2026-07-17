import type { Context } from '@packages/types'

export const revokeRecorderAccess = async (
	_parent: unknown,
	{ userId, team }: { userId: string; team: string },
	{ recorderInviteService, reportingService }: Context
): Promise<boolean> => {
	reportingService.startTrace({
		op: 'revokeRecorderAccess',
		name: 'revokeRecorderAccess'
	})
	try {
		return await recorderInviteService.revokeRecorderAccess({
			teamId: team,
			userId
		})
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
