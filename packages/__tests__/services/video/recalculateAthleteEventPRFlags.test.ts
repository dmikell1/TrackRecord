import { TrackEvent } from '@packages/enums'

import {
	pickPRPerformanceFromChronologicalAttempts,
	pickPRVideoIdFromChronologicalAttempts
} from '@packages/services/video/recalculateAthleteEventPRFlags'

describe('recalculateAthleteEventPRFlags', () => {
	describe('pickPRVideoIdFromChronologicalAttempts', () => {
		it('marks only the latest chronological personal best', () => {
			const prVideoId = pickPRVideoIdFromChronologicalAttempts({
				event: TrackEvent.HighJump,
				attempts: [
					{
						videoId: 'video-lower',
						sortDate: new Date('2026-06-21T10:00:00Z'),
						value: 1.95
					},
					{
						videoId: 'video-higher',
						sortDate: new Date('2026-06-21T10:05:00Z'),
						value: 2.03
					}
				]
			})

			expect(prVideoId).toBe('video-higher')
		})

		it('does not mark an equal mark as a new PR', () => {
			const prVideoId = pickPRVideoIdFromChronologicalAttempts({
				event: TrackEvent.HighJump,
				attempts: [
					{
						videoId: 'video-first',
						sortDate: new Date('2026-06-21T10:00:00Z'),
						value: 2.03
					},
					{
						videoId: 'video-second',
						sortDate: new Date('2026-06-21T10:05:00Z'),
						value: 2.03
					}
				]
			})

			expect(prVideoId).toBe('video-first')
		})
	})

	describe('pickPRPerformanceFromChronologicalAttempts', () => {
		it('returns the performance that set the current best', () => {
			const prPerformance = pickPRPerformanceFromChronologicalAttempts({
				event: TrackEvent.M100,
				attempts: [
					{
						performanceId: 'perf-slower',
						videoId: 'video-1',
						sortDate: new Date('2026-06-21T10:00:00Z'),
						value: 11.2
					},
					{
						performanceId: 'perf-faster',
						videoId: 'video-2',
						sortDate: new Date('2026-06-21T10:05:00Z'),
						value: 10.9
					}
				]
			})

			expect(prPerformance).toEqual({
				performanceId: 'perf-faster',
				videoId: 'video-2'
			})
		})
	})
})
