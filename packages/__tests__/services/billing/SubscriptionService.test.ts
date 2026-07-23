import { mock } from 'jest-mock-extended'
import { container } from 'tsyringe'

import { SubscriptionPlan, SubscriptionStatus } from '@packages/enums'
import { CompanyRepository } from '@packages/repositories/company/CompanyRepository'
import { UserRepository } from '@packages/repositories/user/UserRepository'
import { EntitlementService } from '@packages/services/billing/EntitlementService'
import { SubscriptionService } from '@packages/services/billing/SubscriptionService'
import { CoachLifecycleEmailService } from '@packages/services/email/CoachLifecycleEmailService'
import { ReportingService } from '@packages/services/logging/ReportingService'
import type { CompanyInterface } from '@packages/types/company'

describe('SubscriptionService', () => {
	let service: SubscriptionService
	let mockCompanyRepository: jest.Mocked<CompanyRepository>
	let mockUserRepository: jest.Mocked<UserRepository>
	let mockEntitlementService: jest.Mocked<EntitlementService>
	let mockCoachLifecycleEmailService: jest.Mocked<CoachLifecycleEmailService>
	let mockReportingService: jest.Mocked<ReportingService>

	const buildCompany = (
		overrides: Partial<CompanyInterface> = {}
	): CompanyInterface => ({
		id: 'company-1',
		name: 'Track Club',
		ownerId: 'owner-1',
		settings: {},
		subscriptionPlan: SubscriptionPlan.Elite,
		subscriptionStatus: SubscriptionStatus.Active,
		trialEndsAt: null,
		subscriptionExpiresAt: null,
		revenueCatAppUserId: 'rc-user-1',
		...overrides
	})

	beforeEach(() => {
		mockCompanyRepository = mock<CompanyRepository>()
		mockUserRepository = mock<UserRepository>()
		mockEntitlementService = mock<EntitlementService>()
		mockCoachLifecycleEmailService = mock<CoachLifecycleEmailService>()
		mockReportingService = mock<ReportingService>()
		mockReportingService.withTrace.mockImplementation(({ fn }) => fn())

		container.registerInstance(CompanyRepository, mockCompanyRepository)
		container.registerInstance(UserRepository, mockUserRepository)
		container.registerInstance(EntitlementService, mockEntitlementService)
		container.registerInstance(
			CoachLifecycleEmailService,
			mockCoachLifecycleEmailService
		)
		container.registerInstance(ReportingService, mockReportingService)

		service = container.resolve(SubscriptionService)
	})

	afterEach(() => {
		container.clearInstances()
	})

	describe('syncFromClient', () => {
		it('applies active plan without blocking on over-limit usage', async () => {
			const company = buildCompany()
			const updated = buildCompany({
				subscriptionPlan: SubscriptionPlan.Core,
				subscriptionStatus: SubscriptionStatus.Active
			})
			mockCompanyRepository.findOneOrFail.mockResolvedValue(company)
			mockEntitlementService.getPlanChangeBlockReason.mockResolvedValue(
				'Cannot switch to this plan while over its limits: 25 athletes (plan allows 10). Remove extras, then try again.'
			)
			mockEntitlementService.applySubscriptionUpdate.mockResolvedValue(updated)

			const result = await service.syncFromClient({
				companyId: company.id,
				ownerUserId: company.ownerId,
				plan: SubscriptionPlan.Core,
				revenueCatAppUserId: 'rc-user-1',
				isActive: true
			})

			expect(result.subscriptionPlan).toBe(SubscriptionPlan.Core)
			expect(mockEntitlementService.applySubscriptionUpdate).toHaveBeenCalledWith(
				expect.objectContaining({
					plan: SubscriptionPlan.Core,
					status: SubscriptionStatus.Active
				})
			)
		})

		it('syncs StoreKit trial as trial status with trialEndsAt', async () => {
			const company = buildCompany({
				subscriptionStatus: SubscriptionStatus.Expired,
				subscriptionPlan: null
			})
			const expiresAt = new Date('2026-08-01T00:00:00.000Z')
			const updated = buildCompany({
				subscriptionPlan: SubscriptionPlan.Pro,
				subscriptionStatus: SubscriptionStatus.Trial,
				trialEndsAt: expiresAt
			})
			mockCompanyRepository.findOneOrFail.mockResolvedValue(company)
			mockEntitlementService.getPlanChangeBlockReason.mockResolvedValue(null)
			mockEntitlementService.applySubscriptionUpdate.mockResolvedValue(updated)

			await service.syncFromClient({
				companyId: company.id,
				ownerUserId: company.ownerId,
				plan: SubscriptionPlan.Pro,
				revenueCatAppUserId: 'rc-user-1',
				isActive: true,
				isInTrial: true,
				expiresAt
			})

			expect(mockEntitlementService.applySubscriptionUpdate).toHaveBeenCalledWith(
				{
					companyId: company.id,
					plan: SubscriptionPlan.Pro,
					status: SubscriptionStatus.Trial,
					revenueCatAppUserId: 'rc-user-1',
					expiresAt,
					trialEndsAt: expiresAt
				}
			)
		})

		it('marks inactive sync as expired', async () => {
			const company = buildCompany()
			const updated = buildCompany({
				subscriptionStatus: SubscriptionStatus.Expired
			})
			mockCompanyRepository.findOneOrFail.mockResolvedValue(company)
			mockEntitlementService.applySubscriptionUpdate.mockResolvedValue(updated)

			await service.syncFromClient({
				companyId: company.id,
				ownerUserId: company.ownerId,
				plan: SubscriptionPlan.Elite,
				revenueCatAppUserId: 'rc-user-1',
				isActive: false
			})

			expect(mockEntitlementService.applySubscriptionUpdate).toHaveBeenCalledWith(
				expect.objectContaining({
					status: SubscriptionStatus.Expired
				})
			)
		})
	})

	describe('handleRevenueCatWebhook', () => {
		it('applies purchased plan even when usage exceeds that plan', async () => {
			const company = buildCompany({
				subscriptionPlan: SubscriptionPlan.Elite
			})
			mockCompanyRepository.findByRevenueCatAppUserId.mockResolvedValue(
				company
			)
			mockEntitlementService.parsePlanFromProductId.mockReturnValue(
				SubscriptionPlan.Core
			)
			mockEntitlementService.getPlanChangeBlockReason.mockResolvedValue(
				'over limits'
			)
			mockEntitlementService.applySubscriptionUpdate.mockResolvedValue(company)

			await service.handleRevenueCatWebhook({
				appUserId: 'rc-user-1',
				productId: 'core_monthly',
				isActive: true,
				expirationAt: null,
				periodType: 'NORMAL'
			})

			expect(mockEntitlementService.applySubscriptionUpdate).toHaveBeenCalledWith(
				{
					companyId: company.id,
					plan: SubscriptionPlan.Core,
					status: SubscriptionStatus.Active,
					revenueCatAppUserId: 'rc-user-1',
					expiresAt: null,
					trialEndsAt: null
				}
			)
		})

		it('maps period_type TRIAL to trial status and selected plan', async () => {
			const company = buildCompany({
				subscriptionStatus: SubscriptionStatus.Expired,
				subscriptionPlan: null
			})
			const expirationAt = new Date('2026-08-01T00:00:00.000Z')
			mockCompanyRepository.findByRevenueCatAppUserId.mockResolvedValue(
				company
			)
			mockEntitlementService.parsePlanFromProductId.mockReturnValue(
				SubscriptionPlan.Core
			)
			mockEntitlementService.getPlanChangeBlockReason.mockResolvedValue(null)
			mockEntitlementService.applySubscriptionUpdate.mockResolvedValue(company)

			await service.handleRevenueCatWebhook({
				appUserId: 'rc-user-1',
				productId: 'core_monthly',
				isActive: true,
				expirationAt,
				periodType: 'TRIAL'
			})

			expect(mockEntitlementService.applySubscriptionUpdate).toHaveBeenCalledWith(
				{
					companyId: company.id,
					plan: SubscriptionPlan.Core,
					status: SubscriptionStatus.Trial,
					revenueCatAppUserId: 'rc-user-1',
					expiresAt: expirationAt,
					trialEndsAt: expirationAt
				}
			)
		})
	})
})
