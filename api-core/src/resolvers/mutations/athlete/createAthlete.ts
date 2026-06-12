import type { Context } from '@packages/types'
import type { AthleteInterface } from '@packages/types/athlete'

interface CreateAthleteArgs {
	data: {
		team: string
		companyId: string
		firstName: string
		lastName: string
		email: string
		phone?: string
		color: string
	}
}

export const createAthlete = async (
	_parent: unknown,
	{ data }: CreateAthleteArgs,
	{ athleteService, reportingService }: Context
): Promise<AthleteInterface> => {
	reportingService.startTrace({ op: 'createAthlete', name: 'createAthlete' })
	try {
		return await athleteService.createAthlete({
			data: {
				teamId: data.team,
				companyId: data.companyId,
				firstName: data.firstName,
				lastName: data.lastName,
				email: data.email,
				color: data.color,
				...(data.phone !== undefined && { phone: data.phone })
			}
		})
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
