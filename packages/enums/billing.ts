export enum SubscriptionPlan {
	Core = 'core',
	Pro = 'pro',
	Elite = 'elite'
}

export enum SubscriptionStatus {
	Trial = 'trial',
	Active = 'active',
	Expired = 'expired',
	Cancelled = 'cancelled'
}

export const PLAN_LIMITS: Record<
	SubscriptionPlan,
	{ maxAthletes: number | null; maxRecorderSeats: number }
> = {
	[SubscriptionPlan.Core]: { maxAthletes: 10, maxRecorderSeats: 0 },
	[SubscriptionPlan.Pro]: { maxAthletes: 20, maxRecorderSeats: 1 },
	[SubscriptionPlan.Elite]: { maxAthletes: null, maxRecorderSeats: 3 }
}

/**
 * @deprecated App-owned signup trials are removed. Trials come from StoreKit /
 * RevenueCat intro offers on the selected plan. Kept for any residual imports.
 */
export const TRIAL_PLAN = SubscriptionPlan.Pro

/** @deprecated Prefer Apple/RC trial length from expiration timestamps. */
export const TRIAL_DAYS = 14

/** RevenueCat / StoreKit period types we treat as free trial. */
export const STORE_TRIAL_PERIOD_TYPES = new Set(['TRIAL'])
