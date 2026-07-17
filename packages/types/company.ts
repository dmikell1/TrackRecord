import type { SubscriptionPlan, SubscriptionStatus } from '@packages/enums'

import type { TeamInterface } from './team'
import type { UserInterface } from './user'

export interface CompanyData {
	name: string
	ownerId: string
	owner?: UserInterface
	teams?: TeamInterface[]
	users?: UserInterface[]
	settings: CompanySettingsInterface
	subscriptionPlan?: SubscriptionPlan | null
	subscriptionStatus: SubscriptionStatus
	trialEndsAt?: Date | null
	subscriptionExpiresAt?: Date | null
	revenueCatAppUserId?: string | null
	createdAt?: Date
	updatedAt?: Date
}

export interface CompanySettingsInterface {
	timezoneName?: string
}

export interface CompanyInterface extends CompanyData {
	id: string
}

export interface CompanySubscriptionEntitlements {
	plan: SubscriptionPlan | null
	status: SubscriptionStatus
	canWrite: boolean
	maxAthletes: number | null
	maxRecorderSeats: number
	recorderSeatCount: number
	trialEndsAt: Date | null
	athleteCount?: number
}
