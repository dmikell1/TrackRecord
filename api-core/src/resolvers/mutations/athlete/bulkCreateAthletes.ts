import type { Context } from '@packages/types'
import type { BulkCreateAthletesResult } from '@packages/types/athlete'

interface BulkCreateAthletesArgs {
	data: {
		team: string
		companyId: string
		athletes: Array<{
			firstName: string
			lastName: string
			email: string
			phone?: string
		}>
		sendInvites?: boolean
	}
}

export const bulkCreateAthletes = async (
	_parent: unknown,
	{ data }: BulkCreateAthletesArgs,
	{ athleteService, reportingService }: Context
): Promise<BulkCreateAthletesResult> => {
	reportingService.startTrace({
		op: 'bulkCreateAthletes',
		name: 'bulkCreateAthletes'
	})
	try {
		return await athleteService.bulkCreateAthletes({
			teamId: data.team,
			companyId: data.companyId,
			athletes: data.athletes,
			sendInvites: data.sendInvites ?? false
		})
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
