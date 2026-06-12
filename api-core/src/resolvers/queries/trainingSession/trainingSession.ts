import type { Context } from '@packages/types'
import type { TrainingSessionInterface } from '@packages/types/trainingSession'

interface TrainingSessionArgs {
	id: string
	team: string
}

export const trainingSession = async (
	_parent: unknown,
	args: TrainingSessionArgs,
	{ trainingSessionService, reportingService }: Context
): Promise<TrainingSessionInterface | null> => {
	reportingService.startTrace({ op: 'trainingSession', name: 'trainingSession' })
	try {
		return await trainingSessionService.findTrainingSession({
			filter: { id: args.id, teamId: args.team },
			loadVideos: true
		})
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
