import { randomUUID } from 'crypto'

import type { VideoPerformanceInterface } from '@packages/types/videoPerformance'

export const buildMockVideoPerformance = (
	overrides: Partial<VideoPerformanceInterface> = {}
): VideoPerformanceInterface => ({
	id: randomUUID(),
	videoId: randomUUID(),
	teamId: randomUUID(),
	athleteId: randomUUID(),
	event: '100m',
	result: null,
	isPR: false,
	createdAt: new Date(),
	updatedAt: new Date(),
	...overrides
})
