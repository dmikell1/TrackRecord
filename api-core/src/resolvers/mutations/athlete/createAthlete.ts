import type { Context } from '@packages/types'
import type { CreateAthleteResult } from '@packages/types/athlete'

interface CreateAthleteArgs {
	data: {
		team: string
		companyId: string
		firstName: string
		lastName: string
		email: string
		phone?: string
		color: string
		sendInvite?: boolean
	}
}

export const createAthlete = async (
	_parent: unknown,
	{ data }: CreateAthleteArgs,
	{ athleteService, reportingService }: Context
): Promise<CreateAthleteResult> => {
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
			},
			sendInvite: data.sendInvite ?? false
		})
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
