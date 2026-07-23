import type {
	CoachLifecycleEmailJobStatus,
	CoachLifecycleEmailStep
} from '@packages/enums/coachLifecycleEmail'

export interface CoachLifecycleEmailJobInterface {
	id: string
	userId: string
	companyId: string
	teamId: string
	step: CoachLifecycleEmailStep
	status: CoachLifecycleEmailJobStatus
	scheduledFor: Date
	sentAt: Date | null
	skippedAt: Date | null
	skipReason: string | null
	createdAt: Date
	updatedAt: Date
}
