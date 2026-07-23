export enum CoachLifecycleEmailStep {
	Welcome = 'welcome',
	ActivationNudge = 'activation_nudge',
	FeatureHighlight = 'feature_highlight',
	TrialEndingSoon = 'trial_ending_soon',
	TrialConverted = 'trial_converted',
	TrialNotConverted = 'trial_not_converted'
}

export enum CoachLifecycleEmailJobStatus {
	Pending = 'pending',
	Sent = 'sent',
	Skipped = 'skipped',
	Cancelled = 'cancelled'
}

/** Midpoint of the Day 1–2 activation window. */
export const COACH_LIFECYCLE_ACTIVATION_DELAY_HOURS = 36

/** Day 5 feature highlight. */
export const COACH_LIFECYCLE_FEATURE_DELAY_DAYS = 5

/** Send trial-ending email this many days before trialEndsAt. */
export const COACH_LIFECYCLE_TRIAL_ENDING_DAYS_BEFORE = 2

/** How often the in-process processor checks for due lifecycle emails. */
export const COACH_LIFECYCLE_PROCESS_INTERVAL_MS = 5 * 60 * 1000
