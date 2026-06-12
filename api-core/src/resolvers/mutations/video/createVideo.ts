import type { Context } from '@packages/types'
import type { VideoInterface, VideoResult } from '@packages/types/video'

interface CreateVideoArgs {
	data: {
		team: string
		sessionId: string
		athleteId?: string
		event?: string
		result?: { type: string; value?: number; heights?: Array<{ height: number; cleared: boolean }> }
		videoUrl: string
		thumbUrl?: string
		orientation: string
		durationMs?: number
		recordedAt?: string
	}
}

export const createVideo = async (
	_parent: unknown,
	{ data }: CreateVideoArgs,
	{ videoService, reportingService }: Context
): Promise<VideoInterface> => {
	reportingService.startTrace({ op: 'createVideo', name: 'createVideo' })
	try {
		return await videoService.createVideo({
			data: {
				sessionId: data.sessionId,
				teamId: data.team,
				...(data.athleteId !== undefined && { athleteId: data.athleteId }),
				...(data.event !== undefined && { event: data.event }),
				videoUrl: data.videoUrl,
				orientation: data.orientation,
				result: data.result as VideoResult | undefined,
				thumbUrl: data.thumbUrl,
				durationMs: data.durationMs,
				recordedAt:
					data.recordedAt !== undefined
						? new Date(data.recordedAt)
						: new Date()
			}
		})
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
