import type { Context } from '@packages/types'
import type { VideoInterface } from '@packages/types/video'

interface MoveVideosArgs {
	ids: string[]
	sessionId: string
	team: string
}

export const moveVideos = async (
	_parent: unknown,
	{ ids, sessionId, team }: MoveVideosArgs,
	{ videoService, reportingService }: Context
): Promise<VideoInterface[]> => {
	reportingService.startTrace({ op: 'moveVideos', name: 'moveVideos' })
	try {
		return await videoService.moveVideos({ ids, sessionId, teamId: team })
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
