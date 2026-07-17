import { isAfter } from 'date-fns'
import { inject, injectable, singleton } from 'tsyringe'

import {
	PLAN_LIMITS,
	SubscriptionPlan,
	SubscriptionStatus,
	UserRoles
} from '@packages/enums'
import { AthleteRepository } from '@packages/repositories/athlete/AthleteRepository'
import { CompanyRepository } from '@packages/repositories/company/CompanyRepository'
import { RecorderInviteRepository } from '@packages/repositories/recorderInvite/RecorderInviteRepository'
import { UserRoleRepository } from '@packages/repositories/userRole/UserRoleRepository'
import ReportErrors, {
	NoTrace
} from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import type {
	CompanyInterface,
	CompanySubscriptionEntitlements
} from '@packages/types/company'

export const SUBSCRIPTION_REQUIRED_ERROR =
	'Subscription required. Upgrade to continue.'

export const ATHLETE_LIMIT_ERROR = 'Athlete limit reached for your plan. Upgrade to add more athletes.'

export const RECORDER_SEAT_LIMIT_ERROR =
	'Recorder seat limit reached for your plan. Upgrade to invite more recorders.'

/** Prefix for plan-change errors — full message includes current vs allowed counts. */
export const PLAN_CHANGE_BLOCKED_ERROR_PREFIX =
	'Cannot switch to this plan while over its limits'

@injectable()
@singleton()
@ReportErrors()
export class EntitlementService {
	constructor(
		@inject(CompanyRepository)
		private companyRepository: CompanyRepository,
		@inject(AthleteRepository)
		private athleteRepository: AthleteRepository,
		@inject(UserRoleRepository)
		private userRoleRepository: UserRoleRepository,
		@inject(RecorderInviteRepository)
		private recorderInviteRepository: RecorderInviteRepository,
		@inject(ReportingService)
		private reportingService: ReportingService
	) {}

	@NoTrace()
	public resolveEffectivePlan({
		company
	}: {
		company: CompanyInterface
	}): SubscriptionPlan | null {
		// Trial and paid both use the store-selected plan. No implicit Pro trial.
		return company.subscriptionPlan ?? null
	}

	@NoTrace()
	public isTrialActive({ company }: { company: CompanyInterface }): boolean {
		if (company.subscriptionStatus !== SubscriptionStatus.Trial) {
			return false
		}
		if (!company.trialEndsAt) {
			return true
		}
		return isAfter(company.trialEndsAt, new Date())
	}

	@NoTrace()
	public canWrite({ company }: { company: CompanyInterface }): boolean {
		if (company.subscriptionStatus === SubscriptionStatus.Active) {
			return true
		}
		// Store trials require a selected plan (trial the plan they picked).
		return (
			this.isTrialActive({ company }) && company.subscriptionPlan != null
		)
	}

	public async getEntitlements({
		companyId
	}: {
		companyId: string
	}): Promise<CompanySubscriptionEntitlements> {
		const company = await this.companyRepository.findOneOrFail({
			filter: { id: companyId }
		})
		await this.expireTrialIfNeeded({ company })

		const refreshed =
			(await this.companyRepository.findOne({ filter: { id: companyId } })) ??
			company

		const plan = this.resolveEffectivePlan({ company: refreshed })
		const limits = plan
			? PLAN_LIMITS[plan]
			: { maxAthletes: 0, maxRecorderSeats: 0 }
		const athleteCount = await this.athleteRepository.count({
			filter: { companyId }
		})
		const recorderSeatCount = await this.countRecorderSeats({ companyId })

		return {
			plan,
			status: refreshed.subscriptionStatus,
			canWrite: this.canWrite({ company: refreshed }),
			maxAthletes: limits.maxAthletes,
			maxRecorderSeats: limits.maxRecorderSeats,
			recorderSeatCount,
			trialEndsAt: refreshed.trialEndsAt ?? null,
			athleteCount
		}
	}

	public async assertCanWrite({
		companyId
	}: {
		companyId: string
	}): Promise<void> {
		const company = await this.companyRepository.findOneOrFail({
			filter: { id: companyId }
		})
		await this.expireTrialIfNeeded({ company })
		const refreshed =
			(await this.companyRepository.findOne({ filter: { id: companyId } })) ??
			company

		if (!this.canWrite({ company: refreshed })) {
			throw new Error(SUBSCRIPTION_REQUIRED_ERROR)
		}
	}

	public async assertCanAddAthletes({
		companyId,
		additionalCount = 1
	}: {
		companyId: string
		additionalCount?: number
	}): Promise<void> {
		await this.assertCanWrite({ companyId })
		const entitlements = await this.getEntitlements({ companyId })
		if (entitlements.maxAthletes === null) {
			return
		}
		const current = entitlements.athleteCount ?? 0
		if (current + additionalCount > entitlements.maxAthletes) {
			throw new Error(ATHLETE_LIMIT_ERROR)
		}
	}

