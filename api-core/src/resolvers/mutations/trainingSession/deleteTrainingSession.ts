import type { Context } from '@packages/types'

interface DeleteTrainingSessionArgs {
	id: string
	team: string
}

export const deleteTrainingSession = async (
	_parent: unknown,
	{ id, team }: DeleteTrainingSessionArgs,
	{ trainingSessionService, reportingService }: Context
): Promise<boolean> => {
	reportingService.startTrace({ op: 'deleteTrainingSession', name: 'deleteTrainingSession' })
	try {
		return await trainingSessionService.deleteTrainingSession({ filter: { id, teamId: team } })
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
