import { container } from 'tsyringe'

import { PushPlatform } from '@packages/enums/push'
import { PushNotificationService } from '@packages/services/push/PushNotificationService'
import type { Context } from '@packages/types'

export const registerPushToken = async (
	_parent: unknown,
	{ token, platform }: { token: string; platform: PushPlatform },
	{ req, reportingService }: Context
): Promise<boolean> => {
	reportingService.startTrace({
		op: 'registerPushToken',
		name: 'registerPushToken'
	})
	try {
		if (!req.session.userId) {
			throw new Error('User not authenticated')
		}

		const pushNotificationService = container.resolve(PushNotificationService)
		await pushNotificationService.registerToken({
			userId: req.session.userId,
			token,
			platform
		})
		return true
	} catch (error) {
		reportingService.reportError({ error: error as Error })
		throw error
	} finally {
		reportingService.endTrace()
	}
}
