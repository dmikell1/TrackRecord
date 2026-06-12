import type { VideoCommentInterface } from './videoComment'
import type { VideoPerformanceInterface } from './videoPerformance'

export type VideoResult =
	| { type: 'Foul' }
	| { type: 'Mark'; value: number; cleared?: boolean }
	| { type: 'VerticalHeights'; heights: Array<{ height: number; cleared: boolean }> }
	| { type: 'Time'; value: number }
	| { type: 'DNF' }
	| { type: 'DQ'; reason?: string }

export interface VideoInterface {
	id: string
	sessionId: string
	teamId: string
	athleteId: string | null
	event: string | null
	result: VideoResult | null
	isPR: boolean
	videoUrl: string
	thumbUrl: string | null
	orientation: string
	durationMs: number | null
	recordedAt: Date
	createdAt: Date
	updatedAt: Date
	commentCount?: number
	comments?: VideoCommentInterface[]
	performances?: VideoPerformanceInterface[]
}
