import type { Context } from '@packages/types'
import type { TrainingSessionInterface } from '@packages/types/trainingSession'

interface TrainingSessionsArgs {
	team: string
	type?: string
	search?: string
}

export const trainingSessions = async (
	_parent: unknown,
	args: TrainingSessionsArgs,
	{ trainingSessionService, reportingService }: Context
): Promise<TrainingSessionInterface[]> => {
	reportingService.startTrace({ op: 'trainingSessions', name: 'trainingSessions' })
	try {
		return await trainingSessionService.findTrainingSessions({
			filter: {
				teamId: args.team,
				...(args.type && { type: args.type }),
				...(args.search && { nameSearch: args.search })
			}
		})
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
