import type { Context } from '@packages/types'

interface AthleteProgressionArgs {
	team: string
	athleteId: string
	event: string
	startDate?: Date
	endDate?: Date
}

export const athleteProgression = async (
	_parent: unknown,
	args: AthleteProgressionArgs,
	{ videoService, reportingService }: Context
): Promise<{
	points: Array<{ date: Date; bestResult: number | null; sessionId: string; sessionName: string }>
	stats: { pr: number | null; recentResult: number | null; totalAttempts: number; prDate: Date | null }
}> => {
	reportingService.startTrace({ op: 'athleteProgression', name: 'athleteProgression' })
	try {
		return await videoService.getAthleteProgression({
			athleteId: args.athleteId,
			event: args.event,
			teamId: args.team,
			startDate: args.startDate,
			endDate: args.endDate
		})
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
