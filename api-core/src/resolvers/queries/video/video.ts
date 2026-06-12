import type { Context } from '@packages/types'
import type { VideoInterface } from '@packages/types/video'

interface VideoArgs {
	id: string
	team: string
}

export const video = async (
	_parent: unknown,
	args: VideoArgs,
	{ videoService, reportingService }: Context
): Promise<VideoInterface | null> => {
	reportingService.startTrace({ op: 'video', name: 'video' })
	try {
		return await videoService.findVideo({
			filter: { id: args.id, teamId: args.team },
			loadComments: true,
			loadPerformances: true
		})
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
