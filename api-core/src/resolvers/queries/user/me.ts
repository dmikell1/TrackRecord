import { container } from 'tsyringe'

import { CoachSignupService } from '@packages/services/user/CoachSignupService'
import { Context, UserInterface } from '@packages/types'

export const me = async (
	_Parent: unknown,
	_Args: unknown,
	{ req, userService, reportingService }: Context
): Promise<UserInterface | undefined> => {
	reportingService.startTrace({ op: 'me', name: 'me' })
	try {
		let userId = req.authUserId || req.session.userId
		const clerkId = req.authClerkId || req.session.clerkId

		if (!userId && clerkId) {
			const coachSignupService = container.resolve(CoachSignupService)
			const provisionedUser =
				await coachSignupService.provisionFromClerkIdIfMissing({
					clerkId
				})

			if (provisionedUser) {
				req.authUserId = provisionedUser.id
				req.session.userId = provisionedUser.id
				req.session.user = provisionedUser
				userId = provisionedUser.id
			}
		}

		if (!userId) {
			return undefined
		}

		return await userService.findUserOrFail({
			filter: { id: userId },
			relations: {
				loadCompanies: true,
				loadTeams: true,
				loadRoles: true
			}
		})
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
