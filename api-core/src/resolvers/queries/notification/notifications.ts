import type { Context } from '@packages/types'
import type { TrackRecordNotificationInterface } from '@packages/types/trackRecordNotification'

interface NotificationsArgs {
	team: string
	limit?: number
}

export const notifications = async (
	_parent: unknown,
	args: NotificationsArgs,
	{ req, trackRecordNotificationService, reportingService }: Context
): Promise<(TrackRecordNotificationInterface & { payload: string | null })[]> => {
	reportingService.startTrace({ op: 'notifications', name: 'notifications' })
	try {
		const results = await trackRecordNotificationService.findNotifications({
			filter: { userId: req.session.userId, teamId: args.team },
			limit: args.limit
		})
		return results.map((n) => ({
			...n,
			payload: n.payload ? JSON.stringify(n.payload) : null
		}))
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
