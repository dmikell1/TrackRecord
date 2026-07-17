import type { VideoInterface } from './video'

export interface TrainingSessionInterface {
	id: string
	teamId: string
	companyId: string
	name: string
	date: Date
	type: string
	createdByUserId: string
	createdAt: Date
	updatedAt: Date
	videos?: VideoInterface[]
	/** Prefetched list count — avoids N+1 videoCount field resolvers */
	videoCount?: number
}
