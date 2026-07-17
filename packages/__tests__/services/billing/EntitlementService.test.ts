import { addDays, subDays } from 'date-fns'
import { mock } from 'jest-mock-extended'
import { container } from 'tsyringe'

import { SubscriptionPlan, SubscriptionStatus, UserRoles } from '@packages/enums'
import { AthleteRepository } from '@packages/repositories/athlete/AthleteRepository'
import { CompanyRepository } from '@packages/repositories/company/CompanyRepository'
import { RecorderInviteRepository } from '@packages/repositories/recorderInvite/RecorderInviteRepository'
import { UserRoleRepository } from '@packages/repositories/userRole/UserRoleRepository'
import {
	ATHLETE_LIMIT_ERROR,
	EntitlementService,
	PLAN_CHANGE_BLOCKED_ERROR_PREFIX,
	RECORDER_SEAT_LIMIT_ERROR,
	SUBSCRIPTION_REQUIRED_ERROR
} from '@packages/services/billing/EntitlementService'
import { ReportingService } from '@packages/services/logging/ReportingService'
import type { CompanyInterface } from '@packages/types/company'

describe('EntitlementService', () => {
	let service: EntitlementService
	let mockCompanyRepository: jest.Mocked<CompanyRepository>
	let mockAthleteRepository: jest.Mocked<AthleteRepository>
	let mockUserRoleRepository: jest.Mocked<UserRoleRepository>
	let mockRecorderInviteRepository: jest.Mocked<RecorderInviteRepository>
	let mockReportingService: jest.Mocked<ReportingService>

	const buildCompany = (
		overrides: Partial<CompanyInterface> = {}
	): CompanyInterface => ({
		id: 'company-1',
		name: 'Track Club',
		ownerId: 'owner-1',
		settings: {},
		subscriptionPlan: SubscriptionPlan.Pro,
		subscriptionStatus: SubscriptionStatus.Trial,
		trialEndsAt: addDays(new Date(), 7),
		subscriptionExpiresAt: null,
		revenueCatAppUserId: null,
		...overrides
	})

	beforeEach(() => {
		mockCompanyRepository = mock<CompanyRepository>()
		mockAthleteRepository = mock<AthleteRepository>()
		mockUserRoleRepository = mock<UserRoleRepository>()
		mockRecorderInviteRepository = mock<RecorderInviteRepository>()
		mockReportingService = mock<ReportingService>()
		mockReportingService.withTrace.mockImplementation(({ fn }) => fn())
		mockRecorderInviteRepository.countActivePendingByCompanyId.mockResolvedValue(
			0
		)

		container.registerInstance(CompanyRepository, mockCompanyRepository)
		container.registerInstance(AthleteRepository, mockAthleteRepository)
		container.registerInstance(UserRoleRepository, mockUserRoleRepository)
		container.registerInstance(
			RecorderInviteRepository,
			mockRecorderInviteRepository
		)
		container.registerInstance(ReportingService, mockReportingService)

		service = container.resolve(EntitlementService)
	})

	afterEach(() => {
		container.clearInstances()
	})

	it('allows writes during an active store trial with a selected plan', async () => {
		const company = buildCompany()
		mockCompanyRepository.findOneOrFail.mockResolvedValue(company)
		mockCompanyRepository.findOne.mockResolvedValue(company)

		await expect(
			service.assertCanWrite({ companyId: company.id })
		).resolves.toBeUndefined()
	})

	it('blocks writes during trial when no plan is selected', async () => {
		const company = buildCompany({
			subscriptionPlan: null
		})
		mockCompanyRepository.findOneOrFail.mockResolvedValue(company)
		mockCompanyRepository.findOne.mockResolvedValue(company)

		await expect(
			service.assertCanWrite({ companyId: company.id })
		).rejects.toThrow(SUBSCRIPTION_REQUIRED_ERROR)
	})

	it('blocks writes when trial is expired', async () => {
		const company = buildCompany({
			subscriptionStatus: SubscriptionStatus.Expired,
			trialEndsAt: subDays(new Date(), 1)
		})
		mockCompanyRepository.findOneOrFail.mockResolvedValue(company)
		mockCompanyRepository.findOne.mockResolvedValue(company)

		await expect(
			service.assertCanWrite({ companyId: company.id })
		).rejects.toThrow(SUBSCRIPTION_REQUIRED_ERROR)
	})

	it('hard-blocks athlete create over plan limit', async () => {
		const company = buildCompany({
			subscriptionStatus: SubscriptionStatus.Active,
			subscriptionPlan: SubscriptionPlan.Core
		})
		mockCompanyRepository.findOneOrFail.mockResolvedValue(company)
		mockCompanyRepository.findOne.mockResolvedValue(company)
		mockAthleteRepository.count.mockResolvedValue(10)
		mockUserRoleRepository.find.mockResolvedValue([])

		await expect(
			service.assertCanAddAthletes({ companyId: company.id, additionalCount: 1 })
		).rejects.toThrow(ATHLETE_LIMIT_ERROR)
	})

	it('allows adding a recorder when seats remain', async () => {
		const company = buildCompany({
			subscriptionStatus: SubscriptionStatus.Active,
			subscriptionPlan: SubscriptionPlan.Pro
		})
		mockCompanyRepository.findOneOrFail.mockResolvedValue(company)
		mockCompanyRepository.findOne.mockResolvedValue(company)
		mockAthleteRepository.count.mockResolvedValue(0)
		mockUserRoleRepository.find.mockResolvedValue([])

		await expect(
			service.assertCanAddRecorder({ companyId: company.id })
		).resolves.toBeUndefined()
	})

	it('blocks adding a recorder when seat limit is reached', async () => {
		const company = buildCompany({
			subscriptionStatus: SubscriptionStatus.Active,
			subscriptionPlan: SubscriptionPlan.Pro
		})
		mockCompanyRepository.findOneOrFail.mockResolvedValue(company)
		mockCompanyRepository.findOne.mockResolvedValue(company)
		mockAthleteRepository.count.mockResolvedValue(0)
		mockUserRoleRepository.find.mockResolvedValue([
			{
				id: 'role-1',
				userId: 'u1',
				companyId: company.id,
				role: UserRoles.Recorder
			}
		])

		await expect(
			service.assertCanAddRecorder({ companyId: company.id })
		).rejects.toThrow(RECORDER_SEAT_LIMIT_ERROR)
	})

	it('blocks adding a recorder when pending invites fill seats', async () => {
		const company = buildCompany({
			subscriptionStatus: SubscriptionStatus.Active,
			subscriptionPlan: SubscriptionPlan.Pro
		})
		mockCompanyRepository.findOneOrFail.mockResolvedValue(company)
		mockCompanyRepository.findOne.mockResolvedValue(company)
		mockAthleteRepository.count.mockResolvedValue(0)
		mockUserRoleRepository.find.mockResolvedValue([])
		mockRecorderInviteRepository.countActivePendingByCompanyId.mockResolvedValue(
			1
		)

		await expect(
			service.assertCanAddRecorder({ companyId: company.id })
		).rejects.toThrow(RECORDER_SEAT_LIMIT_ERROR)
	})

	it('includes active recorders and pending invites in recorderSeatCount', async () => {
		const company = buildCompany({
			subscriptionStatus: SubscriptionStatus.Active,
			subscriptionPlan: SubscriptionPlan.Elite
		})
		mockCompanyRepository.findOneOrFail.mockResolvedValue(company)
		mockCompanyRepository.findOne.mockResolvedValue(company)
		mockAthleteRepository.count.mockResolvedValue(2)
		mockUserRoleRepository.find.mockResolvedValue([
			{
				id: 'role-1',
				userId: 'u1',
				companyId: company.id,
				role: UserRoles.Recorder
			}
		])
		mockRecorderInviteRepository.countActivePendingByCompanyId.mockResolvedValue(
			1
		)

		const entitlements = await service.getEntitlements({
			companyId: company.id
		})

		expect(entitlements.maxRecorderSeats).toBe(3)
		expect(entitlements.recorderSeatCount).toBe(2)
	})

	it('parses plan from product identifiers', () => {
		expect(
			service.parsePlanFromProductId({ productId: 'pro_monthly' })
		).toBe(SubscriptionPlan.Pro)
		expect(
			service.parsePlanFromProductId({ productId: 'trackrecord_elite_annual' })
		).toBe(SubscriptionPlan.Elite)
	})

	describe('assertCanChangeToPlan', () => {
		it('allows changing to a plan that fits current usage', async () => {
			mockAthleteRepository.count.mockResolvedValue(10)
			mockUserRoleRepository.find.mockResolvedValue([])
			mockRecorderInviteRepository.countActivePendingByCompanyId.mockResolvedValue(
				0
			)

			await expect(
				service.assertCanChangeToPlan({
					companyId: 'company-1',
					plan: SubscriptionPlan.Pro
				})
			).resolves.toBeUndefined()
		})

		it('blocks downgrade when athlete count exceeds target plan', async () => {
			mockAthleteRepository.count.mockResolvedValue(15)
			mockUserRoleRepository.find.mockResolvedValue([])
			mockRecorderInviteRepository.countActivePendingByCompanyId.mockResolvedValue(
				0
			)

			await expect(
				service.assertCanChangeToPlan({
					companyId: 'company-1',
					plan: SubscriptionPlan.Core
				})
			).rejects.toThrow(PLAN_CHANGE_BLOCKED_ERROR_PREFIX)
		})

		it('blocks downgrade when recorder seats exceed target plan', async () => {
			mockAthleteRepository.count.mockResolvedValue(5)
			mockUserRoleRepository.find.mockResolvedValue([
				{
					id: 'role-1',
					userId: 'u1',
					companyId: 'company-1',
					role: UserRoles.Recorder
				},
				{
					id: 'role-2',
					userId: 'u2',
					companyId: 'company-1',
					role: UserRoles.Recorder
				}
			])

			await expect(
				service.assertCanChangeToPlan({
					companyId: 'company-1',
					plan: SubscriptionPlan.Pro
				})
			).rejects.toThrow(PLAN_CHANGE_BLOCKED_ERROR_PREFIX)
		})

		it('blocks Core when any recorders remain', async () => {
			mockAthleteRepository.count.mockResolvedValue(3)
			mockUserRoleRepository.find.mockResolvedValue([
				{
					id: 'role-1',
					userId: 'u1',
					companyId: 'company-1',
					role: UserRoles.Recorder
				}
			])

			await expect(
				service.assertCanChangeToPlan({
					companyId: 'company-1',
					plan: SubscriptionPlan.Core
				})
			).rejects.toThrow(/recorder/)
		})

		it('allows Elite regardless of athlete count', async () => {
			mockAthleteRepository.count.mockResolvedValue(100)
			mockUserRoleRepository.find.mockResolvedValue([])
			mockRecorderInviteRepository.countActivePendingByCompanyId.mockResolvedValue(
				0
			)

			await expect(
				service.assertCanChangeToPlan({
					companyId: 'company-1',
					plan: SubscriptionPlan.Elite
				})
			).resolves.toBeUndefined()
		})
	})
})
