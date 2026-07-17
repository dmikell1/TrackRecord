import type { Context } from '@packages/types'
import type { TeamRecorderEntryInterface } from '@packages/types/teamRecorder'

export const teamRecorders = async (
	_parent: unknown,
	{ team }: { team: string },
	{ recorderInviteService, reportingService }: Context
): Promise<TeamRecorderEntryInterface[]> => {
	reportingService.startTrace({
		op: 'teamRecorders',
		name: 'teamRecorders'
	})
	try {
		return await recorderInviteService.listTeamRecorders({ teamId: team })
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
