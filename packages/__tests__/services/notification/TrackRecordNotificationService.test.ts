import { mock } from 'jest-mock-extended'
import { container } from 'tsyringe'

import { NotificationType } from '@packages/enums/notifications'
import { TrackRecordNotificationRepository } from '@packages/repositories/notification/TrackRecordNotificationRepository'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { TrackRecordNotificationService } from '@packages/services/notification/TrackRecordNotificationService'
import { PushNotificationService } from '@packages/services/push/PushNotificationService'

import { buildMockTrackRecordNotification } from '@builders/trackRecordNotification'

describe('TrackRecordNotificationService', () => {
	let service: TrackRecordNotificationService
	let mockRepository: jest.Mocked<TrackRecordNotificationRepository>
	let mockPushNotificationService: jest.Mocked<PushNotificationService>
	let mockReportingService: jest.Mocked<ReportingService>

	const teamId = 'team-1'
	const userId = 'user-1'

	beforeEach(() => {
		mockRepository = mock<TrackRecordNotificationRepository>()
		mockPushNotificationService = mock<PushNotificationService>()
		mockReportingService = mock<ReportingService>()
		mockReportingService.withTrace.mockImplementation(({ fn }) => fn())
		mockPushNotificationService.sendToUser.mockResolvedValue(undefined)

		container.registerInstance(
			TrackRecordNotificationRepository,
			mockRepository
		)
		container.registerInstance(
			PushNotificationService,
			mockPushNotificationService
		)
		container.registerInstance(ReportingService, mockReportingService)

		service = container.resolve(TrackRecordNotificationService)
	})

	afterEach(() => {
		container.clearInstances()
	})

	describe('createNotification', () => {
		it('creates a notification and sends a push', async () => {
			const data = {
				userId,
				teamId,
				type: NotificationType.Comment,
				text: 'Coach left a note on your video.',
				payload: { videoId: 'video-1' }
			}
			const created = buildMockTrackRecordNotification(data)

			mockRepository.create.mockResolvedValue(created)

			const result = await service.createNotification({ data })

			expect(result).toEqual(created)
			expect(mockRepository.create).toHaveBeenCalledWith({ data })
			expect(mockPushNotificationService.sendToUser).toHaveBeenCalledWith({
				userId,
				title: 'TrackRecord',
				body: created.text,
				data: {
					notificationId: created.id,
					type: created.type,
					teamId: created.teamId,
					videoId: 'video-1'
				}
			})
		})
	})

	describe('findNotifications', () => {
		it('returns notifications for user and team', async () => {
			const notifications = [
				buildMockTrackRecordNotification({ userId, teamId }),
				buildMockTrackRecordNotification({ userId, teamId })
			]
			mockRepository.find.mockResolvedValue(notifications)

			const result = await service.findNotifications({
				filter: { userId, teamId },
				limit: 20
			})

			expect(result).toEqual(notifications)
			expect(mockRepository.find).toHaveBeenCalledWith({
				filter: { userId, teamId },
				limit: 20
			})
		})
	})

	describe('markRead', () => {
		it('marks specific notifications as read', async () => {
			const ids = ['notif-1', 'notif-2']
			mockRepository.markRead.mockResolvedValue(true)

			const result = await service.markRead({ ids, userId, teamId })

			expect(result).toBe(true)
			expect(mockRepository.markRead).toHaveBeenCalledWith({
				ids,
				userId,
				teamId
			})
		})
	})

	describe('markAllRead', () => {
		it('marks all notifications as read for user and team', async () => {
			mockRepository.markAllRead.mockResolvedValue(true)

			const result = await service.markAllRead({ userId, teamId })

			expect(result).toBe(true)
			expect(mockRepository.markAllRead).toHaveBeenCalledWith({
				userId,
				teamId
			})
		})
	})
})
