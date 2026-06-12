import type { Context } from '@packages/types'

interface DeleteAthleteArgs {
	id: string
	team: string
	deleteVideos: boolean
}

export const deleteAthlete = async (
	_parent: unknown,
	{ id, team, deleteVideos }: DeleteAthleteArgs,
	{ athleteService, reportingService }: Context
): Promise<boolean> => {
	reportingService.startTrace({ op: 'deleteAthlete', name: 'deleteAthlete' })
	try {
		return await athleteService.deleteAthlete({ id, teamId: team, deleteVideos })
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
