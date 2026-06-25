import type { VideoResult } from './video'

export interface VideoPerformanceInterface {
	id: string
	videoId: string
	teamId: string
	athleteId: string
	event: string | null
	result: VideoResult | null
	isPR: boolean
	createdAt: Date
	updatedAt: Date
}
