import { randomUUID } from 'crypto'

import type { VideoInterface, VideoResult } from '@packages/types/video'

export const buildMockVideo = (overrides: Partial<VideoInterface> = {}): VideoInterface => ({
	id: randomUUID(),
	sessionId: randomUUID(),
	teamId: randomUUID(),
	athleteId: randomUUID(),
	event: '100m',
	result: null,
	isPR: false,
	videoUrl: 'https://example.com/video.mp4',
	thumbUrl: null,
	orientation: 'landscape',
	durationMs: null,
	recordedAt: new Date(),
	createdAt: new Date(),
	updatedAt: new Date(),
	...overrides
})

export const buildMarkResult = ({
	value,
	cleared
}: {
	value: number
	cleared?: boolean
}): VideoResult => ({
	type: 'Mark',
	value,
	...(cleared !== undefined && { cleared })
})

export const buildVerticalMarkResult = ({
	value,
	cleared
}: {
	value: number
	cleared: boolean
}): VideoResult => ({
	type: 'Mark',
	value,
	cleared
})

/** @deprecated Legacy multi-height format — use buildVerticalMarkResult */
export const buildVerticalHeightsResult = ({
	heights
}: {
	heights: Array<{ height: number; cleared: boolean }>
}): VideoResult => ({
	type: 'VerticalHeights',
	heights
})

export const buildFoulResult = (): VideoResult => ({ type: 'Foul' })

export const buildTimeResult = ({
	value
}: {
	value: number
}): VideoResult => ({
	type: 'Time',
	value
})
