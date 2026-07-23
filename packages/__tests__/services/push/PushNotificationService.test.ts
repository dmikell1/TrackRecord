import { mock } from 'jest-mock-extended'
import { container } from 'tsyringe'

import { PushPlatform } from '@packages/enums/push'
import { PushDeviceTokenRepository } from '@packages/repositories/push/PushDeviceTokenRepository'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { PushNotificationService } from '@packages/services/push/PushNotificationService'

import { buildMockPushDeviceToken } from '@builders/pushDeviceToken'

describe('PushNotificationService', () => {
	let service: PushNotificationService
	let mockRepository: jest.Mocked<PushDeviceTokenRepository>
	let mockReportingService: jest.Mocked<ReportingService>
	let fetchMock: jest.Mock

	const userId = 'user-1'

	beforeEach(() => {
		mockRepository = mock<PushDeviceTokenRepository>()
		mockReportingService = mock<ReportingService>()
		mockReportingService.withTrace.mockImplementation(({ fn }) => fn())

		container.registerInstance(PushDeviceTokenRepository, mockRepository)
		container.registerInstance(ReportingService, mockReportingService)

		fetchMock = jest.fn()
		global.fetch = fetchMock as unknown as typeof fetch

		service = container.resolve(PushNotificationService)
	})

	afterEach(() => {
		container.clearInstances()
		jest.restoreAllMocks()
	})

	describe('registerToken', () => {
		it('upserts a trimmed token for the user', async () => {
			const token = buildMockPushDeviceToken({
				userId,
				token: 'ExponentPushToken[abc]',
				platform: PushPlatform.Ios
			})
			mockRepository.upsertToken.mockResolvedValue(token)

			const result = await service.registerToken({
				userId,
				token: '  ExponentPushToken[abc]  ',
				platform: PushPlatform.Ios
			})

			expect(result).toEqual(token)
			expect(mockRepository.upsertToken).toHaveBeenCalledWith({
				data: {
					userId,
					token: 'ExponentPushToken[abc]',
					platform: PushPlatform.Ios
				}
			})
		})

		it('throws when token is empty', async () => {
			await expect(
				service.registerToken({
					userId,
					token: '   ',
					platform: PushPlatform.Android
				})
			).rejects.toThrow('Push token is required')
		})
	})

	describe('sendToUser', () => {
		it('no-ops when the user has no registered devices', async () => {
			mockRepository.findByUserId.mockResolvedValue([])

			await service.sendToUser({
				userId,
				title: 'TrackRecord',
				body: 'Hello'
			})

			expect(fetchMock).not.toHaveBeenCalled()
		})

		it('sends expo push messages and removes invalid tokens', async () => {
			const valid = buildMockPushDeviceToken({
				userId,
				token: 'ExponentPushToken[valid]'
			})
			const invalid = buildMockPushDeviceToken({
				userId,
				token: 'ExponentPushToken[invalid]'
			})
			mockRepository.findByUserId.mockResolvedValue([valid, invalid])
			mockRepository.deleteByTokens.mockResolvedValue(true)
			fetchMock.mockResolvedValue({
				ok: true,
				json: async () => ({
					data: [
						{ status: 'ok', id: 'ticket-1' },
						{
							status: 'error',
							message: 'Device not registered',
							details: { error: 'DeviceNotRegistered' }
						}
					]
				})
			})

			await service.sendToUser({
				userId,
				title: 'TrackRecord',
				body: 'Jordan joined your team.',
				data: {
					type: 'Join',
					athleteId: 'athlete-1',
					teamId: 'team-1'
				}
			})

			expect(fetchMock).toHaveBeenCalledWith(
				'https://exp.host/--/api/v2/push/send',
				expect.objectContaining({
					method: 'POST'
				})
			)
			expect(mockRepository.deleteByTokens).toHaveBeenCalledWith({
				tokens: ['ExponentPushToken[invalid]']
			})
		})
	})
})
