import type { Context } from '@packages/types'

interface MarkAllNotificationsReadArgs {
	team: string
}

export const markAllNotificationsRead = async (
	_parent: unknown,
	{ team }: MarkAllNotificationsReadArgs,
	{ req, trackRecordNotificationService, reportingService }: Context
): Promise<boolean> => {
	reportingService.startTrace({ op: 'markAllNotificationsRead', name: 'markAllNotificationsRead' })
	try {
		return await trackRecordNotificationService.markAllRead({ userId: req.session.userId, teamId: team })
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
