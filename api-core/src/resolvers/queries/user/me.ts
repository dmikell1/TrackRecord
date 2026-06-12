import { Context, UserInterface } from '@packages/types'

export const me = async (
	_Parent: unknown,
	_Args: unknown,
	{ req, userService, reportingService }: Context
): Promise<UserInterface | undefined> => {
	reportingService.startTrace({ op: 'me', name: 'me' })
	try {
		if (req.session.userId) {
			return await userService.findUserOrFail({
				filter: { id: req.session.userId },
				relations: {
					loadCompanies: true,
					loadTeams: true,
					loadRoles: true
				}
			})
		}
		return undefined
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
