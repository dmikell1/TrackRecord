import type { Context } from '@packages/types'
import type { VideoInterface, VideoResult } from '@packages/types/video'

interface UpdateVideoArgs {
	id: string
	data: {
		team: string
		athleteId?: string
		event?: string
		result?: { type: string; value?: number; heights?: Array<{ height: number; cleared: boolean }> }
		videoUrl?: string
		thumbUrl?: string
		durationMs?: number
	}
}

export const updateVideo = async (
	_parent: unknown,
	{ id, data }: UpdateVideoArgs,
	{ videoService, reportingService }: Context
): Promise<VideoInterface> => {
	reportingService.startTrace({ op: 'updateVideo', name: 'updateVideo' })
	try {
		const updated = await videoService.updateVideo({
			filter: { id, teamId: data.team },
			data: {
				...(data.athleteId !== undefined && { athleteId: data.athleteId }),
				...(data.event !== undefined && { event: data.event }),
				...(data.result !== undefined && { result: data.result as VideoResult }),
				...(data.videoUrl !== undefined && { videoUrl: data.videoUrl }),
				...(data.thumbUrl !== undefined && { thumbUrl: data.thumbUrl }),
				...(data.durationMs !== undefined && { durationMs: data.durationMs })
			}
		})
		if (!updated) throw new Error('Video not found')
		return updated
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
