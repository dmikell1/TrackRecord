import type { Context } from '@packages/types'
import type { TeamInterface } from '@packages/types/team'

interface UpdateTeamArgs {
	team: string
	name: string
}

export const updateTeam = async (
	_parent: unknown,
	{ team, name }: UpdateTeamArgs,
	{ teamService, reportingService }: Context
): Promise<TeamInterface> => {
	reportingService.startTrace({ op: 'updateTeam', name: 'updateTeam' })
	try {
		const trimmedName = name.trim()
		if (trimmedName.length === 0) {
			throw new Error('Team name is required')
		}

		const updated = await teamService.updateTeam({
			filter: { id: team },
			data: { name: trimmedName }
		})

		if (!updated) {
			throw new Error('Team not found')
		}

		return updated
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
