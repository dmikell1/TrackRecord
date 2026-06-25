import type { Context } from '@packages/types'
import type { VideoInterface, VideoResult } from '@packages/types/video'

interface UpdateVideoPerformancesArgs {
	id: string
	data: {
		team: string
		event?: string | null
		performances: Array<{
			athleteId: string
			result?: { type: string; value?: number; reason?: string } | null
		}>
	}
}

export const updateVideoPerformances = async (
	_parent: unknown,
	{ id, data }: UpdateVideoPerformancesArgs,
	{ videoService, reportingService }: Context
): Promise<VideoInterface> => {
	reportingService.startTrace({
		op: 'updateVideoPerformances',
		name: 'updateVideoPerformances'
	})
	try {
		return await videoService.updateVideoPerformances({
			videoId: id,
			teamId: data.team,
			event: data.event,
			performances: data.performances.map(performance => ({
				athleteId: performance.athleteId,
				result:
					performance.result !== undefined && performance.result !== null
						? (performance.result as VideoResult)
						: null
			}))
		})
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
