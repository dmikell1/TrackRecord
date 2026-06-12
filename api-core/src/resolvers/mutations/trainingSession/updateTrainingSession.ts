import type { Context } from '@packages/types'
import type { TrainingSessionInterface } from '@packages/types/trainingSession'

interface UpdateTrainingSessionArgs {
	id: string
	data: {
		team: string
		name?: string
		date?: Date
		type?: string
	}
}

export const updateTrainingSession = async (
	_parent: unknown,
	{ id, data }: UpdateTrainingSessionArgs,
	{ trainingSessionService, reportingService }: Context
): Promise<TrainingSessionInterface> => {
	reportingService.startTrace({ op: 'updateTrainingSession', name: 'updateTrainingSession' })
	try {
		const updated = await trainingSessionService.updateTrainingSession({
			filter: { id, teamId: data.team },
			data: {
				...(data.name !== undefined && { name: data.name }),
				...(data.date !== undefined && { date: data.date }),
				...(data.type !== undefined && { type: data.type })
			}
		})
		if (!updated) throw new Error('Training session not found')
		return updated
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
