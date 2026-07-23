import { addHours } from 'date-fns'
import { mock } from 'jest-mock-extended'
import { container } from 'tsyringe'

import {
	COACH_LIFECYCLE_ACTIVATION_DELAY_HOURS,
	CoachLifecycleEmailJobStatus,
	CoachLifecycleEmailStep,
	SubscriptionPlan,
	SubscriptionStatus
} from '@packages/enums'
import { AthleteRepository } from '@packages/repositories/athlete/AthleteRepository'
import { CompanyRepository } from '@packages/repositories/company/CompanyRepository'
import { CoachLifecycleEmailJobRepository } from '@packages/repositories/email/CoachLifecycleEmailJobRepository'
import { TeamRepository } from '@packages/repositories/team/TeamRepository'
import { TrainingSessionRepository } from '@packages/repositories/trainingSession/TrainingSessionRepository'
import { UserRepository } from '@packages/repositories/user/UserRepository'
import { VideoRepository } from '@packages/repositories/video/VideoRepository'
import { CoachLifecycleEmailService } from '@packages/services/email/CoachLifecycleEmailService'
import { ReportingService } from '@packages/services/logging/ReportingService'
import type { CoachLifecycleEmailJobInterface } from '@packages/types/coachLifecycleEmailJob'

const mockScheduleSendEmail = jest.fn().mockResolvedValue(undefined)

jest.mock('@packages/services/queue/QueueService', () => ({
	__esModule: true,
	default: {
		scheduleSendEmail: (...args: unknown[]) => mockScheduleSendEmail(...args)
	}
}))

