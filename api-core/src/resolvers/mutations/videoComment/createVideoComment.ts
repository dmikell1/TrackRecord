import type { Context } from '@packages/types'
import type { VideoCommentInterface } from '@packages/types/videoComment'

interface CreateVideoCommentArgs {
	data: {
		team: string
		videoId: string
		text: string
		stampSeconds?: number
	}
}

export const createVideoComment = async (
	_parent: unknown,
	{ data }: CreateVideoCommentArgs,
	{ req, videoCommentService, reportingService }: Context
): Promise<VideoCommentInterface> => {
	reportingService.startTrace({ op: 'createVideoComment', name: 'createVideoComment' })
	try {
		return await videoCommentService.createVideoComment({
			teamId: data.team,
			data: {
				videoId: data.videoId,
				userId: req.session.userId,
				text: data.text,
				stampSeconds: data.stampSeconds
			}
		})
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
