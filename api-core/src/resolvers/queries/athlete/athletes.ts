import type { Context } from '@packages/types'
import type { AthleteInterface } from '@packages/types/athlete'

interface AthletesArgs {
	team: string
	query?: string
}

export const athletes = async (
	_parent: unknown,
	args: AthletesArgs,
	{ athleteService, reportingService }: Context
): Promise<AthleteInterface[]> => {
	reportingService.startTrace({ op: 'athletes', name: 'athletes' })
	try {
		return await athleteService.findAthletes({ filter: { teamId: args.team } })
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
