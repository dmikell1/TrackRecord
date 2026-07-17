import { mock } from 'jest-mock-extended'
import { container } from 'tsyringe'

import { SessionType, TrackEvent } from '@packages/enums'
import { TrainingSessionRepository } from '@packages/repositories/trainingSession/TrainingSessionRepository'
import { VideoRepository } from '@packages/repositories/video/VideoRepository'
import { VideoPerformanceRepository } from '@packages/repositories/videoPerformance/VideoPerformanceRepository'
import { EntitlementService } from '@packages/services/billing/EntitlementService'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { VideoService } from '@packages/services/video/VideoService'

import { buildMockTrainingSession } from '@builders/trainingSession'
import {
	buildMockVideo,
	buildMarkResult,
	buildTimeResult,
	buildVerticalHeightsResult,
	buildVerticalMarkResult,
	buildFoulResult
} from '@builders/video'
import { buildMockVideoPerformance } from '@builders/videoPerformance'

describe('VideoService', () => {
	let videoService: VideoService
	let mockVideoRepository: jest.Mocked<VideoRepository>
	let mockVideoPerformanceRepository: jest.Mocked<VideoPerformanceRepository>
	let mockTrainingSessionRepository: jest.Mocked<TrainingSessionRepository>
	let mockEntitlementService: jest.Mocked<EntitlementService>
	let mockReportingService: jest.Mocked<ReportingService>

	beforeEach(() => {
		mockVideoRepository = mock<VideoRepository>()
		mockVideoPerformanceRepository = mock<VideoPerformanceRepository>()
		mockTrainingSessionRepository = mock<TrainingSessionRepository>()
		mockEntitlementService = mock<EntitlementService>()
		mockReportingService = mock<ReportingService>()

		mockReportingService.withTrace.mockImplementation(({ fn }) => fn())
		mockEntitlementService.assertCanWrite.mockResolvedValue(undefined)
		mockVideoPerformanceRepository.find.mockResolvedValue([])
		mockTrainingSessionRepository.findOne.mockResolvedValue(
			buildMockTrainingSession({
				id: 'session-1',
				teamId: 'team-1',
				companyId: 'company-1',
				type: SessionType.Meet
			})
		)
		mockTrainingSessionRepository.find.mockResolvedValue([
			buildMockTrainingSession({
				id: 'session-1',
				teamId: 'team-1',
				type: SessionType.Meet
			})
		])
		mockVideoRepository.clearPRForAthleteEvent.mockResolvedValue(undefined)
		mockVideoPerformanceRepository.clearPRForAthleteEvent.mockResolvedValue(
			undefined
		)
		mockVideoRepository.findByIds.mockResolvedValue([])
		mockVideoRepository.update.mockResolvedValue(null)

		container.registerInstance(VideoRepository, mockVideoRepository)
		container.registerInstance(
			VideoPerformanceRepository,
			mockVideoPerformanceRepository
		)
		container.registerInstance(
			TrainingSessionRepository,
			mockTrainingSessionRepository
		)
		container.registerInstance(EntitlementService, mockEntitlementService)
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
			mockVideoRepository.findOne.mockResolvedValue(
				buildMockVideo({ isPR: true, result: buildMarkResult({ value: 10.5 }) })
			)
			const newVideo = buildMockVideo({
				isPR: false,
				result: buildMarkResult({ value: 10.5 })
			})
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
				data: expect.objectContaining({ isPR: false })
			})
			expect(mockVideoRepository.clearPRForAthleteEvent).toHaveBeenCalled()
		})

		it('marks video as PR when new mark beats previous best', async () => {
			const previousBest = buildMockVideo({
				id: 'video-old',
				sessionId: 'session-1',
				teamId: 'team-1',
				result: buildMarkResult({ value: 10.2 })
			})
			mockVideoRepository.find.mockResolvedValue([previousBest])
			mockVideoRepository.findOne.mockResolvedValue(
				buildMockVideo({ isPR: true, result: buildMarkResult({ value: 10.5 }) })
			)
			const newVideo = buildMockVideo({
				isPR: false,
				result: buildMarkResult({ value: 10.5 })
			})
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
			expect(mockVideoRepository.update).toHaveBeenCalledWith({
				filter: { id: expect.any(String), teamId: 'team-1' },
				data: { isPR: true }
			})
		})

		it('does not mark as PR when new mark is worse than previous best', async () => {
			const previousBest = buildMockVideo({
				sessionId: 'session-1',
				teamId: 'team-1',
				result: buildMarkResult({ value: 10.8 })
			})
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
				id: 'video-old',
				sessionId: 'session-1',
				teamId: 'team-1',
				result: buildVerticalMarkResult({ value: 1.8, cleared: true })
			})
			mockVideoRepository.find.mockResolvedValue([previousBest])
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
					result: buildVerticalMarkResult({ value: 1.9, cleared: true })
				}
			})

			expect(mockVideoRepository.create).toHaveBeenCalledWith({
				data: expect.objectContaining({ isPR: false })
			})
			expect(mockVideoRepository.update).toHaveBeenCalledWith({
				filter: { id: expect.any(String), teamId: 'team-1' },
				data: { isPR: true }
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
				id: 'video-old',
				sessionId: 'session-1',
				teamId: 'team-1',
				result: buildVerticalHeightsResult({
					heights: [
						{ height: 1.8, cleared: true },
						{ height: 1.9, cleared: false }
					]
				})
			})
			mockVideoRepository.find.mockResolvedValue([previousBest])
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
					result: buildVerticalMarkResult({ value: 1.95, cleared: true })
				}
			})

			expect(mockVideoRepository.update).toHaveBeenCalledWith({
				filter: { id: expect.any(String), teamId: 'team-1' },
				data: { isPR: true }
			})
		})

		it('does not mark practice session videos as PR', async () => {
			mockTrainingSessionRepository.findOne.mockResolvedValue(
				buildMockTrainingSession({
					id: 'practice-session-1',
					teamId: 'team-1',
					type: SessionType.Practice
				})
			)
			mockVideoRepository.find.mockResolvedValue([])
			const newVideo = buildMockVideo({
				isPR: false,
				result: buildMarkResult({ value: 10.5 })
			})
			mockVideoRepository.create.mockResolvedValue(newVideo)

			await videoService.createVideo({
				data: {
					sessionId: 'practice-session-1',
					teamId: 'team-1',
					athleteId: 'athlete-1',
					event: TrackEvent.LongJump,
					videoUrl: 'https://example.com/video.mp4',
					orientation: 'landscape',
					result: buildMarkResult({ value: 10.5 })
				}
			})

			expect(mockVideoRepository.find).not.toHaveBeenCalled()
			expect(mockVideoRepository.create).toHaveBeenCalledWith({
				data: expect.objectContaining({ isPR: false })
			})
		})

		it('clears previous PR flags when a new meet PR is set', async () => {
			mockVideoRepository.find.mockResolvedValue([])
			mockVideoRepository.findOne.mockResolvedValue(
				buildMockVideo({ isPR: true, result: buildMarkResult({ value: 10.5 }) })
			)
			const newVideo = buildMockVideo({
				id: 'new-video-id',
				isPR: false,
				result: buildMarkResult({ value: 10.5 })
			})
			mockVideoRepository.create.mockResolvedValue(newVideo)

			await videoService.createVideo({
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

			expect(mockVideoRepository.clearPRForAthleteEvent).toHaveBeenCalledWith({
				athleteId: 'athlete-1',
				event: TrackEvent.LongJump,
				teamId: 'team-1'
			})
			expect(
				mockVideoPerformanceRepository.clearPRForAthleteEvent
			).toHaveBeenCalledWith({
				athleteId: 'athlete-1',
				event: TrackEvent.LongJump,
				teamId: 'team-1'
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

		it('loads only performance videos by id for running events', async () => {
			const meetSessionId = 'meet-session-1'
			const videoId = 'running-video-1'
			const meetDate = new Date('2024-03-01T12:00:00.000Z')

			mockTrainingSessionRepository.find.mockResolvedValue([
				buildMockTrainingSession({
					id: meetSessionId,
					teamId: 'team-1',
					type: SessionType.Meet,
					name: 'Sprint Meet',
					date: meetDate
				})
			])
			mockVideoRepository.find.mockResolvedValue([])
			mockVideoPerformanceRepository.find.mockResolvedValue([
				buildMockVideoPerformance({
					videoId,
					teamId: 'team-1',
					athleteId: 'athlete-1',
					event: TrackEvent.M100,
					result: buildTimeResult({ value: 11.42 }),
					createdAt: meetDate
				})
			])
			mockVideoRepository.findByIds.mockResolvedValue([
				buildMockVideo({
					id: videoId,
					sessionId: meetSessionId,
					teamId: 'team-1',
					athleteId: null,
					event: TrackEvent.M100,
					result: null,
					createdAt: meetDate
				})
			])

			const result = await videoService.getAthleteProgression({
				athleteId: 'athlete-1',
				event: TrackEvent.M100,
				teamId: 'team-1'
			})

			expect(mockVideoRepository.findByIds).toHaveBeenCalledWith({
				ids: [videoId],
				teamId: 'team-1'
			})
			expect(mockVideoRepository.find).toHaveBeenCalledWith({
				filter: {
					athleteId: 'athlete-1',
					event: TrackEvent.M100,
					teamId: 'team-1'
				},
				includeCommentCounts: false
			})
			expect(result.points).toHaveLength(1)
			expect(result.points[0]?.bestResult).toBe(11.42)
			expect(result.stats.pr).toBe(11.42)
			expect(result.stats.totalAttempts).toBe(1)
		})
	})

	// ------------------------------------------------------------------
	describe('createRunningVideo — practice sessions', () => {
		it('allows athletes without times in practice sessions', async () => {
			mockTrainingSessionRepository.findOne.mockResolvedValue(
				buildMockTrainingSession({
					id: 'practice-session-1',
					type: SessionType.Practice
				})
			)
			const newVideo = buildMockVideo({
				sessionId: 'practice-session-1',
				event: TrackEvent.SixtyMeter
			})
			mockVideoRepository.create.mockResolvedValue(newVideo)
			mockVideoPerformanceRepository.createMany.mockResolvedValue([
				{
					id: 'perf-1',
					videoId: newVideo.id,
					teamId: 'team-1',
					athleteId: 'athlete-1',
					event: TrackEvent.M60,
					result: null,
					isPR: false,
					createdAt: new Date(),
					updatedAt: new Date()
				}
			])

			const result = await videoService.createRunningVideo({
				data: {
					sessionId: 'practice-session-1',
					teamId: 'team-1',
					event: TrackEvent.M60,
					videoUrl: 'https://example.com/video.mp4',
					orientation: 'landscape',
					performances: [{ athleteId: 'athlete-1', result: null }]
				}
			})

			expect(result.performances).toHaveLength(1)
			expect(mockVideoPerformanceRepository.createMany).toHaveBeenCalledWith({
				performances: [
					expect.objectContaining({
						athleteId: 'athlete-1',
						result: null,
						isPR: false
					})
				]
			})
		})
	})

	describe('updateVideoPerformances — practice sessions', () => {
		it('allows clearing performances in practice sessions', async () => {
			const existing = buildMockVideo({
				id: 'video-1',
				sessionId: 'practice-session-1',
				teamId: 'team-1'
			})
			mockVideoRepository.findOne.mockResolvedValue(existing)
			mockTrainingSessionRepository.findOne.mockResolvedValue(
				buildMockTrainingSession({
					id: 'practice-session-1',
					type: SessionType.Practice
				})
			)
			mockVideoRepository.update.mockResolvedValue({
				...existing,
				event: null,
				athleteId: null,
				result: null,
				isPR: false
			})

			const result = await videoService.updateVideoPerformances({
				videoId: 'video-1',
				teamId: 'team-1',
				event: null,
				performances: []
			})

			expect(result.performances).toEqual([])
			expect(mockVideoPerformanceRepository.deleteByVideoId).toHaveBeenCalledWith({
				videoId: 'video-1',
				teamId: 'team-1'
			})
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
