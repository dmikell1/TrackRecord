import type { Context } from '@packages/types'

interface DeleteVideoArgs {
	id: string
	team: string
}

export const deleteVideo = async (
	_parent: unknown,
	{ id, team }: DeleteVideoArgs,
	{ videoService, reportingService }: Context
): Promise<boolean> => {
	reportingService.startTrace({ op: 'deleteVideo', name: 'deleteVideo' })
	try {
		return await videoService.deleteVideo({ filter: { id, teamId: team } })
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
