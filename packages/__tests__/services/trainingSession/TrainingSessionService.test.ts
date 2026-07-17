import { mock } from 'jest-mock-extended'
import { container } from 'tsyringe'

import { SessionType } from '@packages/enums/trackRecord'
import { TrainingSessionRepository } from '@packages/repositories/trainingSession/TrainingSessionRepository'
import { EntitlementService } from '@packages/services/billing/EntitlementService'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { TrainingSessionService } from '@packages/services/trainingSession/TrainingSessionService'
import { VideoService } from '@packages/services/video/VideoService'

import { buildMockTrainingSession } from '@builders/trainingSession'

describe('TrainingSessionService', () => {
	let service: TrainingSessionService
	let mockRepository: jest.Mocked<TrainingSessionRepository>
	let mockVideoService: jest.Mocked<VideoService>
	let mockEntitlementService: jest.Mocked<EntitlementService>
	let mockReportingService: jest.Mocked<ReportingService>

	const teamId = 'team-1'
	const sessionId = 'session-1'

	beforeEach(() => {
		mockRepository = mock<TrainingSessionRepository>()
		mockVideoService = mock<VideoService>()
		mockEntitlementService = mock<EntitlementService>()
		mockReportingService = mock<ReportingService>()
		mockReportingService.withTrace.mockImplementation(({ fn }) => fn())
		mockEntitlementService.assertCanWrite.mockResolvedValue(undefined)

		container.registerInstance(TrainingSessionRepository, mockRepository)
		container.registerInstance(VideoService, mockVideoService)
		container.registerInstance(EntitlementService, mockEntitlementService)
		container.registerInstance(ReportingService, mockReportingService)

		service = container.resolve(TrainingSessionService)
	})

	afterEach(() => {
		container.clearInstances()
	})

	describe('createTrainingSession', () => {
		it('creates a session through the repository', async () => {
			const data = {
				teamId,
				companyId: 'company-1',
				name: 'District Meet',
				date: new Date('2026-03-01'),
				type: SessionType.Meet,
				createdByUserId: 'user-1'
			}
			const created = buildMockTrainingSession(data)

			mockRepository.create.mockResolvedValue(created)

			const result = await service.createTrainingSession({ data })

			expect(result).toEqual(created)
			expect(mockRepository.create).toHaveBeenCalledWith({ data })
		})
	})

	describe('findTrainingSession', () => {
		it('returns session when found', async () => {
			const session = buildMockTrainingSession({ id: sessionId, teamId })
			mockRepository.findOne.mockResolvedValue(session)

			const result = await service.findTrainingSession({
				filter: { id: sessionId, teamId }
			})

			expect(result).toEqual(session)
			expect(mockRepository.findOne).toHaveBeenCalledWith({
				filter: { id: sessionId, teamId },
				loadVideos: undefined
			})
		})

		it('returns null when session is not found', async () => {
			mockRepository.findOne.mockResolvedValue(null)

			const result = await service.findTrainingSession({
				filter: { id: sessionId, teamId }
			})

			expect(result).toBeNull()
		})
	})

	describe('findTrainingSessionOrFail', () => {
		it('returns session when found', async () => {
			const session = buildMockTrainingSession({ id: sessionId, teamId })
			mockRepository.findOne.mockResolvedValue(session)

			const result = await service.findTrainingSessionOrFail({
				filter: { id: sessionId, teamId }
			})

			expect(result).toEqual(session)
		})

		it('throws when session is not found', async () => {
			mockRepository.findOne.mockResolvedValue(null)

			await expect(
				service.findTrainingSessionOrFail({
					filter: { id: sessionId, teamId }
				})
			).rejects.toThrow('No training session found')

			expect(mockReportingService.reportError).toHaveBeenCalled()
		})
	})

	describe('findTrainingSessions', () => {
		it('returns sessions filtered by team', async () => {
			const sessions = [
				buildMockTrainingSession({ teamId }),
				buildMockTrainingSession({ teamId })
			]
			mockRepository.find.mockResolvedValue(sessions)

			const result = await service.findTrainingSessions({
				filter: { teamId }
			})

			expect(result).toEqual(sessions)
			expect(mockRepository.find).toHaveBeenCalledWith({
				filter: { teamId }
			})
		})
	})

	describe('updateTrainingSession', () => {
		it('updates session fields', async () => {
			const updated = buildMockTrainingSession({
				id: sessionId,
				teamId,
				name: 'Updated Name'
			})
			mockRepository.update.mockResolvedValue(updated)

			const result = await service.updateTrainingSession({
				filter: { id: sessionId, teamId },
				data: { name: 'Updated Name' }
			})

			expect(result).toEqual(updated)
			expect(mockRepository.update).toHaveBeenCalledWith({
				filter: { id: sessionId, teamId },
				data: { name: 'Updated Name' }
			})
		})
	})

	describe('deleteTrainingSession', () => {
		it('deletes session by filter', async () => {
			mockRepository.delete.mockResolvedValue(true)

			const result = await service.deleteTrainingSession({
				filter: { id: sessionId, teamId }
			})

			expect(result).toBe(true)
			expect(mockRepository.delete).toHaveBeenCalledWith({
				filter: { id: sessionId, teamId }
			})
		})
	})
})
