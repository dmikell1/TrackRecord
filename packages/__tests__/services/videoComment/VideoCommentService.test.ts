import { mock } from 'jest-mock-extended'
import { container } from 'tsyringe'

import { NotificationType } from '@packages/enums/notifications'
import { AthleteRepository } from '@packages/repositories/athlete/AthleteRepository'
import { TeamRepository } from '@packages/repositories/team/TeamRepository'
import { TrackRecordNotificationRepository } from '@packages/repositories/notification/TrackRecordNotificationRepository'
import { VideoCommentRepository } from '@packages/repositories/videoComment/VideoCommentRepository'
import { VideoRepository } from '@packages/repositories/video/VideoRepository'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { VideoCommentService } from '@packages/services/videoComment/VideoCommentService'

import { buildMockAthlete } from '@builders/athlete'
import { buildMockVideo } from '@builders/video'

describe('VideoCommentService', () => {
	let service: VideoCommentService
	let mockVideoCommentRepository: jest.Mocked<VideoCommentRepository>
	let mockVideoRepository: jest.Mocked<VideoRepository>
	let mockAthleteRepository: jest.Mocked<AthleteRepository>
	let mockTeamRepository: jest.Mocked<TeamRepository>
	let mockNotificationRepository: jest.Mocked<TrackRecordNotificationRepository>
	let mockReportingService: jest.Mocked<ReportingService>

	const teamId = 'team-1'
	const coachUserId = 'coach-user-1'
	const athleteUserId = 'athlete-user-1'

	beforeEach(() => {
		mockVideoCommentRepository = mock<VideoCommentRepository>()
		mockVideoRepository = mock<VideoRepository>()
		mockAthleteRepository = mock<AthleteRepository>()
		mockTeamRepository = mock<TeamRepository>()
		mockNotificationRepository = mock<TrackRecordNotificationRepository>()
		mockReportingService = mock<ReportingService>()
		mockReportingService.withTrace.mockImplementation(({ fn }) => fn())

		container.registerInstance(VideoCommentRepository, mockVideoCommentRepository)
		container.registerInstance(VideoRepository, mockVideoRepository)
		container.registerInstance(AthleteRepository, mockAthleteRepository)
		container.registerInstance(TeamRepository, mockTeamRepository)
		container.registerInstance(
			TrackRecordNotificationRepository,
			mockNotificationRepository
		)
		container.registerInstance(ReportingService, mockReportingService)

		service = container.resolve(VideoCommentService)
	})

	afterEach(() => {
		container.clearInstances()
	})

	describe('createVideoComment', () => {
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
			mockNotificationRepository.create.mockResolvedValue({
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

			expect(mockNotificationRepository.create).toHaveBeenCalledWith({
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
			mockNotificationRepository.create.mockResolvedValue({
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

			expect(mockNotificationRepository.create).toHaveBeenCalledWith({
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

			expect(mockNotificationRepository.create).not.toHaveBeenCalled()
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
