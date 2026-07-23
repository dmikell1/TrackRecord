import { addDays, addHours, format, subDays } from 'date-fns'
import { inject, injectable, singleton } from 'tsyringe'

import {
	COACH_LIFECYCLE_ACTIVATION_DELAY_HOURS,
	COACH_LIFECYCLE_FEATURE_DELAY_DAYS,
	COACH_LIFECYCLE_TRIAL_ENDING_DAYS_BEFORE,
	CoachLifecycleEmailJobStatus,
	CoachLifecycleEmailStep,
	SubscriptionPlan,
	SubscriptionStatus
} from '@packages/enums'
import { AthleteRepository } from '@packages/repositories/athlete/AthleteRepository'
import { CompanyRepository } from '@packages/repositories/company/CompanyRepository'
import { CoachLifecycleEmailJobRepository } from '@packages/repositories/email/CoachLifecycleEmailJobRepository'
import { TeamRepository } from '@packages/repositories/team/TeamRepository'
import { TrainingSessionRepository } from '@packages/repositories/trainingSession/TrainingSessionRepository'
import { UserRepository } from '@packages/repositories/user/UserRepository'
import { VideoRepository } from '@packages/repositories/video/VideoRepository'
import {
	buildCoachActivationNudgeEmail,
	buildCoachFeatureHighlightEmail,
	buildCoachTrialConvertedEmail,
	buildCoachTrialEndingSoonEmail,
	buildCoachTrialNotConvertedEmail,
	buildCoachWelcomeEmail
} from '@packages/services/email/coachLifecycleEmailTemplate'
import ReportErrors, {
	NoTrace
} from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import QueueService from '@packages/services/queue/QueueService'
import type { CoachLifecycleEmailJobInterface } from '@packages/types/coachLifecycleEmailJob'
import type { UserInterface } from '@packages/types/user'
import {
	APPLE_SUBSCRIPTIONS_URL,
	buildCoachAthletesDeepLink,
	buildCoachHomeDeepLink,
	buildCoachSettingsDeepLink
} from '@packages/utils/buildCoachAppDeepLink'

@injectable()
@singleton()
@ReportErrors()
export class CoachLifecycleEmailService {
	constructor(
		@inject(CoachLifecycleEmailJobRepository)
		private jobRepository: CoachLifecycleEmailJobRepository,
		@inject(AthleteRepository)
		private athleteRepository: AthleteRepository,
		@inject(TrainingSessionRepository)
		private trainingSessionRepository: TrainingSessionRepository,
		@inject(VideoRepository)
		private videoRepository: VideoRepository,
		@inject(CompanyRepository)
		private companyRepository: CompanyRepository,
		@inject(TeamRepository)
		private teamRepository: TeamRepository,
		@inject(UserRepository)
		private userRepository: UserRepository,
		@inject(ReportingService)
		private reportingService: ReportingService
	) {}

	/**
	 * Day 0 welcome (immediate) + schedule Day 1–2 / Day 5 emails.
	 */
	public async enrollOnCoachSignup({
		user,
		companyId,
		teamId
	}: {
		user: Pick<UserInterface, 'id' | 'email' | 'firstName'>
		companyId: string
		teamId: string
	}): Promise<void> {
		const now = new Date()
		const appUrl = buildCoachHomeDeepLink()

		const welcome = buildCoachWelcomeEmail({
			firstName: user.firstName,
			appUrl
		})

		await QueueService.scheduleSendEmail({
			to: user.email,
			subject: welcome.subject,
			text: welcome.text,
			html: welcome.html
		})

		const welcomeJob = await this.jobRepository.upsertPendingJob({
			data: {
				userId: user.id,
				companyId,
				teamId,
				step: CoachLifecycleEmailStep.Welcome,
				scheduledFor: now
			}
		})
		await this.jobRepository.markSent({ id: welcomeJob.id })

		await this.jobRepository.upsertPendingJob({
			data: {
				userId: user.id,
				companyId,
				teamId,
				step: CoachLifecycleEmailStep.ActivationNudge,
				scheduledFor: addHours(
					now,
					COACH_LIFECYCLE_ACTIVATION_DELAY_HOURS
				)
			}
		})

		await this.jobRepository.upsertPendingJob({
			data: {
				userId: user.id,
				companyId,
				teamId,
				step: CoachLifecycleEmailStep.FeatureHighlight,
				scheduledFor: addDays(
					now,
					COACH_LIFECYCLE_FEATURE_DELAY_DAYS
				)
			}
		})

		this.reportingService.log({
			message: 'Enrolled coach in lifecycle emails',
			userId: user.id,
			companyId
		})
	}

