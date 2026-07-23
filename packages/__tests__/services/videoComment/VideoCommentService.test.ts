import { mock } from 'jest-mock-extended'
import { container } from 'tsyringe'

import { NotificationType } from '@packages/enums/notifications'
import { ParentalConsentStatus } from '@packages/enums/trackRecord'
import { AthleteRepository } from '@packages/repositories/athlete/AthleteRepository'
import { TeamRepository } from '@packages/repositories/team/TeamRepository'
import { TrackRecordNotificationService } from '@packages/services/notification/TrackRecordNotificationService'
import { VideoCommentRepository } from '@packages/repositories/videoComment/VideoCommentRepository'
import { VideoPerformanceRepository } from '@packages/repositories/videoPerformance/VideoPerformanceRepository'
import { VideoRepository } from '@packages/repositories/video/VideoRepository'
import { EntitlementService } from '@packages/services/billing/EntitlementService'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { VideoCommentService } from '@packages/services/videoComment/VideoCommentService'

import { buildMockAthlete } from '@builders/athlete'
import { buildMockTeam } from '@builders/team'
import { buildMockVideo } from '@builders/video'

const flushBackgroundWork = async (): Promise<void> => {
	await new Promise<void>(resolve => {
		setImmediate(resolve)
	})
	await new Promise<void>(resolve => {
		setImmediate(resolve)
	})
	await new Promise<void>(resolve => {
		setImmediate(resolve)
	})
}

