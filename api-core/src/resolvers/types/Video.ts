import type { Context } from '@packages/types'
import type { VideoInterface } from '@packages/types/video'
import type { VideoPerformanceInterface } from '@packages/types/videoPerformance'

export const Video = {
	commentCount: (parent: VideoInterface): number =>
		parent.commentCount ?? parent.comments?.length ?? 0,
	performances: async (
		parent: VideoInterface,
		_args: unknown,
		{ videoService }: Context
	): Promise<VideoPerformanceInterface[]> => {
		if (parent.performances) {
			return parent.performances
		}

		return videoService.getPerformancesForVideo({
			videoId: parent.id,
			teamId: parent.teamId
		})
	}
}