	/**
	 * When a store trial starts, schedule the Day 12 ending reminder.
	 */
	public async onTrialStarted({
		companyId,
		trialEndsAt,
		plan
	}: {
		companyId: string
		trialEndsAt: Date
		plan: SubscriptionPlan | null
	}): Promise<void> {
		const company = await this.companyRepository.findOneOrFail({
			filter: { id: companyId }
		})
		const team = await this.resolvePrimaryTeam({ companyId })
		if (!team) {
			this.reportingService.log({
				message: 'Skipping trial lifecycle enroll — no team',
				companyId
			})
			return
		}

		const scheduledFor = subDays(
			trialEndsAt,
			COACH_LIFECYCLE_TRIAL_ENDING_DAYS_BEFORE
		)
		const now = new Date()

		await this.jobRepository.upsertPendingJob({
			data: {
				userId: company.ownerId,
				companyId,
				teamId: team.id,
				step: CoachLifecycleEmailStep.TrialEndingSoon,
				scheduledFor: scheduledFor > now ? scheduledFor : now
			}
		})

		this.reportingService.log({
			message: 'Scheduled trial ending lifecycle email',
			companyId,
			plan,
			scheduledFor:
				scheduledFor > now ? scheduledFor.toISOString() : now.toISOString()
		})
	}

	/**
	 * React to subscription status transitions (convert / expire).
	 */
	public async onSubscriptionStatusChanged({
		companyId,
		previousStatus,
		nextStatus,
		plan
	}: {
		companyId: string
		previousStatus: SubscriptionStatus
		nextStatus: SubscriptionStatus
		plan: SubscriptionPlan | null
	}): Promise<void> {
		const company = await this.companyRepository.findOneOrFail({
			filter: { id: companyId }
		})

		if (
			previousStatus === SubscriptionStatus.Trial &&
			nextStatus === SubscriptionStatus.Active
		) {
			await this.jobRepository.cancelPendingSteps({
				userId: company.ownerId,
				steps: [CoachLifecycleEmailStep.TrialEndingSoon]
			})
			await this.sendImmediateTrialConverted({ companyId, plan })
			return
		}

		if (
			previousStatus === SubscriptionStatus.Trial &&
			nextStatus === SubscriptionStatus.Expired
		) {
			await this.jobRepository.cancelPendingSteps({
				userId: company.ownerId,
				steps: [CoachLifecycleEmailStep.TrialEndingSoon]
			})
			await this.sendImmediateTrialNotConverted({ companyId })
		}
	}

	public async processDueJobs(): Promise<number> {
		const dueJobs = await this.jobRepository.findDuePending({
			now: new Date()
		})

		let processed = 0
		for (const job of dueJobs) {
			try {
				await this.processJob({ job })
				processed += 1
			} catch (error) {
				this.reportingService.error({
					message: 'Failed to process coach lifecycle email job',
					error: error as Error,
					jobId: job.id,
					step: job.step
				})
			}
		}

		return processed
	}

	private async processJob({
		job
	}: {
		job: CoachLifecycleEmailJobInterface
	}): Promise<void> {
		const user = await this.userRepository.findOne({
			filter: { id: job.userId }
		})
		if (!user?.email) {
			await this.jobRepository.markSkipped({
				id: job.id,
				reason: 'User missing or has no email'
			})
			return
		}

		const appUrl = buildCoachHomeDeepLink()
		const athletesUrl = buildCoachAthletesDeepLink()
		const settingsUrl = buildCoachSettingsDeepLink()

		if (job.step === CoachLifecycleEmailStep.Welcome) {
			// Welcome is sent at enroll time; leftover pending rows are marked sent.
			await this.jobRepository.markSent({ id: job.id })
			return
		}

		if (job.step === CoachLifecycleEmailStep.ActivationNudge) {
			const shouldSkip = await this.hasActivated({
				companyId: job.companyId,
				teamId: job.teamId
			})
			if (shouldSkip) {
				await this.jobRepository.markSkipped({
					id: job.id,
					reason: 'Already added athlete and logged a session'
				})
				return
			}

			const content = buildCoachActivationNudgeEmail({
				firstName: user.firstName,
				appUrl: athletesUrl
			})
			await this.sendAndMark({
				jobId: job.id,
				to: user.email,
				content
			})
			return
		}

		if (job.step === CoachLifecycleEmailStep.FeatureHighlight) {
			const athleteCount = await this.athleteRepository.count({
				filter: { companyId: job.companyId }
			})
			if (athleteCount === 0) {
				await this.jobRepository.markSkipped({
					id: job.id,
					reason: 'No athletes yet'
				})
				return
			}

			const videoCount = await this.videoRepository.count({
				filter: { teamId: job.teamId }
			})
			if (videoCount > 0) {
				await this.jobRepository.markSkipped({
					id: job.id,
					reason: 'Already using video + results'
				})
				return
			}

			const content = buildCoachFeatureHighlightEmail({
				firstName: user.firstName,
				appUrl
			})
			await this.sendAndMark({
				jobId: job.id,
				to: user.email,
				content
			})
			return
		}

		if (job.step === CoachLifecycleEmailStep.TrialEndingSoon) {
			const company = await this.companyRepository.findOne({
				filter: { id: job.companyId }
			})
			if (
				!company ||
				company.subscriptionStatus !== SubscriptionStatus.Trial
			) {
				await this.jobRepository.markSkipped({
					id: job.id,
					reason: 'No longer on trial'
				})
				return
			}

			const trialEndDate = company.trialEndsAt
				? format(company.trialEndsAt, 'MMMM d, yyyy')
				: 'soon'
			const planName = this.formatPlanName({
				plan: company.subscriptionPlan ?? null
			})

			const content = buildCoachTrialEndingSoonEmail({
				firstName: user.firstName,
				trialEndDate,
				planName,
				billingUrl: settingsUrl
			})
			await this.sendAndMark({
				jobId: job.id,
				to: user.email,
				content
			})
			return
		}

		if (
			job.step === CoachLifecycleEmailStep.TrialConverted ||
			job.step === CoachLifecycleEmailStep.TrialNotConverted
		) {
			// Immediate steps are sent when scheduled; treat leftover as done.
			await this.jobRepository.markSent({ id: job.id })
		}
	}