describe('VideoCommentService', () => {
	let service: VideoCommentService
	let mockVideoCommentRepository: jest.Mocked<VideoCommentRepository>
	let mockVideoRepository: jest.Mocked<VideoRepository>
	let mockVideoPerformanceRepository: jest.Mocked<VideoPerformanceRepository>
	let mockAthleteRepository: jest.Mocked<AthleteRepository>
	let mockTeamRepository: jest.Mocked<TeamRepository>
	let mockNotificationService: jest.Mocked<TrackRecordNotificationService>
	let mockEntitlementService: jest.Mocked<EntitlementService>
	let mockReportingService: jest.Mocked<ReportingService>

	const teamId = 'team-1'
	const coachUserId = 'coach-user-1'
	const athleteUserId = 'athlete-user-1'

	beforeEach(() => {
		mockVideoCommentRepository = mock<VideoCommentRepository>()
		mockVideoRepository = mock<VideoRepository>()
		mockVideoPerformanceRepository = mock<VideoPerformanceRepository>()
		mockAthleteRepository = mock<AthleteRepository>()
		mockTeamRepository = mock<TeamRepository>()
		mockNotificationService = mock<TrackRecordNotificationService>()
		mockEntitlementService = mock<EntitlementService>()
		mockReportingService = mock<ReportingService>()
		mockReportingService.withTrace.mockImplementation(({ fn }) => fn())
		mockEntitlementService.assertCanWrite.mockResolvedValue(undefined)
		mockTeamRepository.findOne.mockResolvedValue(
			buildMockTeam({ id: teamId, companyId: 'company-1' })
		)

		container.registerInstance(VideoCommentRepository, mockVideoCommentRepository)
		container.registerInstance(VideoRepository, mockVideoRepository)
		container.registerInstance(
			VideoPerformanceRepository,
			mockVideoPerformanceRepository
		)
		container.registerInstance(AthleteRepository, mockAthleteRepository)
		container.registerInstance(TeamRepository, mockTeamRepository)
		container.registerInstance(
			TrackRecordNotificationService,
			mockNotificationService
		)
		container.registerInstance(EntitlementService, mockEntitlementService)
		container.registerInstance(ReportingService, mockReportingService)

		service = container.resolve(VideoCommentService)
	})

	afterEach(() => {
		container.clearInstances()
	})

	describe('createVideoComment', () => {
		it('blocks comments when athlete parental consent is pending', async () => {
			const athlete = buildMockAthlete({
				teamId,
				userId: athleteUserId,
				parentalConsentStatus: ParentalConsentStatus.Pending
			})
			const video = buildMockVideo({
				teamId,
				athleteId: athlete.id,
				event: 'HighJump'
			})

			mockVideoRepository.findOne.mockResolvedValue(video)
			mockAthleteRepository.findOne.mockResolvedValue(athlete)

			await expect(
				service.createVideoComment({
					teamId,
					data: {
						videoId: video.id,
						userId: athleteUserId,
						text: 'Hello'
					}
				})
			).rejects.toThrow('Parental consent is required before commenting')

			expect(mockVideoCommentRepository.create).not.toHaveBeenCalled()
		})

		it('notifies coach when athlete comments on their video', async () => {
			const athlete = buildMockAthlete({
				teamId,
				userId: athleteUserId,
				firstName: 'Jordan',
				lastName: 'Williams'
			})
			const video = buildMockVideo({
				teamId,
				athleteId: athlete.id,
				event: 'HighJump'
			})
			const comment = {
				id: 'comment-1',
				videoId: video.id,
				userId: athleteUserId,
				text: 'Thanks coach!',
				stampSeconds: null,
				createdAt: new Date(),
				updatedAt: new Date()
			}

			mockVideoRepository.findOne.mockResolvedValue(video)
			mockVideoCommentRepository.create.mockResolvedValue(comment)
			mockAthleteRepository.findOne.mockResolvedValue(athlete)
			mockTeamRepository.findOne.mockResolvedValue({
				id: teamId,
				name: 'Track Team',
				ownerId: coachUserId,
				companyId: 'company-1',
				settings: {},
				createdAt: new Date(),
				updatedAt: new Date()
			})
			mockNotificationService.createNotification.mockResolvedValue({
				id: 'notif-1',
				userId: coachUserId,
				teamId,
				type: NotificationType.Comment,
				text: '',
				payload: null,
				read: false,
				createdAt: new Date()
			})

			await service.createVideoComment({
				data: {
					videoId: video.id,
					userId: athleteUserId,
					text: 'Thanks coach!'
				},
				teamId
			})
			await flushBackgroundWork()

			expect(mockNotificationService.createNotification).toHaveBeenCalledWith({
				data: expect.objectContaining({
					userId: coachUserId,
					teamId,
					type: NotificationType.Comment,
					text: 'Jordan Williams commented on their High Jump video.',
					payload: expect.objectContaining({
						videoId: video.id,
						commentId: comment.id,
						athleteId: athlete.id,
						event: video.event,
						athleteName: 'Jordan Williams'
					})
				})
			})
		})

		it('notifies athlete when coach comments on their video', async () => {
			const athlete = buildMockAthlete({
				teamId,
				userId: athleteUserId,
				firstName: 'Maya',
				lastName: 'Chen'
			})
			const video = buildMockVideo({
				teamId,
				athleteId: athlete.id,
				event: 'LongJump'
			})
			const comment = {
				id: 'comment-2',
				videoId: video.id,
				userId: coachUserId,
				text: 'Drive the knee higher.',
				stampSeconds: 2,
				createdAt: new Date(),
				updatedAt: new Date()
			}

			mockVideoRepository.findOne.mockResolvedValue(video)
			mockVideoCommentRepository.create.mockResolvedValue(comment)
			mockAthleteRepository.findOne.mockResolvedValue(athlete)
			mockTeamRepository.findOne.mockResolvedValue({
				id: teamId,
				name: 'Track Team',
				ownerId: coachUserId,
				companyId: 'company-1',
				settings: {},
				createdAt: new Date(),
				updatedAt: new Date()
			})
			mockNotificationService.createNotification.mockResolvedValue({
				id: 'notif-2',
				userId: athleteUserId,
				teamId,
				type: NotificationType.Comment,
				text: '',
				payload: null,
				read: false,
				createdAt: new Date()
			})

			await service.createVideoComment({
				data: {
					videoId: video.id,
					userId: coachUserId,
					text: 'Drive the knee higher.',
					stampSeconds: 2
				},
				teamId
			})
			await flushBackgroundWork()

			expect(mockNotificationService.createNotification).toHaveBeenCalledWith({
				data: expect.objectContaining({
					userId: athleteUserId,
					teamId,
					type: NotificationType.Comment,
					text: 'Coach left a note on your Long Jump video.',
					payload: expect.objectContaining({
						videoId: video.id,
						commentId: comment.id,
						athleteId: athlete.id,
						event: video.event,
						athleteName: 'Maya Chen'
					})
				})
			})
		})

		it('notifies athlete on performance-linked video when coach comments', async () => {
			const athlete = buildMockAthlete({
				teamId,
				userId: athleteUserId,
				firstName: 'Try',
				lastName: 'Me'
			})
			const video = buildMockVideo({
				teamId,
				athleteId: null,
				event: '100m'
			})
			const comment = {
				id: 'comment-4',
				videoId: video.id,
				userId: coachUserId,
				text: 'Strong finish.',
				stampSeconds: null,
				createdAt: new Date(),
				updatedAt: new Date()
			}

			mockVideoRepository.findOne.mockResolvedValue(video)
			mockVideoCommentRepository.create.mockResolvedValue(comment)
			mockVideoPerformanceRepository.find.mockResolvedValue([
				{
					id: 'perf-1',
					videoId: video.id,
					teamId,
					athleteId: athlete.id,
					event: '100m',
					result: null,
					isPR: false,
					createdAt: new Date(),
					updatedAt: new Date()
				}
			])
			mockAthleteRepository.findOne.mockResolvedValue(athlete)
			mockTeamRepository.findOne.mockResolvedValue({
				id: teamId,
				name: 'Track Team',
				ownerId: coachUserId,
				companyId: 'company-1',
				settings: {},
				createdAt: new Date(),
				updatedAt: new Date()
			})
			mockNotificationService.createNotification.mockResolvedValue({
				id: 'notif-4',
				userId: athleteUserId,
				teamId,
				type: NotificationType.Comment,
				text: '',
				payload: null,
				read: false,
				createdAt: new Date()
			})

			await service.createVideoComment({
				data: {
					videoId: video.id,
					userId: coachUserId,
					text: 'Strong finish.'
				},
				teamId
			})
			await flushBackgroundWork()

			expect(mockVideoPerformanceRepository.find).toHaveBeenCalledWith({
				filter: { videoId: video.id, teamId }
			})
			expect(mockNotificationService.createNotification).toHaveBeenCalledWith({
				data: expect.objectContaining({
					userId: athleteUserId,
					text: 'Coach left a note on your 100m video.',
					payload: expect.objectContaining({
						athleteId: athlete.id,
						athleteName: 'Try Me'
					})
				})
			})
		})

		it('does not notify athlete when athlete has no linked user account', async () => {
			const athlete = buildMockAthlete({ teamId, userId: null })
			const video = buildMockVideo({ teamId, athleteId: athlete.id })

			mockVideoRepository.findOne.mockResolvedValue(video)
			mockVideoCommentRepository.create.mockResolvedValue({
				id: 'comment-3',
				videoId: video.id,
				userId: coachUserId,
				text: 'Nice form.',
				stampSeconds: null,
				createdAt: new Date(),
				updatedAt: new Date()
			})
			mockAthleteRepository.findOne.mockResolvedValue(athlete)
			mockTeamRepository.findOne.mockResolvedValue({
				id: teamId,
				name: 'Track Team',
				ownerId: coachUserId,
				companyId: 'company-1',
				settings: {},
				createdAt: new Date(),
				updatedAt: new Date()
			})

			await service.createVideoComment({
				data: {
					videoId: video.id,
					userId: coachUserId,
					text: 'Nice form.'
				},
				teamId
			})
			await flushBackgroundWork()

			expect(mockNotificationService.createNotification).not.toHaveBeenCalled()
		})

		it('throws when video does not belong to team', async () => {
			mockVideoRepository.findOne.mockResolvedValue(null)

			await expect(
				service.createVideoComment({
					data: {
						videoId: 'video-1',
						userId: coachUserId,
						text: 'Hello'
					},
					teamId
				})
			).rejects.toThrow('Video not found or does not belong to this team')

			expect(mockVideoCommentRepository.create).not.toHaveBeenCalled()
		})
	})
})