	public async assertCanAddRecorder({
		companyId
	}: {
		companyId: string
	}): Promise<void> {
		await this.assertCanWrite({ companyId })
		const entitlements = await this.getEntitlements({ companyId })
		if (entitlements.maxRecorderSeats <= 0) {
			throw new Error(RECORDER_SEAT_LIMIT_ERROR)
		}
		const recorderCount = await this.countRecorderSeats({ companyId })
		if (recorderCount >= entitlements.maxRecorderSeats) {
			throw new Error(RECORDER_SEAT_LIMIT_ERROR)
		}
	}

	/**
	 * Blocks activating a plan when current usage exceeds that plan's limits.
	 * Used to prevent downgrades (and trial→paid) until extras are removed.
	 */
	public async assertCanChangeToPlan({
		companyId,
		plan
	}: {
		companyId: string
		plan: SubscriptionPlan
	}): Promise<void> {
		const reason = await this.getPlanChangeBlockReason({ companyId, plan })
		if (reason !== null) {
			throw new Error(reason)
		}
	}

	public async getPlanChangeBlockReason({
		companyId,
		plan
	}: {
		companyId: string
		plan: SubscriptionPlan
	}): Promise<string | null> {
		const limits = PLAN_LIMITS[plan]
		const athleteCount = await this.athleteRepository.count({
			filter: { companyId }
		})
		const recorderSeatCount = await this.countRecorderSeats({ companyId })

		const athleteOver =
			limits.maxAthletes !== null && athleteCount > limits.maxAthletes
		const recorderOver = recorderSeatCount > limits.maxRecorderSeats

		if (!athleteOver && !recorderOver) {
			return null
		}

		const parts: string[] = []
		if (athleteOver && limits.maxAthletes !== null) {
			parts.push(
				`${athleteCount} athletes (plan allows ${limits.maxAthletes})`
			)
		}
		if (recorderOver) {
			parts.push(
				`${recorderSeatCount} recorder${
					recorderSeatCount === 1 ? '' : 's'
				} (plan allows ${limits.maxRecorderSeats})`
			)
		}

		return `${PLAN_CHANGE_BLOCKED_ERROR_PREFIX}: ${parts.join(
			' and '
		)}. Remove extras, then try again.`
	}

	public async usageFitsPlan({
		companyId,
		plan
	}: {
		companyId: string
		plan: SubscriptionPlan
	}): Promise<boolean> {
		const reason = await this.getPlanChangeBlockReason({ companyId, plan })
		return reason === null
	}

	public async applySubscriptionUpdate({
		companyId,
		plan,
		status,
		revenueCatAppUserId,
		expiresAt,
		trialEndsAt
	}: {
		companyId: string
		plan: SubscriptionPlan | null
		status: SubscriptionStatus
		revenueCatAppUserId?: string | null
		expiresAt?: Date | null
		trialEndsAt?: Date | null
	}): Promise<CompanyInterface> {
		const updated = await this.companyRepository.updateSubscription({
			companyId,
			subscriptionPlan: plan,
			subscriptionStatus: status,
			subscriptionExpiresAt: expiresAt ?? null,
			...(trialEndsAt !== undefined && { trialEndsAt }),
			...(revenueCatAppUserId !== undefined && { revenueCatAppUserId })
		})
		if (!updated) {
			throw new Error(`Failed to update subscription for company ${companyId}`)
		}
		return updated
	}

	@NoTrace()
	public parsePlanFromProductId({
		productId
	}: {
		productId: string
	}): SubscriptionPlan | null {
		const normalized = productId.toLowerCase()
		if (normalized.includes('elite')) {
			return SubscriptionPlan.Elite
		}
		if (normalized.includes('pro')) {
			return SubscriptionPlan.Pro
		}
		if (normalized.includes('core')) {
			return SubscriptionPlan.Core
		}
		return null
	}

	private async expireTrialIfNeeded({
		company
	}: {
		company: CompanyInterface
	}): Promise<void> {
		if (company.subscriptionStatus !== SubscriptionStatus.Trial) {
			return
		}
		if (!company.trialEndsAt) {
			return
		}
		if (isAfter(company.trialEndsAt, new Date())) {
			return
		}
		await this.companyRepository.updateSubscription({
			companyId: company.id,
			subscriptionStatus: SubscriptionStatus.Expired,
			subscriptionPlan: company.subscriptionPlan ?? null
		})
		this.reportingService.log({
			message: 'Company trial expired',
			companyId: company.id
		})
	}

	private async countRecorderSeats({
		companyId
	}: {
		companyId: string
	}): Promise<number> {
		const roles = await this.userRoleRepository.find({
			filter: { companyId, role: UserRoles.Recorder }
		})
		const pendingInvites =
			await this.recorderInviteRepository.countActivePendingByCompanyId({
				companyId
			})
		return roles.length + pendingInvites
	}
}
