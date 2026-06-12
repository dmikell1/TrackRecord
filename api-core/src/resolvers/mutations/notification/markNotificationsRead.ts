import type { Context } from '@packages/types'

interface MarkNotificationsReadArgs {
	ids: string[]
	team: string
}

export const markNotificationsRead = async (
	_parent: unknown,
	{ ids, team }: MarkNotificationsReadArgs,
	{ req, trackRecordNotificationService, reportingService }: Context
): Promise<boolean> => {
	reportingService.startTrace({ op: 'markNotificationsRead', name: 'markNotificationsRead' })
	try {
		if (!req.session.userId) {
			throw new Error('User not authenticated')
		}

		return await trackRecordNotificationService.markRead({
			ids,
			userId: req.session.userId,
			teamId: team
		})
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
