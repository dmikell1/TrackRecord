import type { Context } from '@packages/types'
import type { TrainingSessionInterface } from '@packages/types/trainingSession'

export const TrainingSession = {
	videoCount: async (
		parent: TrainingSessionInterface,
		_args: unknown,
		{ videoService }: Context
	): Promise<number> => {
		if (parent.videos !== undefined && parent.videos !== null) {
			return parent.videos.length
		}

		return videoService.countBySession({
			sessionId: parent.id,
			teamId: parent.teamId
		})
	}
}
