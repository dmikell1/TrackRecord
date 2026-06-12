import type { Context } from '@packages/types'
import type { AthleteInterface } from '@packages/types/athlete'

interface AthleteArgs {
	id: string
	team: string
}

export const athlete = async (
	_parent: unknown,
	args: AthleteArgs,
	{ athleteService, reportingService }: Context
): Promise<AthleteInterface | null> => {
	reportingService.startTrace({ op: 'athlete', name: 'athlete' })
	try {
		return await athleteService.findAthlete({ filter: { id: args.id, teamId: args.team } })
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
