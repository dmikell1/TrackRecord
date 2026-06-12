import { randomUUID } from 'crypto'

import { NotificationType } from '@packages/enums/notifications'
import type { TrackRecordNotificationInterface } from '@packages/types/trackRecordNotification'

export const buildMockTrackRecordNotification = (
	overrides: Partial<TrackRecordNotificationInterface> = {}
): TrackRecordNotificationInterface => ({
	id: randomUUID(),
	userId: randomUUID(),
	teamId: randomUUID(),
	type: NotificationType.Comment,
	text: 'Test notification',
	read: false,
	payload: null,
	createdAt: new Date(),
	...overrides
})
