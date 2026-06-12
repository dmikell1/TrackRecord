import type { Context } from '@packages/types'
import type { AthleteInterface } from '@packages/types/athlete'

interface UpdateAthleteArgs {
	id: string
	data: {
		team: string
		firstName?: string
		lastName?: string
		email?: string
		phone?: string
		color?: string
	}
}

export const updateAthlete = async (
	_parent: unknown,
	{ id, data }: UpdateAthleteArgs,
	{ athleteService, reportingService }: Context
): Promise<AthleteInterface> => {
	reportingService.startTrace({ op: 'updateAthlete', name: 'updateAthlete' })
	try {
		const updated = await athleteService.updateAthlete({
			filter: { id, teamId: data.team },
			data: {
				...(data.firstName !== undefined && { firstName: data.firstName }),
				...(data.lastName !== undefined && { lastName: data.lastName }),
				...(data.email !== undefined && { email: data.email }),
				...(data.phone !== undefined && { phone: data.phone }),
				...(data.color !== undefined && { color: data.color })
			}
		})
		if (!updated) throw new Error('Athlete not found')
		return updated
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
