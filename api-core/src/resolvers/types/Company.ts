import { container } from 'tsyringe'

import { EntitlementService } from '@packages/services/billing/EntitlementService'
import type { CompanyInterface } from '@packages/types/company'
import type { Context } from '@packages/types'

export const Company = {
	subscription: async (
		parent: CompanyInterface,
		_args: unknown,
		_context: Context
	): Promise<{
		plan: string | null
		status: string
		canWrite: boolean
		maxAthletes: number | null
		maxRecorderSeats: number
		recorderSeatCount: number
		trialEndsAt: Date | null
		athleteCount: number | undefined
	}> => {
		const entitlementService = container.resolve(EntitlementService)
		const entitlements = await entitlementService.getEntitlements({
			companyId: parent.id
		})
		return {
			plan: entitlements.plan,
			status: entitlements.status,
			canWrite: entitlements.canWrite,
			maxAthletes: entitlements.maxAthletes,
			maxRecorderSeats: entitlements.maxRecorderSeats,
			recorderSeatCount: entitlements.recorderSeatCount,
			trialEndsAt: entitlements.trialEndsAt,
			athleteCount: entitlements.athleteCount
		}
	}
}
