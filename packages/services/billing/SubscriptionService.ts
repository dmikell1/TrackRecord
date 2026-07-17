import { inject, injectable, singleton } from 'tsyringe'

import {
	STORE_TRIAL_PERIOD_TYPES,
	SubscriptionPlan,
	SubscriptionStatus
} from '@packages/enums'
import { CompanyRepository } from '@packages/repositories/company/CompanyRepository'
import { UserRepository } from '@packages/repositories/user/UserRepository'
import { EntitlementService } from '@packages/services/billing/EntitlementService'
import ReportErrors, {
	NoTrace
} from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import type { CompanyInterface } from '@packages/types/company'

@injectable()
@singleton()
@ReportErrors()
export class SubscriptionService {
	constructor(
		@inject(CompanyRepository)
		private companyRepository: CompanyRepository,
		@inject(UserRepository)
		private userRepository: UserRepository,
		@inject(EntitlementService)
		private entitlementService: EntitlementService,
		@inject(ReportingService)
		private reportingService: ReportingService
	) {}

	public async syncFromClient({
		companyId,
		ownerUserId,
		plan,
		revenueCatAppUserId,
		isActive,
		isInTrial,
		expiresAt
	}: {
		companyId: string
		ownerUserId: string
		plan: SubscriptionPlan
		revenueCatAppUserId: string
		isActive: boolean
		isInTrial?: boolean
		expiresAt?: Date | null
	}): Promise<CompanyInterface> {
		const company = await this.companyRepository.findOneOrFail({
			filter: { id: companyId }
		})

		if (company.ownerId !== ownerUserId) {
			throw new Error('Only the company owner can sync subscription')
		}

		// Always apply the purchased plan (no Pro-for-Core deferral). Over-limit
		// usage is enforced on add/invite, not by keeping a higher plan.
		if (isActive) {
			const overLimitReason =
				await this.entitlementService.getPlanChangeBlockReason({
					companyId,
					plan
				})
			if (overLimitReason !== null) {
				this.reportingService.log({
					message:
						'Applying purchased plan while over its limits — adds blocked until usage fits',
					companyId,
					plan,
					overLimitReason
				})
			}
		}

		const status = this.resolveStatusFromStore({
			isActive,
			isInTrial: isInTrial === true
		})

		return await this.entitlementService.applySubscriptionUpdate({
			companyId,
			plan: isActive ? plan : company.subscriptionPlan ?? plan,
			status,
			revenueCatAppUserId,
			expiresAt: expiresAt ?? null,
			trialEndsAt:
				status === SubscriptionStatus.Trial ? (expiresAt ?? null) : null
		})
	}

	public async handleRevenueCatWebhook({
		appUserId,
		productId,
		isActive,
		expirationAt,
		periodType
	}: {
		appUserId: string
		productId?: string | null
		isActive: boolean
		expirationAt?: Date | null
		periodType?: string | null
	}): Promise<CompanyInterface | null> {
		let company =
			await this.companyRepository.findByRevenueCatAppUserId({
				revenueCatAppUserId: appUserId
			})

		if (!company) {
			const user = await this.userRepository.findOne({
				filter: { clerkId: appUserId }
			})
			if (user) {
				company = await this.companyRepository.findOne({
					filter: { ownerId: user.id }
				})
			}
		}

		if (!company) {
			this.reportingService.log({
				message: 'RevenueCat webhook: no company for app user',
				appUserId
			})
			return null
		}

		const parsedPlan = productId
			? this.entitlementService.parsePlanFromProductId({ productId })
			: null

		const planToApply: SubscriptionPlan | null = isActive
			? parsedPlan ?? company.subscriptionPlan ?? null
			: company.subscriptionPlan ?? parsedPlan

		const isInTrial =
			isActive &&
			periodType != null &&
			STORE_TRIAL_PERIOD_TYPES.has(periodType.toUpperCase())

		const status = this.resolveStatusFromStore({
			isActive,
			isInTrial
		})

		if (isActive && planToApply !== null) {
			const overLimitReason =
				await this.entitlementService.getPlanChangeBlockReason({
					companyId: company.id,
					plan: planToApply
				})
			if (overLimitReason !== null) {
				this.reportingService.log({
					message:
						'Applying store plan while over its limits — adds blocked until usage fits',
					companyId: company.id,
					plan: planToApply,
					overLimitReason
				})
			}
		}

		return await this.entitlementService.applySubscriptionUpdate({
			companyId: company.id,
			plan: planToApply,
			status,
			revenueCatAppUserId: appUserId,
			expiresAt: expirationAt ?? null,
			trialEndsAt:
				status === SubscriptionStatus.Trial ? (expirationAt ?? null) : null
		})
	}

	@NoTrace()
	private resolveStatusFromStore({
		isActive,
		isInTrial
	}: {
		isActive: boolean
		isInTrial: boolean
	}): SubscriptionStatus {
		if (!isActive) {
			return SubscriptionStatus.Expired
		}
		if (isInTrial) {
			return SubscriptionStatus.Trial
		}
		return SubscriptionStatus.Active
	}
}
