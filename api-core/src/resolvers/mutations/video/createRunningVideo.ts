import type { Context } from '@packages/types'
import type { VideoInterface, VideoResult } from '@packages/types/video'

interface CreateRunningVideoArgs {
	data: {
		team: string
		sessionId: string
		event?: string
		videoUrl: string
		thumbUrl?: string
		orientation: string
		durationMs?: number
		recordedAt?: string
		performances: Array<{
			athleteId: string
			result?: { type: string; value?: number; reason?: string } | null
		}>
	}
}

export const createRunningVideo = async (
	_parent: unknown,
	{ data }: CreateRunningVideoArgs,
	{ videoService, reportingService }: Context
): Promise<VideoInterface> => {
	reportingService.startTrace({
		op: 'createRunningVideo',
		name: 'createRunningVideo'
	})
	try {
		return await videoService.createRunningVideo({
			data: {
				sessionId: data.sessionId,
				teamId: data.team,
				event: data.event,
				videoUrl: data.videoUrl,
				orientation: data.orientation,
				thumbUrl: data.thumbUrl,
				durationMs: data.durationMs,
				recordedAt:
					data.recordedAt !== undefined
						? new Date(data.recordedAt)
						: new Date(),
				performances: data.performances.map(performance => ({
					athleteId: performance.athleteId,
					result:
						performance.result !== undefined && performance.result !== null
							? (performance.result as VideoResult)
							: null
				}))
			}
		})
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