	private async sendImmediateTrialConverted({
		companyId,
		plan
	}: {
		companyId: string
		plan: SubscriptionPlan | null
	}): Promise<void> {
		const company = await this.companyRepository.findOneOrFail({
			filter: { id: companyId }
		})
		const team = await this.resolvePrimaryTeam({ companyId })
		if (!team) {
			return
		}

		const user = await this.userRepository.findOne({
			filter: { id: company.ownerId }
		})
		if (!user?.email) {
			return
		}

		const existing = await this.jobRepository.findOne({
			filter: {
				userId: user.id,
				step: CoachLifecycleEmailStep.TrialConverted
			}
		})
		if (
			existing &&
			(existing.status === CoachLifecycleEmailJobStatus.Sent ||
				existing.status === CoachLifecycleEmailJobStatus.Skipped)
		) {
			return
		}

		const content = buildCoachTrialConvertedEmail({
			firstName: user.firstName,
			planName: this.formatPlanName({
				plan: plan ?? company.subscriptionPlan ?? null
			}),
			appUrl: buildCoachHomeDeepLink()
		})

		await QueueService.scheduleSendEmail({
			to: user.email,
			subject: content.subject,
			text: content.text,
			html: content.html
		})

		const job = await this.jobRepository.upsertPendingJob({
			data: {
				userId: user.id,
				companyId,
				teamId: team.id,
				step: CoachLifecycleEmailStep.TrialConverted,
				scheduledFor: new Date()
			}
		})
		await this.jobRepository.markSent({ id: job.id })
	}

	private async sendImmediateTrialNotConverted({
		companyId
	}: {
		companyId: string
	}): Promise<void> {
		const company = await this.companyRepository.findOneOrFail({
			filter: { id: companyId }
		})
		const team = await this.resolvePrimaryTeam({ companyId })
		if (!team) {
			return
		}

		const user = await this.userRepository.findOne({
			filter: { id: company.ownerId }
		})
		if (!user?.email) {
			return
		}

		const existing = await this.jobRepository.findOne({
			filter: {
				userId: user.id,
				step: CoachLifecycleEmailStep.TrialNotConverted
			}
		})
		if (
			existing &&
			(existing.status === CoachLifecycleEmailJobStatus.Sent ||
				existing.status === CoachLifecycleEmailJobStatus.Skipped)
		) {
			return
		}

		const content = buildCoachTrialNotConvertedEmail({
			firstName: user.firstName,
			billingUrl: APPLE_SUBSCRIPTIONS_URL
		})

		await QueueService.scheduleSendEmail({
			to: user.email,
			subject: content.subject,
			text: content.text,
			html: content.html
		})

		const job = await this.jobRepository.upsertPendingJob({
			data: {
				userId: user.id,
				companyId,
				teamId: team.id,
				step: CoachLifecycleEmailStep.TrialNotConverted,
				scheduledFor: new Date()
			}
		})
		await this.jobRepository.markSent({ id: job.id })
	}

	private async sendAndMark({
		jobId,
		to,
		content
	}: {
		jobId: string
		to: string
		content: { subject: string; text: string; html: string }
	}): Promise<void> {
		await QueueService.scheduleSendEmail({
			to,
			subject: content.subject,
			text: content.text,
			html: content.html
		})
		await this.jobRepository.markSent({ id: jobId })
	}

	private async hasActivated({
		companyId,
		teamId
	}: {
		companyId: string
		teamId: string
	}): Promise<boolean> {
		const athleteCount = await this.athleteRepository.count({
			filter: { companyId }
		})
		if (athleteCount === 0) {
			return false
		}

		const sessionCount = await this.trainingSessionRepository.count({
			filter: { companyId }
		})
		if (sessionCount > 0) {
			return true
		}

		const videoCount = await this.videoRepository.count({
			filter: { teamId }
		})
		return videoCount > 0
	}

	private async resolvePrimaryTeam({
		companyId
	}: {
		companyId: string
	}): Promise<{ id: string } | null> {
		const teams = await this.teamRepository.find({
			filter: { companyId },
			limit: 1
		})
		return teams[0] ?? null
	}

	@NoTrace()
	private formatPlanName({
		plan
	}: {
		plan: SubscriptionPlan | null
	}): string {
		if (!plan) {
			return 'Pro'
		}
		return plan.charAt(0).toUpperCase() + plan.slice(1)
	}
}
