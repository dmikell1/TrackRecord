import { randomUUID } from 'crypto'

import { SessionType } from '@packages/enums/trackRecord'
import type { TrainingSessionInterface } from '@packages/types/trainingSession'

export const buildMockTrainingSession = (
	overrides: Partial<TrainingSessionInterface> = {}
): TrainingSessionInterface => ({
	id: randomUUID(),
	teamId: randomUUID(),
	companyId: randomUUID(),
	name: 'Spring Practice',
	date: new Date(),
	type: SessionType.Practice,
	createdByUserId: randomUUID(),
	createdAt: new Date(),
	updatedAt: new Date(),
	...overrides
})
