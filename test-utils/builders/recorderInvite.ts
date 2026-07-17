import { randomUUID } from 'crypto'
import { addDays } from 'date-fns'

import { RecorderInviteStatus } from '@packages/enums/trackRecord'
import type { RecorderInviteInterface } from '@packages/types/recorderInvite'

export const buildMockRecorderInvite = (
	overrides: Partial<RecorderInviteInterface> = {}
): RecorderInviteInterface => ({
	id: overrides.id ?? randomUUID(),
	teamId: overrides.teamId ?? randomUUID(),
	email: overrides.email ?? 'recorder@example.com',
	token: overrides.token ?? randomUUID(),
	status: overrides.status ?? RecorderInviteStatus.Pending,
	expiresAt: overrides.expiresAt ?? addDays(new Date(), 7),
	acceptedByUserId: overrides.acceptedByUserId ?? null,
	createdAt: overrides.createdAt ?? new Date(),
	updatedAt: overrides.updatedAt ?? new Date()
})
