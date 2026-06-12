import { injectable, inject, singleton } from 'tsyringe'

import type { TrackRecordNotificationFilter } from '@packages/repositories/notification/TrackRecordNotificationRepository'
import { TrackRecordNotificationRepository } from '@packages/repositories/notification/TrackRecordNotificationRepository'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import type { TrackRecordNotificationInterface } from '@packages/types/trackRecordNotification'

@injectable()
@singleton()
@ReportErrors()
export class TrackRecordNotificationService {
	constructor(
		@inject(TrackRecordNotificationRepository) private notificationRepository: TrackRecordNotificationRepository
	) {}

	public async createNotification({ data }: {
		data: Pick<TrackRecordNotificationInterface, 'userId' | 'teamId' | 'type' | 'text'> &
			Partial<Pick<TrackRecordNotificationInterface, 'payload'>>
	}): Promise<TrackRecordNotificationInterface> {
		return this.notificationRepository.create({ data })
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
}
