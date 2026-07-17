import { container } from 'tsyringe'

import { SubscriptionPlan } from '@packages/enums'
import { SubscriptionService } from '@packages/services/billing/SubscriptionService'
import type { CompanyInterface, Context } from '@packages/types'

export const syncCompanySubscription = async (
	_parent: unknown,
	{
		companyId,
		plan,
		revenueCatAppUserId,
		isActive,
		isInTrial,
		expiresAt
	}: {
		companyId: string
		plan: SubscriptionPlan
		revenueCatAppUserId: string
		isActive: boolean
		isInTrial?: boolean | null
		expiresAt?: Date | string | null
	},
	{ req, reportingService }: Context
): Promise<CompanyInterface> => {
	reportingService.startTrace({
		op: 'syncCompanySubscription',
		name: 'syncCompanySubscription'
	})
	try {
		if (!req.session.userId) {
			throw new Error('User not authenticated')
		}

		const subscriptionService = container.resolve(SubscriptionService)
		return await subscriptionService.syncFromClient({
			companyId,
			ownerUserId: req.session.userId,
			plan,
			revenueCatAppUserId,
			isActive,
			isInTrial: isInTrial === true,
			expiresAt:
				expiresAt != null && expiresAt !== ''
					? new Date(expiresAt)
					: null
		})
	} catch (error) {
		reportingService.reportError({ error: error as Error })
		throw error
	} finally {
		reportingService.endTrace()
	}
}