describe('CoachLifecycleEmailService', () => {
	let service: CoachLifecycleEmailService
	let mockJobRepository: jest.Mocked<CoachLifecycleEmailJobRepository>
	let mockAthleteRepository: jest.Mocked<AthleteRepository>
	let mockTrainingSessionRepository: jest.Mocked<TrainingSessionRepository>
	let mockVideoRepository: jest.Mocked<VideoRepository>
	let mockCompanyRepository: jest.Mocked<CompanyRepository>
	let mockTeamRepository: jest.Mocked<TeamRepository>
	let mockUserRepository: jest.Mocked<UserRepository>
	let mockReportingService: jest.Mocked<ReportingService>

	const buildJob = (
		overrides: Partial<CoachLifecycleEmailJobInterface> = {}
	): CoachLifecycleEmailJobInterface => ({
		id: 'job-1',
		userId: 'user-1',
		companyId: 'company-1',
		teamId: 'team-1',
		step: CoachLifecycleEmailStep.ActivationNudge,
		status: CoachLifecycleEmailJobStatus.Pending,
		scheduledFor: new Date(),
		sentAt: null,
		skippedAt: null,
		skipReason: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides
	})

	beforeEach(() => {
		mockJobRepository = mock<CoachLifecycleEmailJobRepository>()
		mockAthleteRepository = mock<AthleteRepository>()
		mockTrainingSessionRepository = mock<TrainingSessionRepository>()
		mockVideoRepository = mock<VideoRepository>()
		mockCompanyRepository = mock<CompanyRepository>()
		mockTeamRepository = mock<TeamRepository>()
		mockUserRepository = mock<UserRepository>()
		mockReportingService = mock<ReportingService>()

		container.registerInstance(
			CoachLifecycleEmailJobRepository,
			mockJobRepository
		)
		container.registerInstance(AthleteRepository, mockAthleteRepository)
		container.registerInstance(
			TrainingSessionRepository,
			mockTrainingSessionRepository
		)
		container.registerInstance(VideoRepository, mockVideoRepository)
		container.registerInstance(CompanyRepository, mockCompanyRepository)
		container.registerInstance(TeamRepository, mockTeamRepository)
		container.registerInstance(UserRepository, mockUserRepository)
		container.registerInstance(ReportingService, mockReportingService)

		service = container.resolve(CoachLifecycleEmailService)
		mockScheduleSendEmail.mockClear()
	})

	afterEach(() => {
		container.clearInstances()
		jest.clearAllMocks()
	})

	describe('enrollOnCoachSignup', () => {
		it('sends welcome and schedules activation + feature jobs', async () => {
			const welcomeJob = buildJob({
				id: 'welcome-job',
				step: CoachLifecycleEmailStep.Welcome
			})
			mockJobRepository.upsertPendingJob
				.mockResolvedValueOnce(welcomeJob)
				.mockResolvedValue(buildJob())
			mockJobRepository.markSent.mockResolvedValue(welcomeJob)

			await service.enrollOnCoachSignup({
				user: {
					id: 'user-1',
					email: 'coach@example.com',
					firstName: 'Alex'
				},
				companyId: 'company-1',
				teamId: 'team-1'
			})

			expect(mockScheduleSendEmail).toHaveBeenCalledWith(
				expect.objectContaining({
					to: 'coach@example.com',
					subject: 'Welcome to TrackRecord'
				})
			)
			expect(mockJobRepository.upsertPendingJob).toHaveBeenCalledTimes(3)
			expect(mockJobRepository.upsertPendingJob).toHaveBeenCalledWith({
				data: expect.objectContaining({
					step: CoachLifecycleEmailStep.ActivationNudge,
					scheduledFor: expect.any(Date)
				})
			})

			const activationCall =
				mockJobRepository.upsertPendingJob.mock.calls.find(
					call =>
						call[0].data.step ===
						CoachLifecycleEmailStep.ActivationNudge
				)
			const scheduledFor = activationCall?.[0].data.scheduledFor as Date
			const expectedMin = addHours(
				new Date(Date.now() - 60_000),
				COACH_LIFECYCLE_ACTIVATION_DELAY_HOURS
			)
			expect(scheduledFor.getTime()).toBeGreaterThanOrEqual(
				expectedMin.getTime()
			)
		})
	})

	describe('processDueJobs', () => {
		it('skips activation nudge when athlete and session exist', async () => {
			mockJobRepository.findDuePending.mockResolvedValue([
				buildJob({ step: CoachLifecycleEmailStep.ActivationNudge })
			])
			mockUserRepository.findOne.mockResolvedValue({
				id: 'user-1',
				email: 'coach@example.com',
				firstName: 'Alex',
				lastName: 'Coach',
				avatar: '',
				status: 'active',
				createdAt: new Date(),
				updatedAt: new Date()
			} as never)
			mockAthleteRepository.count.mockResolvedValue(1)
			mockTrainingSessionRepository.count.mockResolvedValue(1)

			await service.processDueJobs()

			expect(mockScheduleSendEmail).not.toHaveBeenCalled()
			expect(mockJobRepository.markSkipped).toHaveBeenCalledWith({
				id: 'job-1',
				reason: 'Already added athlete and logged a session'
			})
		})

		it('sends activation nudge when not activated', async () => {
			mockJobRepository.findDuePending.mockResolvedValue([
				buildJob({ step: CoachLifecycleEmailStep.ActivationNudge })
			])
			mockUserRepository.findOne.mockResolvedValue({
				id: 'user-1',
				email: 'coach@example.com',
				firstName: 'Alex',
				lastName: 'Coach',
				avatar: '',
				status: 'active',
				createdAt: new Date(),
				updatedAt: new Date()
			} as never)
			mockAthleteRepository.count.mockResolvedValue(0)
			mockJobRepository.markSent.mockResolvedValue(buildJob())

			await service.processDueJobs()

			expect(mockScheduleSendEmail).toHaveBeenCalledWith(
				expect.objectContaining({
					to: 'coach@example.com',
					subject: 'Two minutes to your first logged session'
				})
			)
			expect(mockJobRepository.markSent).toHaveBeenCalledWith({
				id: 'job-1'
			})
		})

		it('skips trial ending when company is no longer on trial', async () => {
			mockJobRepository.findDuePending.mockResolvedValue([
				buildJob({ step: CoachLifecycleEmailStep.TrialEndingSoon })
			])
			mockUserRepository.findOne.mockResolvedValue({
				id: 'user-1',
				email: 'coach@example.com',
				firstName: 'Alex'
			} as never)
			mockCompanyRepository.findOne.mockResolvedValue({
				id: 'company-1',
				subscriptionStatus: SubscriptionStatus.Active,
				subscriptionPlan: SubscriptionPlan.Pro
			} as never)

			await service.processDueJobs()

			expect(mockScheduleSendEmail).not.toHaveBeenCalled()
			expect(mockJobRepository.markSkipped).toHaveBeenCalledWith({
				id: 'job-1',
				reason: 'No longer on trial'
			})
		})
	})
})
