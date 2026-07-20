import { randomUUID } from 'crypto'

import { ParentalConsentStatus } from '@packages/enums/trackRecord'
import type { AthleteInterface } from '@packages/types/athlete'

export const buildMockAthlete = (overrides: Partial<AthleteInterface> = {}): AthleteInterface => ({
	id: randomUUID(),
	teamId: randomUUID(),
	companyId: randomUUID(),
	userId: null,
	firstName: 'Jane',
	lastName: 'Smith',
	email: 'jane.smith@example.com',
	phone: null,
	color: '#3b82f6',
	dateOfBirth: null,
	parentalConsentStatus: ParentalConsentStatus.NotRequired,
	parentEmail: null,
	parentalConsentToken: null,
	parentalConsentAt: null,
	deletedAt: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	...overrides
})
