import { container } from 'tsyringe'

import { UserService } from '@packages/services/user/UserService'
import type { Context } from '@packages/types'

export const deleteMyAccount = async (
	_parent: unknown,
	_args: unknown,
	{ req, reportingService }: Context
): Promise<boolean> => {
	reportingService.startTrace({
		op: 'deleteMyAccount',
		name: 'deleteMyAccount'
	})
	try {
		if (!req.session.userId) {
			throw new Error('User not authenticated')
		}

		const userService = container.resolve(UserService)
		return await userService.deleteMyAccount({
			userId: req.session.userId
		})
	} catch (error) {
		reportingService.reportError({ error: error as Error })
		throw error
	} finally {
		reportingService.endTrace()
	}
}
