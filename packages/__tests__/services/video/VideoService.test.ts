import { mock } from 'jest-mock-extended'
import { container } from 'tsyringe'

import { SessionType, TrackEvent } from '@packages/enums'
import { TrainingSessionRepository } from '@packages/repositories/trainingSession/TrainingSessionRepository'
import { VideoRepository } from '@packages/repositories/video/VideoRepository'
import { VideoPerformanceRepository } from '@packages/repositories/videoPerformance/VideoPerformanceRepository'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { VideoService } from '@packages/services/video/VideoService'

import { buildMockTrainingSession } from '@builders/trainingSession'
import {
	buildMockVideo,
	buildMarkResult,
	buildVerticalHeightsResult,
	buildVerticalMarkResult,
	buildFoulResult
} from '@builders/video'

describe('VideoService', () => {
	let videoService: VideoService
	let mockVideoRepository: jest.Mocked<VideoRepository>
	let mockVideoPerformanceRepository: jest.Mocked<VideoPerformanceRepository>
	let mockTrainingSessionRepository: jest.Mocked<TrainingSessionRepository>
	let mockReportingService: jest.Mocked<ReportingService>

	beforeEach(() => {
		mockVideoRepository = mock<VideoRepository>()
		mockVideoPerformanceRepository = mock<VideoPerformanceRepository>()
		mockTrainingSessionRepository = mock<TrainingSessionRepository>()
		mockReportingService = mock<ReportingService>()

		mockReportingService.withTrace.mockImplementation(({ fn }) => fn())
		mockVideoPerformanceRepository.find.mockResolvedValue([])

		container.registerInstance(VideoRepository, mockVideoRepository)
		container.registerInstance(
			VideoPerformanceRepository,
			mockVideoPerformanceRepository
		)
		container.registerInstance(
			TrainingSessionRepository,
			mockTrainingSessionRepository
		)
		container.registerInstance(ReportingService, mockReportingService)

		videoService = container.resolve(VideoService)
	})

	afterEach(() => {
		container.clearInstances()
	})

	// ------------------------------------------------------------------
	describe('createVideo — PR detection', () => {
		it('marks video as PR when athlete has no prior videos', async () => {
			mockVideoRepository.find.mockResolvedValue([])
			const newVideo = buildMockVideo({ isPR: true, result: buildMarkResult({ value: 10.5 }) })
			mockVideoRepository.create.mockResolvedValue(newVideo)

			const result = await videoService.createVideo({
				data: {
					sessionId: 'session-1',
					teamId: 'team-1',
					athleteId: 'athlete-1',
					event: TrackEvent.LongJump,
					videoUrl: 'https://example.com/video.mp4',
					orientation: 'landscape',
					result: buildMarkResult({ value: 10.5 })
				}
			})

			expect(result.isPR).toBe(true)
			expect(mockVideoRepository.create).toHaveBeenCalledWith({
				data: expect.objectContaining({ isPR: true })
			})
		})

		it('marks video as PR when new mark beats previous best', async () => {
			const previousBest = buildMockVideo({ result: buildMarkResult({ value: 10.2 }) })
			mockVideoRepository.find.mockResolvedValue([previousBest])
			const newVideo = buildMockVideo({ isPR: true, result: buildMarkResult({ value: 10.5 }) })
			mockVideoRepository.create.mockResolvedValue(newVideo)

			const result = await videoService.createVideo({
				data: {
					sessionId: 'session-1',
					teamId: 'team-1',
					athleteId: 'athlete-1',
					event: TrackEvent.LongJump,
					videoUrl: 'https://example.com/video.mp4',
					orientation: 'landscape',
					result: buildMarkResult({ value: 10.5 })
				}
			})

			expect(result.isPR).toBe(true)
		})

		it('does not mark as PR when new mark is worse than previous best', async () => {
			const previousBest = buildMockVideo({ result: buildMarkResult({ value: 10.8 }) })
			mockVideoRepository.find.mockResolvedValue([previousBest])
			const newVideo = buildMockVideo({ isPR: false, result: buildMarkResult({ value: 10.2 }) })
			mockVideoRepository.create.mockResolvedValue(newVideo)

			await videoService.createVideo({
				data: {
					sessionId: 'session-1',
					teamId: 'team-1',
					athleteId: 'athlete-1',
					event: TrackEvent.LongJump,
					videoUrl: 'https://example.com/video.mp4',
					orientation: 'landscape',
					result: buildMarkResult({ value: 10.2 })
				}
			})

			expect(mockVideoRepository.create).toHaveBeenCalledWith({
				data: expect.objectContaining({ isPR: false })
			})
		})

		it('creates untagged video without PR detection', async () => {
			const newVideo = buildMockVideo({
				isPR: false,
				athleteId: null,
				event: null,
				result: null
			})
			mockVideoRepository.create.mockResolvedValue(newVideo)

			await videoService.createVideo({
				data: {
					sessionId: 'session-1',
					teamId: 'team-1',
					videoUrl: 'https://example.com/video.mp4',
					orientation: 'landscape'
				}
			})

			expect(mockVideoRepository.find).not.toHaveBeenCalled()
			expect(mockVideoRepository.create).toHaveBeenCalledWith({
				data: expect.objectContaining({ isPR: false })
			})
		})

		it('does not mark as PR when result is a Foul', async () => {
			mockVideoRepository.find.mockResolvedValue([])
			const newVideo = buildMockVideo({ isPR: false, result: buildFoulResult() })
			mockVideoRepository.create.mockResolvedValue(newVideo)

			await videoService.createVideo({
				data: {
					sessionId: 'session-1',
					teamId: 'team-1',
					athleteId: 'athlete-1',
					event: TrackEvent.LongJump,
					videoUrl: 'https://example.com/video.mp4',
					orientation: 'landscape',
					result: buildFoulResult()
				}
			})

			expect(mockVideoRepository.create).toHaveBeenCalledWith({
				data: expect.objectContaining({ isPR: false })
			})
		})

		it('detects PR for vertical Mark when cleared height beats previous best', async () => {
			const previousBest = buildMockVideo({
				result: buildVerticalMarkResult({ value: 1.8, cleared: true })
			})
			mockVideoRepository.find.mockResolvedValue([previousBest])
			const newVideo = buildMockVideo({ isPR: true })
			mockVideoRepository.create.mockResolvedValue(newVideo)

			await videoService.createVideo({
				data: {
					sessionId: 'session-1',
					teamId: 'team-1',
					athleteId: 'athlete-1',
					event: 'High Jump',
					videoUrl: 'https://example.com/video.mp4',
					orientation: 'landscape',
					result: buildVerticalMarkResult({ value: 1.9, cleared: true })
				}
			})

			expect(mockVideoRepository.create).toHaveBeenCalledWith({
				data: expect.objectContaining({ isPR: true })
			})
		})

		it('does not mark PR for vertical Mark when attempt is missed', async () => {
			mockVideoRepository.find.mockResolvedValue([])
			const newVideo = buildMockVideo({ isPR: false })
			mockVideoRepository.create.mockResolvedValue(newVideo)

			await videoService.createVideo({
				data: {
					sessionId: 'session-1',
					teamId: 'team-1',
					athleteId: 'athlete-1',
					event: 'High Jump',
					videoUrl: 'https://example.com/video.mp4',
					orientation: 'landscape',
					result: buildVerticalMarkResult({ value: 1.8, cleared: false })
				}
			})

			expect(mockVideoRepository.create).toHaveBeenCalledWith({
				data: expect.objectContaining({ isPR: false })
			})
		})

		it('still reads legacy VerticalHeights for PR detection', async () => {
			const previousBest = buildMockVideo({
				result: buildVerticalHeightsResult({
					heights: [
						{ height: 1.8, cleared: true },
						{ height: 1.9, cleared: false }
					]
				})
			})
			mockVideoRepository.find.mockResolvedValue([previousBest])
			const newVideo = buildMockVideo({ isPR: true })
			mockVideoRepository.create.mockResolvedValue(newVideo)

			await videoService.createVideo({
				data: {
					sessionId: 'session-1',
					teamId: 'team-1',
					athleteId: 'athlete-1',
					event: 'High Jump',
					videoUrl: 'https://example.com/video.mp4',
					orientation: 'landscape',
					result: buildVerticalMarkResult({ value: 1.95, cleared: true })
				}
			})

			expect(mockVideoRepository.create).toHaveBeenCalledWith({
				data: expect.objectContaining({ isPR: true })
			})
		})
	})

	// ------------------------------------------------------------------
	describe('findVideo', () => {
		it('returns video when found', async () => {
			const mockVideo = buildMockVideo()
			mockVideoRepository.findOne.mockResolvedValue(mockVideo)

			const result = await videoService.findVideo({ filter: { id: mockVideo.id } })

			expect(result).toEqual(mockVideo)
			expect(mockVideoRepository.findOne).toHaveBeenCalledWith({
				filter: { id: mockVideo.id },
				loadComments: undefined
			})
		})

		it('returns null when video not found', async () => {
			mockVideoRepository.findOne.mockResolvedValue(null)

			const result = await videoService.findVideo({ filter: { id: 'missing' } })

			expect(result).toBeNull()
		})
	})

	// ------------------------------------------------------------------
	describe('findVideoOrFail', () => {
		it('throws when video not found', async () => {
			mockVideoRepository.findOne.mockResolvedValue(null)

			await expect(
				videoService.findVideoOrFail({ filter: { id: 'missing' } })
			).rejects.toThrow('No video found')

			expect(mockReportingService.reportError).toHaveBeenCalled()
		})
	})

	// ------------------------------------------------------------------
	describe('getAthleteProgression', () => {
		it('excludes practice session videos from progression', async () => {
			const meetSessionId = 'meet-session-1'
			const practiceSessionId = 'practice-session-1'
			const meetDate = new Date('2024-03-01T12:00:00.000Z')

			mockTrainingSessionRepository.find.mockResolvedValue([
				buildMockTrainingSession({
					id: meetSessionId,
					teamId: 'team-1',
					type: SessionType.Meet,
					name: 'State Meet',
					date: meetDate
				})
			])
			mockVideoRepository.find.mockResolvedValue([
				buildMockVideo({
					sessionId: meetSessionId,
					teamId: 'team-1',
					athleteId: 'athlete-1',
					event: 'LongJump',
					result: buildMarkResult({ value: 6.5 }),
					createdAt: meetDate
				}),
				buildMockVideo({
					sessionId: practiceSessionId,
					teamId: 'team-1',
					athleteId: 'athlete-1',
					event: 'LongJump',
					result: buildMarkResult({ value: 7.2 }),
					createdAt: new Date('2024-03-02T12:00:00.000Z')
				})
			])

			const result = await videoService.getAthleteProgression({
				athleteId: 'athlete-1',
				event: 'LongJump',
				teamId: 'team-1'
			})

			expect(result.points).toHaveLength(1)
			expect(result.points[0]?.bestResult).toBe(6.5)
			expect(result.points[0]?.sessionName).toBe('State Meet')
			expect(result.stats.pr).toBe(6.5)
			expect(result.stats.totalAttempts).toBe(1)
		})

		it('returns best mark per meet session when multiple videos exist in one meet', async () => {
			const meetSessionId = 'meet-session-1'
			const meetDate = new Date('2024-03-01T12:00:00.000Z')

			mockTrainingSessionRepository.find.mockResolvedValue([
				buildMockTrainingSession({
					id: meetSessionId,
					teamId: 'team-1',
					type: SessionType.Meet,
					name: 'State Meet',
					date: meetDate
				})
			])
			mockVideoRepository.find.mockResolvedValue([
				buildMockVideo({
					sessionId: meetSessionId,
					teamId: 'team-1',
					athleteId: 'athlete-1',
					event: 'HighJump',
					result: buildMarkResult({ value: 1.78 }),
					createdAt: new Date('2024-03-01T12:00:00.000Z')
				}),
				buildMockVideo({
					sessionId: meetSessionId,
					teamId: 'team-1',
					athleteId: 'athlete-1',
					event: 'HighJump',
					result: buildMarkResult({ value: 1.63 }),
					createdAt: new Date('2024-03-01T12:05:00.000Z')
				}),
				buildMockVideo({
					sessionId: meetSessionId,
					teamId: 'team-1',
					athleteId: 'athlete-1',
					event: 'HighJump',
					result: buildVerticalMarkResult({ value: 1.78, cleared: false }),
					createdAt: new Date('2024-03-01T12:10:00.000Z')
				})
			])

			const result = await videoService.getAthleteProgression({
				athleteId: 'athlete-1',
				event: 'HighJump',
				teamId: 'team-1'
			})

			expect(result.points).toHaveLength(1)
			expect(result.points[0]?.bestResult).toBe(1.78)
			expect(result.stats.totalAttempts).toBe(3)
		})

		it('returns one progression point per meet across the season', async () => {
			const earlyMeetId = 'meet-session-1'
			const lateMeetId = 'meet-session-2'

			mockTrainingSessionRepository.find.mockResolvedValue([
				buildMockTrainingSession({
					id: earlyMeetId,
					teamId: 'team-1',
					type: SessionType.Meet,
					name: 'Early Season Meet',
					date: new Date('2024-03-01T12:00:00.000Z')
				}),
				buildMockTrainingSession({
					id: lateMeetId,
					teamId: 'team-1',
					type: SessionType.Meet,
					name: 'Conference Meet',
					date: new Date('2024-04-15T12:00:00.000Z')
				})
			])
			mockVideoRepository.find.mockResolvedValue([
				buildMockVideo({
					sessionId: earlyMeetId,
					teamId: 'team-1',
					athleteId: 'athlete-1',
					event: 'HighJump',
					result: buildMarkResult({ value: 1.63 })
				}),
				buildMockVideo({
					sessionId: lateMeetId,
					teamId: 'team-1',
					athleteId: 'athlete-1',
					event: 'HighJump',
					result: buildMarkResult({ value: 1.78 })
				})
			])

			const result = await videoService.getAthleteProgression({
				athleteId: 'athlete-1',
				event: 'HighJump',
				teamId: 'team-1'
			})

			expect(result.points).toHaveLength(2)
			expect(result.points.map(point => point.bestResult)).toEqual([1.63, 1.78])
			expect(result.points.map(point => point.sessionName)).toEqual([
				'Early Season Meet',
				'Conference Meet'
			])
			expect(result.stats.pr).toBe(1.78)
			expect(result.stats.recentResult).toBe(1.78)
		})

		it('returns empty progression when athlete only has practice data', async () => {
			mockTrainingSessionRepository.find.mockResolvedValue([
				buildMockTrainingSession({
					id: 'meet-session-1',
					teamId: 'team-1',
					type: SessionType.Meet
				})
			])
			mockVideoRepository.find.mockResolvedValue([
				buildMockVideo({
					sessionId: 'practice-session-1',
					teamId: 'team-1',
					athleteId: 'athlete-1',
					event: 'LongJump',
					result: buildMarkResult({ value: 7.2 })
				})
			])

			const result = await videoService.getAthleteProgression({
				athleteId: 'athlete-1',
				event: 'LongJump',
				teamId: 'team-1'
			})

			expect(result.points).toHaveLength(0)
			expect(result.stats.pr).toBeNull()
			expect(result.stats.totalAttempts).toBe(0)
		})
	})

	// ------------------------------------------------------------------
	describe('moveVideos', () => {
		it('delegates to repository', async () => {
			const moved = [buildMockVideo({ sessionId: 'new-session' })]
			mockVideoRepository.moveToSession.mockResolvedValue(moved)

			const result = await videoService.moveVideos({
				ids: ['v-1', 'v-2'],
				sessionId: 'new-session',
				teamId: 'team-1'
			})

			expect(result).toEqual(moved)
			expect(mockVideoRepository.moveToSession).toHaveBeenCalledWith({
				ids: ['v-1', 'v-2'],
				sessionId: 'new-session',
				teamId: 'team-1'
			})
		})
	})
})
