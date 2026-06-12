import type { Context } from '@packages/types'
import type { TrainingSessionInterface } from '@packages/types/trainingSession'

interface CreateTrainingSessionArgs {
	data: {
		team: string
		companyId: string
		name: string
		date: Date
		type: string
	}
}

export const createTrainingSession = async (
	_parent: unknown,
	{ data }: CreateTrainingSessionArgs,
	{ req, trainingSessionService, reportingService }: Context
): Promise<TrainingSessionInterface> => {
	reportingService.startTrace({ op: 'createTrainingSession', name: 'createTrainingSession' })
	try {
		return await trainingSessionService.createTrainingSession({
			data: {
				teamId: data.team,
				companyId: data.companyId,
				name: data.name,
				date: data.date,
				type: data.type,
				createdByUserId: req.session.userId
			}
		})
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
