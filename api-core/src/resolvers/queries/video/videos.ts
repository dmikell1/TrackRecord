import type { Context } from '@packages/types'
import type { VideoInterface } from '@packages/types/video'

interface VideosArgs {
	team: string
	sessionId?: string
	athleteId?: string
	event?: string
}

export const videos = async (
	_parent: unknown,
	args: VideosArgs,
	{ videoService, reportingService }: Context
): Promise<VideoInterface[]> => {
	reportingService.startTrace({ op: 'videos', name: 'videos' })
	try {
		return await videoService.findVideos({
			filter: {
				teamId: args.team,
				...(args.sessionId && { sessionId: args.sessionId }),
				...(args.athleteId && { athleteId: args.athleteId }),
				...(args.event && { event: args.event })
			}
		})
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
