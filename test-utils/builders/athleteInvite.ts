import { randomUUID } from 'crypto'
import { addDays } from 'date-fns'

import { AthleteInviteStatus } from '@packages/enums/trackRecord'
import type { AthleteInviteInterface } from '@packages/types/athleteInvite'

export const buildMockAthleteInvite = (overrides: Partial<AthleteInviteInterface> = {}): AthleteInviteInterface => ({
	id: randomUUID(),
	teamId: randomUUID(),
	email: 'athlete@example.com',
	token: randomUUID(),
	status: AthleteInviteStatus.Pending,
	expiresAt: addDays(new Date(), 7),
	acceptedByUserId: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	...overrides
})
