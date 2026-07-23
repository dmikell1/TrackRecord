import { container } from 'tsyringe'

import { PushNotificationService } from '@packages/services/push/PushNotificationService'
import type { Context } from '@packages/types'

export const unregisterPushToken = async (
	_parent: unknown,
	{ token }: { token: string },
	{ req, reportingService }: Context
): Promise<boolean> => {
	reportingService.startTrace({
		op: 'unregisterPushToken',
		name: 'unregisterPushToken'
	})
	try {
		if (!req.session.userId) {
			throw new Error('User not authenticated')
		}

		const pushNotificationService = container.resolve(PushNotificationService)
		return await pushNotificationService.unregisterToken({
			userId: req.session.userId,
			token
		})
	} catch (error) {
		reportingService.reportError({ error: error as Error })
		throw error
	} finally {
		reportingService.endTrace()
	}
}
