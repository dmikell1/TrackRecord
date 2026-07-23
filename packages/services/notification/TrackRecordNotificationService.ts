import { inject, injectable, singleton } from 'tsyringe'

import type { TrackRecordNotificationFilter } from '@packages/repositories/notification/TrackRecordNotificationRepository'
import { TrackRecordNotificationRepository } from '@packages/repositories/notification/TrackRecordNotificationRepository'
import ReportErrors, {
	NoTrace
} from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { PushNotificationService } from '@packages/services/push/PushNotificationService'
import type { TrackRecordNotificationInterface } from '@packages/types/trackRecordNotification'

@injectable()
@singleton()
@ReportErrors()
export class TrackRecordNotificationService {
	constructor(
		@inject(TrackRecordNotificationRepository)
		private notificationRepository: TrackRecordNotificationRepository,
		@inject(PushNotificationService)
		private pushNotificationService: PushNotificationService,
		@inject(ReportingService)
		private reportingService: ReportingService
	) {}

	public async createNotification({ data }: {
		data: Pick<TrackRecordNotificationInterface, 'userId' | 'teamId' | 'type' | 'text'> &
			Partial<Pick<TrackRecordNotificationInterface, 'payload'>>
	}): Promise<TrackRecordNotificationInterface> {
		const created = await this.notificationRepository.create({ data })

		void this.pushNotificationService
			.sendToUser({
				userId: created.userId,
				title: 'TrackRecord',
				body: created.text,
				data: this.buildPushData({ notification: created })
			})
			.catch((error: unknown) => {
				this.reportingService.reportError({ error: error as Error })
			})

		return created
	}

	public async findNotifications({ filter, limit }: {
		filter: TrackRecordNotificationFilter
		limit?: number
	}): Promise<TrackRecordNotificationInterface[]> {
		return this.notificationRepository.find({ filter, limit })
	}

	public async markRead({ ids, userId, teamId }: {
		ids: string[]
		userId: string
		teamId: string
	}): Promise<boolean> {
		return this.notificationRepository.markRead({ ids, userId, teamId })
	}

	public async markAllRead({ userId, teamId }: { userId: string; teamId: string }): Promise<boolean> {
		return this.notificationRepository.markAllRead({ userId, teamId })
	}

	@NoTrace()
	private buildPushData({
		notification
	}: {
		notification: TrackRecordNotificationInterface
	}): Record<string, string> {
		const data: Record<string, string> = {
			notificationId: notification.id,
			type: notification.type,
			teamId: notification.teamId
		}

		if (notification.payload) {
			for (const [key, value] of Object.entries(notification.payload)) {
				if (value === null || value === undefined) {
					continue
				}
				if (typeof value === 'string') {
					data[key] = value
				} else if (
					typeof value === 'number' ||
					typeof value === 'boolean'
				) {
					data[key] = String(value)
				}
			}
		}

		return data
	}
}
